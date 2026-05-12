"""
Migration: Fix unmatched cpamerchant postback (5/10/2026 3:28:27 PM)

This postback from cpamerchant only sent user_id=69a9a5e655f321cc19f6a74d
but no click_id, so it was marked as unmatched.

The click exists (publisher: ash, CLK-E2D03F09D609, offer ML-02242).
This script will:
1. Find the unmatched postback
2. Match it to the correct click using user_id
3. Create the conversion
4. Forward the postback (award publisher payout, not advertiser payout)
5. Update the postback status to processed
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import db_instance
from datetime import datetime
import secrets
import logging
import requests as req_lib

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def fix_unmatched_cpamerchant():
    """Fix the specific unmatched cpamerchant postback from 5/10/2026"""
    
    received_postbacks = db_instance.get_collection('received_postbacks')
    clicks_collection = db_instance.get_collection('clicks')
    conversions_collection = db_instance.get_collection('conversions')
    forwarded_postbacks_col = db_instance.get_collection('forwarded_postbacks')
    users_collection = db_instance.get_collection('users')
    offers_collection = db_instance.get_collection('offers')
    pts_col = db_instance.get_collection('points_transactions')
    
    # Find the unmatched cpamerchant postback with user_id=69a9a5e655f321cc19f6a74d
    unmatched = received_postbacks.find_one({
        'partner_name': 'cpamerchant',
        'status': 'unmatched',
        'query_params.user_id': '69a9a5e655f321cc19f6a74d'
    }, sort=[('timestamp', -1)])
    
    if not unmatched:
        logger.info("❌ No unmatched cpamerchant postback found with user_id=69a9a5e655f321cc19f6a74d")
        # Try broader search
        unmatched_list = list(received_postbacks.find({
            'partner_name': 'cpamerchant',
            'status': 'unmatched'
        }).sort('timestamp', -1).limit(5))
        
        if unmatched_list:
            logger.info(f"Found {len(unmatched_list)} unmatched cpamerchant postbacks:")
            for pb in unmatched_list:
                logger.info(f"  - {pb.get('timestamp')} | params: {pb.get('query_params')}")
                # Check if any has user_id in params
                params = pb.get('query_params', {})
                if params.get('user_id') == '69a9a5e655f321cc19f6a74d':
                    unmatched = pb
                    logger.info(f"  ✅ Found it!")
                    break
        
        if not unmatched:
            logger.error("Could not find the target postback. Exiting.")
            return
    
    logger.info(f"✅ Found unmatched postback: {unmatched['_id']}")
    logger.info(f"   Timestamp: {unmatched.get('timestamp')}")
    logger.info(f"   Params: {unmatched.get('query_params')}")
    
    user_id = '69a9a5e655f321cc19f6a74d'
    
    # Find the matching click - most recent unconverted click for this user
    click = clicks_collection.find_one(
        {'user_id': user_id, 'converted': {'$ne': True}},
        sort=[('click_time', -1)]
    )
    
    if not click:
        # Try finding any click for this user (even converted ones, pick most recent around postback time)
        click = clicks_collection.find_one(
            {'user_id': user_id},
            sort=[('click_time', -1)]
        )
    
    if not click:
        logger.error(f"❌ No click found for user_id={user_id}")
        return
    
    logger.info(f"✅ Found matching click: {click.get('click_id')}")
    logger.info(f"   Offer: {click.get('offer_id')} - {click.get('offer_name')}")
    logger.info(f"   Click time: {click.get('click_time')}")
    
    # Get the offer to calculate publisher payout (NOT advertiser payout)
    offer = offers_collection.find_one({'offer_id': click.get('offer_id')})
    if not offer:
        logger.error(f"❌ Offer not found: {click.get('offer_id')}")
        return
    
    # Calculate PUBLISHER payout (downward payout)
    upward_payout = float(unmatched.get('query_params', {}).get('payout', 0) or 0)
    
    # Use the offer's fixed payout for publisher (what we set for publishers)
    publisher_payout = float(offer.get('payout', 0))
    
    # If revenue_share_percent is set, calculate from upward payout
    revenue_share_percent = offer.get('revenue_share_percent', 0)
    if revenue_share_percent and float(revenue_share_percent) > 0 and upward_payout > 0:
        publisher_payout = round(upward_payout * (float(revenue_share_percent) / 100), 2)
        logger.info(f"💰 Revenue share: {upward_payout} × {revenue_share_percent}% = {publisher_payout}")
    else:
        logger.info(f"💰 Fixed publisher payout: {publisher_payout} (upward was: {upward_payout})")
    
    # Get publisher user info
    from bson import ObjectId
    publisher_user = users_collection.find_one({'_id': ObjectId(user_id)})
    if not publisher_user:
        logger.error(f"❌ Publisher user not found: {user_id}")
        return
    
    publisher_username = publisher_user.get('username', 'Unknown')
    publisher_postback_url = publisher_user.get('postback_url', '')
    
    logger.info(f"👤 Publisher: {publisher_username}")
    logger.info(f"💰 Publisher payout: ${publisher_payout}")
    logger.info(f"📤 Publisher postback URL: {publisher_postback_url or 'None'}")
    
    # Check if conversion already exists for this
    existing_conv = conversions_collection.find_one({
        'click_id': click.get('click_id'),
        'postback_id': str(unmatched['_id'])
    })
    if existing_conv:
        logger.info(f"⚠️ Conversion already exists: {existing_conv.get('conversion_id')} — skipping")
        return
    
    # Create conversion
    conversion_id = f"CONV-{secrets.token_hex(6).upper()}"
    
    merged_data = {}
    merged_data.update(unmatched.get('query_params', {}))
    merged_data.update(unmatched.get('post_data', {}))
    
    conversion_data = {
        'conversion_id': conversion_id,
        'click_id': click.get('click_id'),
        'transaction_id': merged_data.get('transaction_id', ''),
        'offer_id': click.get('offer_id'),
        'user_id': click.get('user_id'),
        'affiliate_id': click.get('affiliate_id'),
        'status': 'approved',
        'payout': upward_payout,
        'publisher_payout': publisher_payout,
        'currency': 'USD',
        'country': click.get('country') or unmatched.get('country') or 'Unknown',
        'country_code': click.get('country_code') or unmatched.get('country_code', ''),
        'city': click.get('city') or unmatched.get('city', ''),
        'region': click.get('region') or unmatched.get('region', ''),
        'device_type': click.get('device_type', 'unknown'),
        'ip_address': unmatched.get('ip_address'),
        'sub_id1': click.get('sub_id1'),
        'sub_id2': click.get('sub_id2'),
        'sub_id3': click.get('sub_id3'),
        'conversion_time': datetime.utcnow(),
        'raw_postback': merged_data,
        'custom_data': merged_data,
        'postback_id': str(unmatched['_id']),
        'partner_id': unmatched.get('partner_id'),
        'partner_name': unmatched.get('partner_name'),
        'source': 'postback',
        'verified': True,
        'matched_by': 'user_id_fallback_migration',
    }
    
    conversions_collection.insert_one(conversion_data)
    logger.info(f"✅ Created conversion: {conversion_id}")
    
    # Mark postback as processed
    received_postbacks.update_one(
        {'_id': unmatched['_id']},
        {'$set': {
            'status': 'processed',
            'conversion_id': conversion_id,
            'matched_by': 'user_id_fallback_migration',
            'fixed_at': datetime.utcnow()
        }}
    )
    logger.info(f"✅ Postback marked as processed")
    
    # Mark click as converted
    clicks_collection.update_one(
        {'click_id': click['click_id']},
        {'$set': {'converted': True, 'postback_received': True, 'postback_revenue': upward_payout}}
    )
    logger.info(f"✅ Click marked as converted")
    
    # Forward postback to publisher (if they have a postback URL)
    forward_status = 'no_url'
    forward_url = ''
    response_code = 0
    
    if publisher_postback_url:
        macros = {
            # Click & conversion identifiers
            '{click_id}': click.get('click_id', ''),
            '{conversion_id}': conversion_id,
            '{transaction_id}': merged_data.get('transaction_id', ''),
            '{trans}': merged_data.get('transaction_id', ''),
            
            # Status
            '{status}': 'approved',
            
            # Payout (publisher amount) — multiple naming conventions
            '{payout}': str(publisher_payout),
            '{points}': str(publisher_payout),
            '{payout_amount}': str(publisher_payout),
            '{amount}': str(publisher_payout),
            '{reward}': str(publisher_payout),
            
            # Offer info
            '{offer_id}': click.get('offer_id', ''),
            '{offer_name}': offer.get('name', ''),
            '{offerName}': offer.get('name', ''),
            
            # User/affiliate identifiers
            '{user_id}': user_id,
            '{affiliate_id}': user_id,
            '{aff_id}': user_id,
            '{publisher_id}': str(publisher_user['_id']),
            '{username}': publisher_username,
            
            # Sub IDs — multiple naming conventions
            '{sub_id1}': click.get('sub_id1', '') or '',
            '{sub_id2}': click.get('sub_id2', '') or '',
            '{sub_id3}': click.get('sub_id3', '') or '',
            '{sub1}': click.get('sub_id1', '') or '',
            '{sub2}': click.get('sub_id2', '') or '',
            '{sub3}': click.get('sub_id3', '') or '',
            '{aff_sub}': click.get('sub_id1', '') or '',
            '{aff_sub1}': click.get('sub_id1', '') or '',
            '{aff_sub2}': click.get('sub_id2', '') or '',
            '{aff_sub3}': click.get('sub_id3', '') or '',
            '{aff_sub4}': click.get('sub_id4', '') or '',
            '{aff_sub5}': click.get('sub_id5', '') or '',
            
            # IP address — multiple naming conventions
            '{user_ip}': click.get('ip_address', '') or '',
            '{ip}': click.get('ip_address', '') or '',
            '{ip_address}': click.get('ip_address', '') or '',
            
            # Geo
            '{country}': click.get('country', '') or '',
            '{country_code}': click.get('country_code', '') or '',
            
            # Device
            '{device}': click.get('device_type', '') or '',
            '{device_type}': click.get('device_type', '') or '',
        }
        forward_url = publisher_postback_url
        for macro, value in macros.items():
            forward_url = forward_url.replace(macro, str(value))
        
        try:
            resp = req_lib.get(forward_url, timeout=10)
            response_code = resp.status_code
            forward_status = 'success' if resp.status_code == 200 else 'failed'
            logger.info(f"📤 Forwarded to {publisher_username}: status={resp.status_code}, url={forward_url}")
        except Exception as send_err:
            forward_status = 'failed'
            logger.error(f"❌ Forward failed: {send_err}")
    else:
        logger.info(f"📝 No postback URL for {publisher_username} — skipping forward")
    
    # Create forwarded_postbacks record
    if forwarded_postbacks_col is not None:
        fwd_record = {
            'timestamp': datetime.utcnow(),
            'original_postback_id': unmatched['_id'],
            'received_postback_id': str(unmatched['_id']),
            'publisher_id': str(publisher_user['_id']),
            'publisher_name': publisher_username,
            'username': publisher_username,
            'end_user_id': user_id,
            'points': publisher_payout,
            'forward_url': forward_url,
            'forward_status': forward_status,
            'response_code': response_code,
            'original_params': unmatched.get('query_params', {}),
            'placement_id': click.get('placement_id', '') or click.get('sub_id1', ''),
            'placement_title': 'Unknown',
            'offer_id': click.get('offer_id', 'unknown'),
            'offer_name': offer.get('name', 'Unknown Offer'),
            'click_id': click.get('click_id', 'unknown'),
            'source': 'verified_postback_migration',
            'conversion_id': conversion_id,
            'transaction_id': merged_data.get('transaction_id', ''),
            'country': click.get('country', ''),
            'device_type': click.get('device_type', ''),
            'ip_address': click.get('ip_address', ''),
        }
        forwarded_postbacks_col.insert_one(fwd_record)
        logger.info(f"✅ Created forwarded_postbacks record (status={forward_status})")
    
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
        logger.info(f"💰 Awarded {publisher_payout} points to {publisher_username}")
        
        # Record points transaction
        if pts_col is not None:
            pts_col.insert_one({
                'username': publisher_username,
                'user_id': user_id,
                'points': publisher_payout,
                'type': 'offer_completion',
                'offer_id': click.get('offer_id'),
                'click_id': click.get('click_id'),
                'conversion_id': conversion_id,
                'received_postback_id': str(unmatched['_id']),
                'timestamp': datetime.utcnow(),
                'status': 'completed',
                'source': 'verified_postback_migration',
            })
            logger.info(f"✅ Points transaction recorded")
    
    logger.info(f"\n{'='*60}")
    logger.info(f"🎉 MIGRATION COMPLETE")
    logger.info(f"   Postback: {unmatched['_id']}")
    logger.info(f"   Click: {click.get('click_id')}")
    logger.info(f"   Conversion: {conversion_id}")
    logger.info(f"   Publisher: {publisher_username}")
    logger.info(f"   Publisher Payout: ${publisher_payout}")
    logger.info(f"   Forward Status: {forward_status}")
    logger.info(f"{'='*60}")


if __name__ == '__main__':
    fix_unmatched_cpamerchant()
