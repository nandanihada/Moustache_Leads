"""
TEST ONLY: Forward the postback to ash's URL without awarding points.
This just tests if the publisher's postback URL works with our macro replacement.
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import db_instance
from bson import ObjectId
import logging
import requests as req_lib

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def test_forward_to_ash():
    """Test forward postback to ash without awarding points"""
    
    clicks_collection = db_instance.get_collection('clicks')
    offers_collection = db_instance.get_collection('offers')
    users_collection = db_instance.get_collection('users')
    
    user_id = '69a9a5e655f321cc19f6a74d'
    
    # Get publisher info
    publisher_user = users_collection.find_one({'_id': ObjectId(user_id)})
    if not publisher_user:
        logger.error(f"❌ Publisher not found: {user_id}")
        return
    
    publisher_username = publisher_user.get('username', 'Unknown')
    publisher_postback_url = publisher_user.get('postback_url', '')
    
    logger.info(f"👤 Publisher: {publisher_username}")
    logger.info(f"📤 Postback URL from DB: {publisher_postback_url}")
    
    # Find the click
    click = clicks_collection.find_one(
        {'user_id': user_id},
        sort=[('click_time', -1)]
    )
    
    if not click:
        logger.error(f"❌ No click found for user_id={user_id}")
        return
    
    logger.info(f"🔗 Click: {click.get('click_id')}")
    logger.info(f"   Offer: {click.get('offer_id')} - {click.get('offer_name')}")
    logger.info(f"   sub_id1: {click.get('sub_id1')}")
    logger.info(f"   sub_id2: {click.get('sub_id2')}")
    logger.info(f"   sub_id3: {click.get('sub_id3')}")
    logger.info(f"   IP: {click.get('ip_address')}")
    
    # Get offer
    offer = offers_collection.find_one({'offer_id': click.get('offer_id')})
    offer_name = offer.get('name', 'Unknown') if offer else 'Unknown'
    publisher_payout = float(offer.get('payout', 0)) if offer else 0
    
    logger.info(f"💰 Publisher payout: {publisher_payout}")
    logger.info(f"📋 Offer name: {offer_name}")
    
    # Use the URL you provided
    test_url = "https://dollarhubs.com/pb/postback.php?user_id={aff_sub2}&points={payout_amount}&trans={sub1}&ip={ip}&offerName={offer_name}&status=1&offer_id=ML-02154&router=1"
    
    # Apply macros
    macros = {
        '{click_id}': click.get('click_id', ''),
        '{payout}': str(publisher_payout),
        '{points}': str(publisher_payout),
        '{payout_amount}': str(publisher_payout),
        '{amount}': str(publisher_payout),
        '{offer_id}': click.get('offer_id', ''),
        '{offer_name}': offer_name,
        '{offerName}': offer_name,
        '{user_id}': user_id,
        '{username}': publisher_username,
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
        '{ip}': click.get('ip_address', '') or '',
        '{user_ip}': click.get('ip_address', '') or '',
        '{ip_address}': click.get('ip_address', '') or '',
        '{country}': click.get('country', '') or '',
        '{trans}': '',  # No transaction_id from cpamerchant
        '{transaction_id}': '',
        '{status}': 'approved',
    }
    
    forward_url = test_url
    for macro, value in macros.items():
        forward_url = forward_url.replace(macro, str(value))
    
    logger.info(f"\n{'='*60}")
    logger.info(f"🧪 TEST FORWARD (no points awarded)")
    logger.info(f"   Original URL: {test_url}")
    logger.info(f"   Resolved URL: {forward_url}")
    logger.info(f"{'='*60}")
    
    # Fire the test
    try:
        resp = req_lib.get(forward_url, timeout=15)
        logger.info(f"📤 Response: status={resp.status_code}")
        logger.info(f"   Body: {resp.text[:500]}")
        
        if resp.status_code == 200:
            logger.info(f"✅ SUCCESS — Publisher's postback URL is working!")
        else:
            logger.warning(f"⚠️ Got non-200 response: {resp.status_code}")
    except Exception as e:
        logger.error(f"❌ Request failed: {e}")


if __name__ == '__main__':
    test_forward_to_ash()
