"""
Migration: Flag fake conversions and forwarded postbacks.
Re-checks ALL records (including previously marked ones) using robust detection.

Run from backend/: python migrations/flag_fake_conversions.py
"""

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from database import db_instance
from bson import ObjectId
from datetime import datetime
from collections import Counter
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def flag_fake_conversions(dry_run=True):
    conversions = db_instance.get_collection('conversions')
    clicks = db_instance.get_collection('clicks')
    received_postbacks = db_instance.get_collection('received_postbacks')
    forwarded_postbacks = db_instance.get_collection('forwarded_postbacks')
    points_transactions = db_instance.get_collection('points_transactions')
    users = db_instance.get_collection('users')

    if conversions is None or clicks is None:
        logger.error("Cannot connect to database collections")
        return

    # ============================================================
    # PHASE 1: Fix forwarded_postbacks (the conversion report source)
    # Re-check ALL records, not just ones without source field
    # ============================================================
    logger.info("=" * 60)
    logger.info("PHASE 1: Checking ALL forwarded_postbacks")
    logger.info("=" * 60)

    fwd_flagged = 0
    fwd_verified = 0
    all_fwd = []

    if forwarded_postbacks is not None:
        fwd_total = forwarded_postbacks.count_documents({})
        logger.info(f"Total forwarded_postbacks: {fwd_total}")

        # Get ALL forwarded_postbacks (re-check everything)
        all_fwd = list(forwarded_postbacks.find({}))
        logger.info(f"Checking all {len(all_fwd)} records")

        # Detect duplicate click_ids (fallback reused same click)
        click_id_counts = Counter()
        for fwd in all_fwd:
            cid = fwd.get('click_id', '')
            if cid and cid != 'unknown':
                click_id_counts[cid] += 1

        duplicate_click_ids = {cid for cid, count in click_id_counts.items() if count > 1}
        if duplicate_click_ids:
            logger.info(f"Click IDs reused across multiple forwards: {len(duplicate_click_ids)}")
            for cid, count in click_id_counts.most_common(5):
                if count > 1:
                    logger.info(f"  click_id={cid} used {count} times")

        for fwd in all_fwd:
            is_fake = False
            reason = []

            click_id = fwd.get('click_id', '')
            enriched = fwd.get('enriched_params', {})
            enriched_points = enriched.get('points', '') if isinstance(enriched, dict) else ''
            enriched_username = enriched.get('username', '') if isinstance(enriched, dict) else ''

            # Detection 1: enriched_params shows 0 points or Unknown username
            # This means the system couldn't find real data for this forward
            if enriched_points in ('0', 0, ''):
                is_fake = True
                reason.append('enriched_points_zero')

            if enriched_username in ('Unknown', '', 'System:'):
                is_fake = True
                reason.append(f'enriched_username={enriched_username}')

            # Detection 2: Same click_id used for multiple forwards
            if click_id and click_id != 'unknown' and click_id in duplicate_click_ids:
                is_fake = True
                reason.append(f'duplicate_click_id({click_id_counts[click_id]}x)')

            # Detection 3: No click_id
            if not click_id or click_id == 'unknown':
                is_fake = True
                reason.append('no_click_id')

            if is_fake:
                fwd_flagged += 1
                if not dry_run:
                    forwarded_postbacks.update_one(
                        {'_id': fwd['_id']},
                        {'$set': {'source': 'fallback_fake', 'flagged_at': datetime.utcnow(),
                                  'flag_reason': reason}}
                    )
                logger.info(f"  FAKE: publisher={fwd.get('publisher_name')}, points={fwd.get('points')}, "
                           f"click={click_id[:20] if click_id else 'none'} — {', '.join(reason)}")
            else:
                fwd_verified += 1
                if not dry_run:
                    forwarded_postbacks.update_one(
                        {'_id': fwd['_id']},
                        {'$set': {'source': 'legacy_verified'}}
                    )

    # ============================================================
    # PHASE 2: Flag fake conversions (re-check all)
    # ============================================================
    logger.info("\n" + "=" * 60)
    logger.info("PHASE 2: Checking ALL conversions")
    logger.info("=" * 60)

    conv_flagged = 0
    conv_verified = 0
    all_conv = list(conversions.find({}))
    logger.info(f"Total conversions: {len(all_conv)}")

    for conv in all_conv:
        click_id = conv.get('click_id')
        conv_offer_id = conv.get('offer_id')
        is_fake = False
        reason = []

        click = clicks.find_one({'click_id': click_id}) if click_id else None

        if click is None:
            is_fake = True
            reason.append('click_not_found')
        else:
            click_offer_id = click.get('offer_id')
            if click_offer_id and conv_offer_id and click_offer_id != conv_offer_id:
                is_fake = True
                reason.append(f'offer_mismatch:click={click_offer_id},conv={conv_offer_id}')

        if is_fake:
            conv_flagged += 1
            if not dry_run:
                conversions.update_one(
                    {'_id': conv['_id']},
                    {'$set': {'source': 'fallback_fake', 'verified': False,
                              'flagged_at': datetime.utcnow(), 'flag_reason': reason}}
                )
        else:
            conv_verified += 1
            if not dry_run and conv.get('source') != 'postback':
                conversions.update_one(
                    {'_id': conv['_id']},
                    {'$set': {'source': 'legacy_verified', 'verified': True}}
                )

    # ============================================================
    # PHASE 3: Flag fake points_transactions (re-check all offer_completion)
    # ============================================================
    logger.info("\n" + "=" * 60)
    logger.info("PHASE 3: Checking points_transactions")
    logger.info("=" * 60)

    pts_flagged = 0
    pts_verified = 0
    pts_total_fake_points = 0
    fake_points_by_user = {}
    legacy_pts = []

    if points_transactions is not None:
        legacy_pts = list(points_transactions.find({'type': 'offer_completion'}))
        logger.info(f"Offer completion transactions: {len(legacy_pts)}")

        for pt in legacy_pts:
            click_id = pt.get('click_id', '')
            is_fake = False

            if click_id and click_id in duplicate_click_ids:
                is_fake = True
            elif not click_id or click_id == 'unknown':
                is_fake = True

            if is_fake:
                pts_flagged += 1
                pts_total_fake_points += pt.get('points', 0)
                username = pt.get('username', 'unknown')
                fake_points_by_user[username] = fake_points_by_user.get(username, 0) + pt.get('points', 0)
                if not dry_run:
                    points_transactions.update_one(
                        {'_id': pt['_id']},
                        {'$set': {'source': 'fallback_fake', 'flagged_at': datetime.utcnow()}}
                    )
            else:
                pts_verified += 1
                if not dry_run:
                    points_transactions.update_one(
                        {'_id': pt['_id']},
                        {'$set': {'source': 'legacy_verified'}}
                    )

    # ============================================================
    # PHASE 4: Deduct fake points from users
    # ============================================================
    if fake_points_by_user:
        logger.info("\n" + "=" * 60)
        logger.info("PHASE 4: Users with fake points")
        logger.info("=" * 60)
        for username, fake_pts in sorted(fake_points_by_user.items(), key=lambda x: -x[1]):
            logger.info(f"  {username}: {fake_pts} fake points")
            if not dry_run and users is not None:
                users.update_one(
                    {'username': username},
                    {'$inc': {'total_points': -fake_pts}}
                )
                logger.info(f"    -> Deducted {fake_pts} points from {username}")

    # ============================================================
    # SUMMARY
    # ============================================================
    logger.info("\n" + "=" * 60)
    mode = '(DRY RUN)' if dry_run else '(APPLIED)'
    logger.info(f"RESULTS {mode}:")
    logger.info(f"  Forwarded Postbacks: {fwd_flagged} fake / {fwd_verified} verified / {len(all_fwd)} total")
    logger.info(f"  Conversions: {conv_flagged} fake / {conv_verified} verified / {len(all_conv)} total")
    logger.info(f"  Points Transactions: {pts_flagged} fake / {pts_verified} verified / {len(legacy_pts)} total")
    logger.info(f"  Total fake points: {pts_total_fake_points}")
    if fake_points_by_user:
        logger.info(f"  Affected users: {', '.join(f'{u}({p}pts)' for u, p in fake_points_by_user.items())}")
    logger.info("=" * 60)

    return {
        'conversions': {'flagged': conv_flagged, 'verified': conv_verified, 'total': len(all_conv)},
        'forwarded_postbacks': {'flagged': fwd_flagged, 'verified': fwd_verified, 'total': len(all_fwd)},
        'points_transactions': {'flagged': pts_flagged, 'verified': pts_verified, 'total': len(legacy_pts)},
        'fake_points_total': pts_total_fake_points,
        'fake_points_by_user': fake_points_by_user
    }


if __name__ == '__main__':
    dry_run = '--apply' not in sys.argv
    if not dry_run:
        logger.warning("APPLYING CHANGES to conversions, forwarded_postbacks, points_transactions, users")
        confirm = input("Type 'yes' to confirm: ")
        if confirm.lower() != 'yes':
            print("Aborted.")
            sys.exit(0)
    flag_fake_conversions(dry_run=dry_run)
