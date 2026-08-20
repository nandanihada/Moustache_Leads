"""
Voqall Sub-Wall Automation Service
====================================
Runs automatically after every Voqall sync (and can be triggered manually).

What it does:
1. Finds all active Voqall offers in the `offers` collection
   (identified by import_source='voqall').
2. Renames every one of them to "YIS Survey" (fixed display name for all Voqall surveys).
3. Marks them as subwall_exclusive=True so they are hidden from the main offerwall
   and publisher offer list.
4. Adds their offer_ids to the "Moustache Survey's" sub-wall
   (slug='moustache-survey-s') if not already present.

This runs as a lightweight post-sync hook — no separate thread needed.
"""

import logging
from datetime import datetime

logger = logging.getLogger(__name__)

# ── Constants ────────────────────────────────────────────────────────────────
VOQALL_IMPORT_SOURCE = 'voqall'
YIS_SURVEY_NAME      = 'YIS Survey'
TARGET_SUBWALL_SLUG  = 'moustache-survey-s'


def run_voqall_subwall_automation(db_instance=None) -> dict:
    """
    Main entry point.
    Called after every Voqall sync and available as a manual trigger.

    Returns a summary dict compatible with the Automation tab display format.
    """
    if db_instance is None:
        from database import db_instance as _db
        db_instance = _db

    offers_col    = db_instance.get_collection('offers')
    sub_walls_col = db_instance.get_collection('sub_walls')

    if offers_col is None or sub_walls_col is None:
        logger.error('voqall_subwall_automation: DB collections not available')
        return {'success': False, 'error': 'DB not available', 'renamed': 0, 'added_to_subwall': 0}

    now = datetime.utcnow()

    # ── STEP 1: Find all active Voqall offers ────────────────────────────────
    voqall_offers = list(offers_col.find(
        {
            'import_source': VOQALL_IMPORT_SOURCE,
            'status': {'$in': ['active', 'running']},
            '$or': [{'deleted': {'$exists': False}}, {'deleted': False}],
        },
        {'offer_id': 1, 'name': 1, 'subwall_exclusive': 1}
    ))

    if not voqall_offers:
        logger.info('voqall_subwall_automation: No active Voqall offers found')
        return {
            'success': True,
            'message': 'No active Voqall offers found',
            'renamed': 0,
            'already_named': 0,
            'added_to_subwall': 0,
            'already_in_subwall': 0,
            'run_at': now.isoformat() + 'Z',
        }

    voqall_offer_ids = [o['offer_id'] for o in voqall_offers if o.get('offer_id')]
    logger.info(f'voqall_subwall_automation: Processing {len(voqall_offer_ids)} Voqall offers')

    # ── STEP 2: Rename to "YIS Survey" + mark subwall_exclusive ─────────────
    # Only update offers that don't already have the correct name
    needs_rename = [
        o for o in voqall_offers
        if o.get('name') != YIS_SURVEY_NAME or not o.get('subwall_exclusive')
    ]
    already_named = len(voqall_offers) - len(needs_rename)

    renamed = 0
    if needs_rename:
        needs_rename_ids = [o['offer_id'] for o in needs_rename if o.get('offer_id')]
        result = offers_col.update_many(
            {'offer_id': {'$in': needs_rename_ids}},
            {'$set': {
                'name': YIS_SURVEY_NAME,
                'subwall_exclusive': True,
                'show_in_offerwall': False,   # Hide from main offerwall
                'voqall_subwall_tagged': True,
                'voqall_subwall_tagged_at': now,
                'updated_at': now,
            }}
        )
        renamed = result.modified_count
        logger.info(f'voqall_subwall_automation: Renamed {renamed} offers to "{YIS_SURVEY_NAME}"')

    # ── STEP 3: Add offer_ids to "Moustache Survey's" sub-wall ──────────────
    sub_wall = sub_walls_col.find_one({'slug': TARGET_SUBWALL_SLUG})

    if not sub_wall:
        logger.warning(
            f'voqall_subwall_automation: Sub-wall with slug "{TARGET_SUBWALL_SLUG}" not found. '
            f'Create it in Sub-Walls first.'
        )
        return {
            'success': False,
            'error': f'Sub-wall "{TARGET_SUBWALL_SLUG}" not found',
            'renamed': renamed,
            'already_named': already_named,
            'added_to_subwall': 0,
            'already_in_subwall': 0,
            'total_voqall_offers': len(voqall_offer_ids),
            'run_at': now.isoformat() + 'Z',
        }

    existing_ids_in_wall = set(sub_wall.get('offer_ids', []))
    new_ids = [oid for oid in voqall_offer_ids if oid not in existing_ids_in_wall]
    already_in_subwall = len(voqall_offer_ids) - len(new_ids)

    added_to_subwall = 0
    if new_ids:
        sub_walls_col.update_one(
            {'slug': TARGET_SUBWALL_SLUG},
            {'$addToSet': {'offer_ids': {'$each': new_ids}},
             '$set': {'updated_at': now}}
        )
        added_to_subwall = len(new_ids)
        logger.info(
            f'voqall_subwall_automation: Added {added_to_subwall} new offers to '
            f'sub-wall "{TARGET_SUBWALL_SLUG}"'
        )

    # ── STEP 4: Remove stale/paused Voqall offers from the sub-wall ─────────
    # If Voqall sync deactivated some offers, remove them from the sub-wall
    paused_voqall = list(offers_col.find(
        {
            'import_source': VOQALL_IMPORT_SOURCE,
            'status': {'$in': ['paused', 'inactive']},
        },
        {'offer_id': 1}
    ))
    paused_ids = [o['offer_id'] for o in paused_voqall if o.get('offer_id')]
    removed_from_wall = 0
    if paused_ids:
        result = sub_walls_col.update_one(
            {'slug': TARGET_SUBWALL_SLUG},
            {'$pull': {'offer_ids': {'$in': paused_ids}}}
        )
        removed_from_wall = result.modified_count
        if removed_from_wall:
            logger.info(
                f'voqall_subwall_automation: Removed {len(paused_ids)} stale Voqall '
                f'offers from sub-wall'
            )

    summary = {
        'success': True,
        'total_voqall_offers': len(voqall_offer_ids),
        'renamed': renamed,
        'already_named': already_named,
        'added_to_subwall': added_to_subwall,
        'already_in_subwall': already_in_subwall,
        'stale_removed_from_wall': removed_from_wall,
        'subwall_slug': TARGET_SUBWALL_SLUG,
        'offer_name': YIS_SURVEY_NAME,
        'run_at': now.isoformat() + 'Z',
    }
    logger.info(f'✅ voqall_subwall_automation complete: {summary}')
    return summary
