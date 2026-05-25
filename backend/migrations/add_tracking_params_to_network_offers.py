"""
Migration: Add aff_sub={user_id}&aff_click_id={click_id} to all offers from
cpamerchant, leadads, and chameleonads.

This ensures the networks can send back user_id and click_id in their postbacks,
enabling direct click matching instead of fallback matching.

Run: python migrations/add_tracking_params_to_network_offers.py
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import db_instance
from datetime import datetime
import logging
import re

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# The params we need to ensure are in every tracking URL
REQUIRED_PARAMS = {
    'aff_sub': '{user_id}',
    'aff_click_id': '{click_id}',
}

# Network URL patterns to match
NETWORK_PATTERNS = [
    'tracking.cpamerchant.com',
    'cpamerchant.com',
    'leadads.go2jump.org',
    'go2jump.org',
    'chameleonads.go2cloud.org',
    'go2cloud.org',
]

# Network names in the 'network' field
NETWORK_NAMES = ['']


def url_has_param(url, param_name):
    """Check if URL already has a specific parameter"""
    return f'&{param_name}=' in url or f'?{param_name}=' in url


def add_params_to_url(url):
    """Add missing tracking params to a URL"""
    if not url:
        return url, False
    
    modified = False
    for param_name, param_value in REQUIRED_PARAMS.items():
        if not url_has_param(url, param_name):
            # Add the parameter
            separator = '&' if '?' in url else '?'
            url = f"{url}{separator}{param_name}={param_value}"
            modified = True
    
    return url, modified


def run_migration():
    """Update all offers from the 3 networks to include tracking params"""
    
    offers_collection = db_instance.get_collection('offers')
    if offers_collection is None:
        logger.error("❌ Cannot connect to database")
        return
    
    # Find offers by network name OR by URL pattern
    network_query = {
        '$or': [
            {'network': {'$in': NETWORK_NAMES}},
            {'network': {'$regex': 'cpamerchant|leadads|chameleonads', '$options': 'i'}},
        ]
    }
    
    # Also find by target_url pattern
    url_patterns = '|'.join(NETWORK_PATTERNS)
    url_query = {'target_url': {'$regex': url_patterns, '$options': 'i'}}
    
    # Combine both queries
    combined_query = {'$or': [network_query, url_query]}
    
    all_offers = list(offers_collection.find(combined_query))
    logger.info(f"Found {len(all_offers)} offers from cpamerchant/leadads/chameleonads")
    
    updated_count = 0
    already_correct = 0
    skipped = 0
    
    for offer in all_offers:
        offer_id = offer.get('offer_id', 'unknown')
        target_url = offer.get('target_url', '')
        network = offer.get('network', '')
        
        if not target_url:
            skipped += 1
            continue
        
        # Check if URL is from one of our networks
        is_network_url = any(pattern in target_url.lower() for pattern in NETWORK_PATTERNS)
        
        if not is_network_url:
            skipped += 1
            continue
        
        # Add missing params
        new_url, was_modified = add_params_to_url(target_url)
        
        if not was_modified:
            already_correct += 1
            continue
        
        # Update the offer
        offers_collection.update_one(
            {'_id': offer['_id']},
            {'$set': {
                'target_url': new_url,
                'tracking_params_updated': True,
                'tracking_params_updated_at': datetime.utcnow()
            }}
        )
        updated_count += 1
        logger.info(f"  ✅ {offer_id} ({network}): added tracking params")
        logger.info(f"     Old: {target_url}")
        logger.info(f"     New: {new_url}")
    
    logger.info(f"\n{'='*60}")
    logger.info(f"🎉 MIGRATION COMPLETE")
    logger.info(f"   Total offers found: {len(all_offers)}")
    logger.info(f"   Updated: {updated_count}")
    logger.info(f"   Already correct: {already_correct}")
    logger.info(f"   Skipped (no URL or not network): {skipped}")
    logger.info(f"{'='*60}")


if __name__ == '__main__':
    run_migration()
