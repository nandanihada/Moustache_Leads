"""
Migration: Force add aff_sub={user_id}&aff_click_id={click_id} to ALL offers
that have URLs containing cpamerchant, go2jump (leadads), or go2cloud (chameleonads).

This uses URL-based matching (not the network field) to catch ALL offers regardless
of how the network name was stored (uppercase, lowercase, spaces, etc.)

Run: python migrations/fix_all_network_tracking_params.py
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import db_instance
from datetime import datetime

REQUIRED_PARAMS = {
    'aff_sub': '{user_id}',
    'aff_click_id': '{click_id}',
}

# Match by URL domain — this catches everything regardless of network field
URL_DOMAINS = [
    'cpamerchant.com',
    'go2jump.org',      # leadads
    'go2cloud.org',     # chameleonads
]


def url_has_param(url, param_name):
    return f'&{param_name}=' in url or f'?{param_name}=' in url


def add_params_to_url(url):
    if not url:
        return url, False
    modified = False
    for param_name, param_value in REQUIRED_PARAMS.items():
        if not url_has_param(url, param_name):
            separator = '&' if '?' in url else '?'
            url = f"{url}{separator}{param_name}={param_value}"
            modified = True
    return url, modified


def run():
    offers = db_instance.get_collection('offers')
    
    # Find ALL offers with these domains in target_url (case insensitive)
    url_regex = '|'.join(URL_DOMAINS)
    all_network_offers = list(offers.find({
        'target_url': {'$regex': url_regex, '$options': 'i'}
    }))
    
    print(f"Total offers with network URLs: {len(all_network_offers)}")
    
    # Find those missing params
    missing_aff_sub = []
    missing_aff_click_id = []
    needs_update = []
    
    for offer in all_network_offers:
        url = offer.get('target_url', '')
        if not url:
            continue
        
        has_sub = url_has_param(url, 'aff_sub')
        has_click = url_has_param(url, 'aff_click_id')
        
        if not has_sub:
            missing_aff_sub.append(offer.get('offer_id'))
        if not has_click:
            missing_aff_click_id.append(offer.get('offer_id'))
        if not has_sub or not has_click:
            needs_update.append(offer)
    
    print(f"Missing aff_sub: {len(missing_aff_sub)}")
    print(f"Missing aff_click_id: {len(missing_aff_click_id)}")
    print(f"Total needing update: {len(needs_update)}")
    
    if not needs_update:
        print("\nAll offers already have both params!")
        return
    
    # Show first 5 examples
    print(f"\nFirst 5 offers needing update:")
    for offer in needs_update[:5]:
        print(f"  {offer.get('offer_id')} | network={offer.get('network')} | URL={offer.get('target_url', '')[:80]}...")
    
    # Update them
    updated = 0
    for offer in needs_update:
        url = offer.get('target_url', '')
        new_url, was_modified = add_params_to_url(url)
        if was_modified:
            offers.update_one(
                {'_id': offer['_id']},
                {'$set': {
                    'target_url': new_url,
                    'tracking_params_updated': True,
                    'tracking_params_updated_at': datetime.utcnow()
                }}
            )
            updated += 1
    
    print(f"\nUpdated: {updated} offers")
    
    # Verify
    still_missing = offers.count_documents({
        'target_url': {'$regex': url_regex, '$options': 'i'},
        '$or': [
            {'target_url': {'$not': {'$regex': 'aff_sub='}}},
            {'target_url': {'$not': {'$regex': 'aff_click_id='}}}
        ]
    })
    print(f"Still missing after update: {still_missing}")


if __name__ == '__main__':
    run()
