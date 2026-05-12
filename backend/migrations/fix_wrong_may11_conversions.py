"""
Migration: Fix the 3 incorrectly created conversions from 5/11/2026

The previous migration run created conversions with:
- Wrong payout: $3.75 (full offer payout) instead of $3.00 (80% publisher share)
- "Unknown Offer" name
- Wrong transaction_id (showing "ash" instead of actual transaction ID)

This script will:
1. Find the 3 bad conversion records
2. Fix the payout to 80% of offer payout
3. Fix the offer name
4. Fix the transaction_id
5. Adjust the user's balance (subtract the overpayment)

Run: python migrations/fix_wrong_may11_conversions.py
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import db_instance
from datetime import datetime
from bson import ObjectId
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def fix_wrong_conversions():
    """Fix the incorrectly created conversions from the first migration run"""
    
    conversions_col = db_instance.get_collection('conversions')
    forwarded_col = db_instance.get_collection('forwarded_postbacks')
    users_col = db_instance.get_collection('users')
    pts_col = db_instance.get_collection('points_transactions')
    offers_col = db_instance.get_collection('offers')
    clicks_col = db_instance.get_collection('clicks')
    received_col = db_instance.get_collection('received_postbacks')
    
    # Find the user "ash" (user_id: 69a9a5e655f321cc19f6a74d)
    user_id = '69a9a5e655f321cc19f6a74d'
    user = users_col.find_one({'_id': ObjectId(user_id)})
    
    if not user:
        logger.error(f"❌ User not found: {user_id}")
        return
    
    username = user.get('username', 'Unknown')
    current_balance = user.get('total_points', 0)
    logger.info(f"👤 User: {username}, Current balance: ${current_balance}")
    
    # Find the bad conversions created by the migration (matched_by = 'migration_may11_fix')
    bad_conversions = list(conversions_col.find({
        'user_id': user_id,
        'matched_by': 'migration_may11_fix'
    }))
    
    if not bad_conversions:
        # Also try finding by source
        bad_conversions = list(conversions_col.find({
            'user_id': user_id,
            'payout': 3.75,  # The wrong full payout
            'offer_id': 'unknown'
        }))
    
    if not bad_conversions:
        # Try by the forwarded_postbacks with wrong data
        bad_fwd = list(forwarded_col.find({
            'publisher_name': username,
            'offer_name': 'Unknown Offer',
            'points': 3.75
        }))
        logger.info(f"Found {len(bad_fwd)} bad forwarded_postbacks records")
        
        # Also check conversions with $3.75 payout for this user on 5/11
        start_date = datetime(2026, 5, 11, 0, 0, 0)
        end_date = datetime(2026, 5, 12, 23, 59, 59)
        bad_conversions = list(conversions_col.find({
            'user_id': user_id,
            'conversion_time': {'$gte': start_date, '$lte': end_date},
            '$or': [
                {'offer_id': 'unknown'},
                {'offer_name': 'Unknown Offer'},
                {'payout': 3.75}
            ]
        }))
    
    logger.info(f"Found {len(bad_conversions)} bad conversions to fix")
    
    if not bad_conversions:
        logger.info("No bad conversions found. Checking all recent conversions for this user...")
        recent = list(conversions_col.find({'user_id': user_id}).sort('conversion_time', -1).limit(10))
        for c in recent:
            logger.info(f"  - {c.get('conversion_id')} | offer={c.get('offer_id')} | payout={c.get('payout')} | matched_by={c.get('matched_by')} | time={c.get('conversion_time')}")
        return
    
    # Find the actual offer from the user's clicks
    # Get the most recent clicks for this user to determine the correct offer
    recent_clicks = list(clicks_col.find({'user_id': user_id}).sort('click_time', -1).limit(10))
    logger.info(f"\nRecent clicks for {username}:")
    for c in recent_clicks:
        offer = offers_col.find_one({'offer_id': c.get('offer_id')})
        offer_name = offer.get('name', 'Unknown') if offer else 'Unknown'
        offer_payout = offer.get('payout', 0) if offer else 0
        logger.info(f"  - {c.get('click_id')} | {c.get('offer_id')} | {offer_name} | payout=${offer_payout} | converted={c.get('converted')}")
    
    # Determine the correct offer (from the click data)
    correct_offer = None
    correct_offer_id = ''
    if recent_clicks:
        for c in recent_clicks:
            o = offers_col.find_one({'offer_id': c.get('offer_id')})
            if o:
                correct_offer = o
                correct_offer_id = o.get('offer_id', '')
                break
    
    if correct_offer:
        correct_offer_name = correct_offer.get('name', 'Unknown Offer')
        correct_offer_payout = float(correct_offer.get('payout', 0))
        correct_publisher_payout = round(correct_offer_payout * 0.8, 2)
        logger.info(f"\n✅ Correct offer: {correct_offer_id} — {correct_offer_name}")
        logger.info(f"   Offer payout: ${correct_offer_payout}")
        logger.info(f"   Publisher payout (80%): ${correct_publisher_payout}")
    else:
        logger.error("❌ Could not determine correct offer from clicks")
        return
    
    # Calculate the difference to adjust
    wrong_payout_per_conv = 3.75  # What was incorrectly awarded
    correct_payout_per_conv = correct_publisher_payout
    diff_per_conv = wrong_payout_per_conv - correct_payout_per_conv
    total_overcharge = diff_per_conv * len(bad_conversions)
    
    logger.info(f"\n📊 Adjustment needed:")
    logger.info(f"   Wrong payout per conversion: ${wrong_payout_per_conv}")
    logger.info(f"   Correct payout per conversion: ${correct_payout_per_conv}")
    logger.info(f"   Difference per conversion: ${diff_per_conv}")
    logger.info(f"   Total overcharge ({len(bad_conversions)} conversions): ${total_overcharge}")
    
    # Fix each conversion
    for conv in bad_conversions:
        conv_id = conv.get('conversion_id')
        logger.info(f"\n  Fixing conversion: {conv_id}")
        
        # Update conversion record
        conversions_col.update_one(
            {'_id': conv['_id']},
            {'$set': {
                'offer_id': correct_offer_id,
                'offer_name': correct_offer_name,
                'payout': correct_publisher_payout,
                'publisher_payout': correct_publisher_payout,
                'transaction_id': '',  # Clear the wrong "ash" value
                'fixed_at': datetime.utcnow(),
                'fix_note': 'Corrected from migration_may11 — was using full payout instead of 80%'
            }}
        )
        logger.info(f"    ✅ Conversion updated: payout ${wrong_payout_per_conv} → ${correct_payout_per_conv}")
    
    # Fix forwarded_postbacks records
    bad_fwd = list(forwarded_col.find({
        'publisher_name': username,
        'offer_name': 'Unknown Offer',
        'points': wrong_payout_per_conv
    }))
    
    for fwd in bad_fwd:
        forwarded_col.update_one(
            {'_id': fwd['_id']},
            {'$set': {
                'offer_id': correct_offer_id,
                'offer_name': correct_offer_name,
                'points': correct_payout_per_conv,
                'fixed_at': datetime.utcnow()
            }}
        )
    logger.info(f"\n  ✅ Fixed {len(bad_fwd)} forwarded_postbacks records")
    
    # Fix points transactions
    bad_pts = list(pts_col.find({
        'username': username,
        'points': wrong_payout_per_conv,
        'source': 'verified_postback_migration_may11'
    }))
    
    for pt in bad_pts:
        pts_col.update_one(
            {'_id': pt['_id']},
            {'$set': {
                'points': correct_payout_per_conv,
                'offer_id': correct_offer_id,
                'fixed_at': datetime.utcnow()
            }}
        )
    logger.info(f"  ✅ Fixed {len(bad_pts)} points transactions")
    
    # Adjust user balance
    if total_overcharge > 0:
        users_col.update_one(
            {'_id': ObjectId(user_id)},
            {'$inc': {'total_points': -total_overcharge}, '$set': {'updated_at': datetime.utcnow()}}
        )
        logger.info(f"\n  💰 Adjusted balance: -${total_overcharge}")
    
    # Verify final balance
    user_after = users_col.find_one({'_id': ObjectId(user_id)})
    new_balance = user_after.get('total_points', 0)
    
    logger.info(f"\n{'='*60}")
    logger.info(f"🎉 FIX COMPLETE")
    logger.info(f"   User: {username}")
    logger.info(f"   Balance before: ${current_balance}")
    logger.info(f"   Balance after: ${new_balance}")
    logger.info(f"   Adjustment: -${total_overcharge}")
    logger.info(f"   Conversions fixed: {len(bad_conversions)}")
    logger.info(f"   Correct payout per conversion: ${correct_payout_per_conv}")
    logger.info(f"{'='*60}")


if __name__ == '__main__':
    fix_wrong_conversions()
