"""
Migration: Fix unmatched cpamerchant postbacks from 5/11/2026

These postbacks from cpamerchant were received but marked as unmatched because
all clicks for the user were already converted. The fix in postback_processor.py
and postback_receiver.py prevents this from happening in the future, but we need
to retroactively credit the 3 conversions from yesterday.

Run: python migrations/fix_unmatched_cpamerchant_may11.py
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import db_instance
from datetime import datetime, timedelta
from bson import ObjectId
import secrets
import logging
import requests as req_lib

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def fix_unmatched_cpamerchant_may11():
    """Fix all unmatched cpamerchant postbacks from 5/11/2026"""
    
    received_postbacks = db_instance.get_collection('received_postbacks')
    clicks_collection = db_instance.get_collection('clicks')
    conversions_collection = db_instance.get_collection('conversions')
    forwarded_postbacks_col = db_instance.get_collection('forwarded_postbacks')
    users_collection = db_instance.get_collection('users')
    offers_collection = db_instance.get_collection('offers')
    pts_col = db_instance.get_collection('points_transactions')
    
    # Find all unmatched cpamerchant postbacks from May 11, 2026
    start_date = datetime(2026, 5, 11, 0, 0, 0)
    end_date = datetime(2026, 5, 12, 0, 0, 0)
    
    unmatched_postbacks = list(received_postbacks.find({
        'partner_name': 'cpamerchant',
        'status': {'$in': ['unmatched', 'received']},
        'timestamp': {'$gte': start_date, '$lt': end_date}
    }).sort('timestamp', 1))
    
    logger.info(f"Found {len(unmatched_postbacks)} unmatched cpamerchant postbacks from 5/11/2026")
    
    if not unmatched_postbacks:
        logger.info("No unmatched postbacks to fix. Checking if they were already processed...")
        # Show all cpamerchant postbacks from that day
        all_pbs = list(received_postbacks.find({
            'partner_name': 'cpamerchant',
            'timestamp': {'$gte': start_date, '$lt': end_date}
        }).sort('timestamp', 1))
        logger.info(f"Total cpamerchant postbacks on 5/11: {len(all_pbs)}")
        for pb in all_pbs:
            logger.info(f"  - {pb.get('timestamp')} | status={pb.get('status')} | params={pb.get('query_params')}")
        return
    
    fixed_count = 0
    total_points_awarded = 0
    
    for unmatched in unmatched_postbacks:
        logger.info(f"\n{'='*60}")
        logger.info(f"Processing postback: {unmatched['_id']}")
        logger.info(f"  Timestamp: {unmatched.get('timestamp')}")
        logger.info(f"  Params: {unmatched.get('query_params')}")
        
        params = unmatched.get('query_params', {})
        post_data = unmatched.get('post_data', {})
        merged = {}
        merged.update(params)
        merged.update(post_data)
        
        user_id = merged.get('user_id') or merged.get('affiliate_id') or merged.get('aff_id')
        offer_id_from_pb = merged.get('offer_id') or merged.get('cid') or merged.get('survey_id') or ''
        transaction_id = merged.get('transaction_id', '')
        
        # Safely parse payout — cpamerchant sometimes sends unreplaced macros like '{payout}'
        raw_payout = merged.get('payout', '0') or '0'
        try:
            upward_payout = float(raw_payout)
        except (ValueError, TypeError):
            logger.warning(f"  ⚠️ Invalid payout value: '{raw_payout}' — defaulting to 0")
            upward_payout = 0
        
        if not user_id:
            logger.warning(f"  ⚠️ No user_id in postback — skipping")
            continue
        
        # Check if already processed (conversion exists for this postback)
        existing = conversions_collection.find_one({'postback_id': str(unmatched['_id'])})
        if existing:
            logger.info(f"  ⚠️ Already has conversion: {existing.get('conversion_id')} — skipping")
            continue
        
        # Also check by transaction_id if available
        if transaction_id:
            existing_by_txn = conversions_collection.find_one({'transaction_id': transaction_id})
            if existing_by_txn:
                logger.info(f"  ⚠️ Conversion exists for transaction_id={transaction_id}: {existing_by_txn.get('conversion_id')} — skipping")
                received_postbacks.update_one(
                    {'_id': unmatched['_id']},
                    {'$set': {'status': 'processed', 'conversion_id': existing_by_txn.get('conversion_id')}}
                )
                continue
        
        # Find the user
        publisher_user = None
        try:
            publisher_user = users_collection.find_one({'_id': ObjectId(user_id)})
        except:
            publisher_user = users_collection.find_one({'username': user_id})
        
        if not publisher_user:
            logger.warning(f"  ⚠️ User not found: {user_id} — skipping")
            continue
        
        publisher_username = publisher_user.get('username', 'Unknown')
        publisher_postback_url = publisher_user.get('postback_url', '')
        publisher_id = str(publisher_user['_id'])
        
        logger.info(f"  👤 Publisher: {publisher_username}")
        
        # Find matching click (any click for this user, even if converted)
        click_query = {'user_id': user_id}
        if offer_id_from_pb:
            click_query['offer_id'] = offer_id_from_pb
        
        # Try unconverted first
        click = clicks_collection.find_one(
            {**click_query, 'converted': {'$ne': True}},
            sort=[('click_time', -1)]
        )
        
        if not click:
            # Use any recent click
            click = clicks_collection.find_one(click_query, sort=[('click_time', -1)])
        
        if not click:
            # Try without offer_id filter
            click = clicks_collection.find_one({'user_id': user_id}, sort=[('click_time', -1)])
        
        if click:
            logger.info(f"  📎 Matched click: {click.get('click_id')} | offer: {click.get('offer_id')}")
        else:
            logger.warning(f"  ⚠️ No click found for user {user_id} — creating conversion without click")
        
        # Get offer info — prioritize click's offer_id over postback's (cpamerchant sends their campaign_id, not our ML-XXXXX)
        matched_offer_id = (click.get('offer_id') if click else '') or offer_id_from_pb
        offer = None
        if matched_offer_id:
            offer = offers_collection.find_one({'offer_id': matched_offer_id})
        
        # If offer not found by our ID, try looking up by cpamerchant campaign_id
        if not offer and offer_id_from_pb:
            offer = offers_collection.find_one({'campaign_id': offer_id_from_pb})
            if offer:
                matched_offer_id = offer.get('offer_id', matched_offer_id)
        
        # Calculate publisher payout (ALWAYS 80% of offer payout — standard platform margin)
        if offer:
            offer_payout = float(offer.get('payout', 0))
            revenue_share_percent = offer.get('revenue_share_percent', 0)
            if revenue_share_percent and float(revenue_share_percent) > 0 and upward_payout > 0:
                # Revenue share: percentage of upward payout
                publisher_payout = round(upward_payout * (float(revenue_share_percent) / 100), 2)
            else:
                # Standard: publisher gets 80% of offer's payout
                publisher_payout = round(offer_payout * 0.8, 2)
        elif upward_payout > 0:
            publisher_payout = round(upward_payout * 0.8, 2)
        else:
            publisher_payout = 0
        
        # Sanitize transaction_id — cpamerchant sometimes sends unreplaced macros
        if transaction_id and (transaction_id.startswith('{') or transaction_id == publisher_username):
            transaction_id = ''
        
        logger.info(f"  💰 Publisher payout: ${publisher_payout} (offer payout: ${offer.get('payout', 0) if offer else 'N/A'}, upward: ${upward_payout})")
        
        # Create conversion
        conversion_id = f"CONV-{secrets.token_hex(6).upper()}"
        
        conv_data = {
            'conversion_id': conversion_id,
            'click_id': click.get('click_id', 'unknown') if click else 'unknown',
            'transaction_id': transaction_id,
            'offer_id': matched_offer_id or 'unknown',
            'user_id': user_id,
            'affiliate_id': user_id,
            'status': 'approved',
            'payout': upward_payout,
            'publisher_payout': publisher_payout,
            'currency': 'USD',
            'country': click.get('country', 'Unknown') if click else 'Unknown',
            'country_code': click.get('country_code', '') if click else '',
            'device_type': click.get('device_type', 'unknown') if click else 'unknown',
            'ip_address': unmatched.get('ip_address', ''),
            'sub_id1': click.get('sub_id1', '') if click else '',
            'sub_id2': click.get('sub_id2', '') if click else '',
            'sub_id3': click.get('sub_id3', '') if click else '',
            'conversion_time': unmatched.get('timestamp', datetime.utcnow()),
            'raw_postback': merged,
            'postback_id': str(unmatched['_id']),
            'partner_id': unmatched.get('partner_id'),
            'partner_name': unmatched.get('partner_name'),
            'source': 'postback',
            'verified': True,
            'matched_by': 'migration_may11_fix',
        }
        conversions_collection.insert_one(conv_data)
        logger.info(f"  ✅ Created conversion: {conversion_id}")
        
        # Mark postback as processed
        received_postbacks.update_one(
            {'_id': unmatched['_id']},
            {'$set': {
                'status': 'processed',
                'conversion_id': conversion_id,
                'matched_by': 'migration_may11_fix',
                'fixed_at': datetime.utcnow()
            }}
        )
        
        # Mark click as converted
        if click:
            clicks_collection.update_one(
                {'click_id': click['click_id']},
                {'$set': {'converted': True, 'postback_received': True, 'postback_revenue': upward_payout}}
            )
        
        # Forward postback to publisher
        forward_status = 'no_url'
        forward_url = ''
        response_code = 0
        
        if publisher_postback_url:
            offer_name = offer.get('name', '') if offer else ''
            macros = {
                '{click_id}': click.get('click_id', '') if click else '',
                '{conversion_id}': conversion_id,
                '{transaction_id}': transaction_id,
                '{status}': 'approved',
                '{payout}': str(publisher_payout),
                '{points}': str(publisher_payout),
                '{amount}': str(publisher_payout),
                '{reward}': str(publisher_payout),
                '{offer_id}': matched_offer_id or '',
                '{offer_name}': offer_name,
                '{user_id}': user_id,
                '{username}': publisher_username,
                '{publisher_id}': publisher_id,
                '{sub_id1}': click.get('sub_id1', '') if click else '',
                '{sub_id2}': click.get('sub_id2', '') if click else '',
                '{sub_id3}': click.get('sub_id3', '') if click else '',
                '{sub1}': click.get('sub_id1', '') if click else '',
                '{sub2}': click.get('sub_id2', '') if click else '',
                '{sub3}': click.get('sub_id3', '') if click else '',
                '{user_ip}': click.get('ip_address', '') if click else '',
                '{ip}': click.get('ip_address', '') if click else '',
                '{country}': click.get('country', '') if click else '',
            }
            forward_url = publisher_postback_url
            for macro, value in macros.items():
                forward_url = forward_url.replace(macro, str(value))
            
            try:
                resp = req_lib.get(forward_url, timeout=10)
                response_code = resp.status_code
                forward_status = 'success' if resp.status_code == 200 else 'failed'
                logger.info(f"  📤 Forwarded to {publisher_username}: status={resp.status_code}")
            except Exception as send_err:
                forward_status = 'failed'
                logger.error(f"  ❌ Forward failed: {send_err}")
        else:
            logger.info(f"  📝 No postback URL for {publisher_username}")
        
        # Create forwarded_postbacks record
        if forwarded_postbacks_col is not None:
            fwd_record = {
                'timestamp': unmatched.get('timestamp', datetime.utcnow()),
                'original_postback_id': unmatched['_id'],
                'received_postback_id': str(unmatched['_id']),
                'publisher_id': publisher_id,
                'publisher_name': publisher_username,
                'username': publisher_username,
                'end_user_id': user_id,
                'points': publisher_payout,
                'forward_url': forward_url,
                'forward_status': forward_status,
                'response_code': response_code,
                'original_params': params,
                'placement_id': click.get('placement_id', '') if click else '',
                'placement_title': 'Unknown',
                'offer_id': matched_offer_id or 'unknown',
                'offer_name': offer.get('name', 'Unknown Offer') if offer else 'Unknown Offer',
                'click_id': click.get('click_id', 'unknown') if click else 'unknown',
                'source': 'verified_postback_migration_may11',
                'conversion_id': conversion_id,
                'transaction_id': transaction_id,
                'country': click.get('country', '') if click else '',
                'device_type': click.get('device_type', '') if click else '',
                'ip_address': click.get('ip_address', '') if click else '',
            }
            forwarded_postbacks_col.insert_one(fwd_record)
            logger.info(f"  ✅ Created forwarded_postbacks record")
        
        # Award points to publisher
        if publisher_payout > 0:
            # Initialize total_points if None
            users_collection.update_one(
                {'_id': ObjectId(user_id), 'total_points': None},
                {'$set': {'total_points': 0}}
            )
            users_collection.update_one(
                {'_id': ObjectId(user_id)},
                {'$inc': {'total_points': publisher_payout}, '$set': {'updated_at': datetime.utcnow()}}
            )
            logger.info(f"  💰 Awarded ${publisher_payout} to {publisher_username}")
            total_points_awarded += publisher_payout
            
            # Record points transaction
            if pts_col is not None:
                pts_col.insert_one({
                    'username': publisher_username,
                    'user_id': user_id,
                    'points': publisher_payout,
                    'type': 'offer_completion',
                    'offer_id': matched_offer_id or '',
                    'click_id': click.get('click_id', '') if click else '',
                    'conversion_id': conversion_id,
                    'received_postback_id': str(unmatched['_id']),
                    'timestamp': datetime.utcnow(),
                    'status': 'completed',
                    'source': 'verified_postback_migration_may11',
                })
            
            # Referral P2 commission
            try:
                from models.referral import Referral
                ref_model = Referral()
                if publisher_user.get('referred_by'):
                    ref_model.update_p2_revenue(user_id, publisher_payout)
            except:
                pass
        
        fixed_count += 1
    
    logger.info(f"\n{'='*60}")
    logger.info(f"🎉 MIGRATION COMPLETE")
    logger.info(f"   Fixed: {fixed_count}/{len(unmatched_postbacks)} postbacks")
    logger.info(f"   Total points awarded: ${total_points_awarded}")
    logger.info(f"{'='*60}")
    
    # Show final user balance
    if unmatched_postbacks:
        first_user_id = (unmatched_postbacks[0].get('query_params', {}).get('user_id') or 
                        unmatched_postbacks[0].get('query_params', {}).get('affiliate_id'))
        if first_user_id:
            try:
                user = users_collection.find_one({'_id': ObjectId(first_user_id)})
                if user:
                    logger.info(f"   {user.get('username')}'s current balance: ${user.get('total_points', 0)}")
            except:
                pass


if __name__ == '__main__':
    fix_unmatched_cpamerchant_may11()
