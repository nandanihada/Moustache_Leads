"""
Migration: Flag fake conversions and forwarded postbacks created by the dangerous fallback logic.

The old postback_processor.py had a fallback that grabbed ANY recent click when no
click_id matched a postback. This created fake conversions with mismatched data,
which then triggered fake forwarded_postbacks and fake points_transactions.

This script identifies and flags records across ALL affected collections:
- conversions: fake entries from fallback click matching
- forwarded_postbacks: forwards that happened from fake conversions  
- points_transactions: points awarded from fake conversions

Run from backend/: python migrations/flag_fake_conversions.py
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from database import db_instance
from bson import ObjectId
from datetime import datetime
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
    # PHASE 1: Flag fake conversions
    # ============================================================
    logger.info("=" * 60)
    logger.info("PHASE 1: Checking conversions collection")
    logger.info("=" * 60)

    total = conversions.count_documents({})
    logger.info(f"Total conversions: {total}")

    legacy_conversions = list(conversions.find({'source': {'$exists': False}}))
    logger.info(f"Legacy conversions (no source field): {len(legacy_conversions)}")

    conv_flagged = 0
    conv_verified = 0

    for conv in legacy_conversions:
        conv_id = conv.get('conversion_id', 'unknown')
        click_id = conv.get('click_id')
        conv_offer_id = conv.get('offer_id')
        is_fake = False
        reason = []

        click = clicks.find_one({'click_id': click_id}) if click_id else None

        if not click:
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
            logger.info(f"  FAKE CONV: {conv_id} — {', '.join(reason)}")
        else:
            conv_verified += 1
            if not dry_run:
                conversions.update_one(
                    {'_id': conv['_id']},
                    {'$set': {'source': 'legacy_verified', 'verified': True}}
                )

    # ============================================================
    # PHASE 2: Flag fake forwarded_postbacks (the conversion report source)
    # ============================================================
    logger.info("\n" + "=" * 60)
    logger.info("PHASE 2: Checking forwarded_postbacks collection")
    logger.info("=" * 60)

    if forwarded_postbacks is not None:
        fwd_total = forwarded_postbacks.count_documents({})
        logger.info(f"Total forwarded_postbacks: {fwd_total}")

        # Get all forwarded_postbacks without source field (legacy)
        legacy_fwd = list(forwarded_postbacks.find({'source': {'$exists': False}}))
        logger.info(f"Legacy forwarded_postbacks (no source field): {len(legacy_fwd)}")

        # Also get received_postbacks to cross-reference
        fwd_flagged = 0
        fwd_verified = 0

        for fwd in legacy_fwd:
            fwd_id = str(fwd.get('_id'))
            original_pb_id = fwd.get('original_postback_id')
            click_id = fwd.get('click_id', '')
            is_fake = False
            reason = []

            # Check 1: Does the original_postback_id link to a real received postback?
            if original_pb_id:
                try:
                    pb = received_postbacks.find_one({'_id': ObjectId(original_pb_id) if isinstance(original_pb_id, str) else original_pb_id})
                    if not pb:
                        reason.append('received_postback_not_found')
                except:
                    reason.append('invalid_postback_id')
            else:
                reason.append('no_original_postback_id')

            # Check 2: Does the click_id exist and match the offer?
            if click_id and click_id != 'unknown':
                click = clicks.find_one({'click_id': click_id})
                if not click:
                    is_fake = True
                    reason.append('click_not_found')
            else:
                # No click_id means it was likely from the fallback
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
                logger.info(f"  FAKE FWD: {fwd_id} — {', '.join(reason)}")
            else:
                fwd_verified += 1
                if not dry_run:
                    forwarded_postbacks.update_one(
                        {'_id': fwd['_id']},
                        {'$set': {'source': 'legacy_verified'}}
                    )
    else:
        fwd_flagged = 0
        fwd_verified = 0
        legacy_fwd = []

    # ============================================================
    # PHASE 3: Flag fake points_transactions
    # ============================================================
    logger.info("\n" + "=" * 60)
    logger.info("PHASE 3: Checking points_transactions collection")
    logger.info("=" * 60)

    pts_flagged = 0
    pts_verified = 0
    pts_total_fake_points = 0
    fake_points_by_user = {}

    if points_transactions is not None:
        pts_total = points_transactions.count_documents({})
        logger.info(f"Total points_transactions: {pts_total}")

        legacy_pts = list(points_transactions.find({
            'source': {'$exists': False},
            'type': 'offer_completion'
        }))
        logger.info(f"Legacy offer_completion transactions (no source): {len(legacy_pts)}")

        for pt in legacy_pts:
            click_id = pt.get('click_id', '')
            is_fake = False
            reason = []

            if click_id and click_id != 'unknown':
                click = clicks.find_one({'click_id': click_id})
                if not click:
                    is_fake = True
                    reason.append('click_not_found')
            else:
                is_fake = True
                reason.append('no_click_id')

            if is_fake:
                pts_flagged += 1
                pts_total_fake_points += pt.get('points', 0)
                username = pt.get('username', 'unknown')
                fake_points_by_user[username] = fake_points_by_user.get(username, 0) + pt.get('points', 0)

                if not dry_run:
                    points_transactions.update_one(
                        {'_id': pt['_id']},
                        {'$set': {'source': 'fallback_fake', 'flagged_at': datetime.utcnow(),
                                  'flag_reason': reason}}
                    )
            else:
                pts_verified += 1
                if not dry_run:
                    points_transactions.update_one(
                        {'_id': pt['_id']},
                        {'$set': {'source': 'legacy_verified'}}
                    )
    else:
        legacy_pts = []

    # ============================================================
    # PHASE 4: Deduct fake points from users (only on --apply)
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
                logger.info(f"    → Deducted {fake_pts} points from {username}")

    # ============================================================
    # SUMMARY
    # ============================================================
    logger.info("\n" + "=" * 60)
    logger.info(f"FINAL RESULTS {'(DRY RUN)' if dry_run else '(APPLIED)'}:")
    logger.info(f"  Conversions: {conv_flagged} fake / {conv_verified} verified / {len(legacy_conversions)} checked")
    logger.info(f"  Forwarded Postbacks: {fwd_flagged} fake / {fwd_verified} verified / {len(legacy_fwd)} checked")
    logger.info(f"  Points Transactions: {pts_flagged} fake / {pts_verified} verified / {len(legacy_pts)} checked")
    logger.info(f"  Total fake points: {pts_total_fake_points}")
    if fake_points_by_user:
        logger.info(f"  Affected users: {', '.join(fake_points_by_user.keys())}")
    logger.info("=" * 60)

    if dry_run:
        logger.info("\nDRY RUN complete. Run with --apply to make changes.")

    return {
        'conversions': {'flagged': conv_flagged, 'verified': conv_verified, 'total': len(legacy_conversions)},
        'forwarded_postbacks': {'flagged': fwd_flagged, 'verified': fwd_verified, 'total': len(legacy_fwd)},
        'points_transactions': {'flagged': pts_flagged, 'verified': pts_verified, 'total': len(legacy_pts)},
        'fake_points_total': pts_total_fake_points,
        'fake_points_by_user': fake_points_by_user
    }


if __name__ == '__main__':
    dry_run = '--apply' not in sys.argv
    if not dry_run:
        logger.warning("⚠️ APPLYING CHANGES — this will modify conversions, forwarded_postbacks, points_transactions, and users")
        confirm = input("Type 'yes' to confirm: ")
        if confirm.lower() != 'yes':
            logger.info("Aborted.")
            sys.exit(0)
    flag_fake_conversions(dry_run=dry_run)
