"""
Add SB1, TYP, OID parameters to all existing AdscendMedia offer URLs.
Appends &SB1={sub1}&TYP={sub_id1}&OID={offer_id} to target_url for all adscendmedia offers.

Run once: python migrations/add_params_to_adscendmedia_offers.py
"""
import sys
sys.path.insert(0, '.')
from database import db_instance
from urllib.parse import urlparse, parse_qs

def add_params():
    offers_col = db_instance.get_collection('offers')
    
    # Find all adscendmedia offers
    query = {'network': 'adscendmedia', 'target_url': {'$exists': True, '$ne': ''}}
    offers = list(offers_col.find(query, {'_id': 1, 'target_url': 1, 'name': 1, 'campaign_id': 1}))
    
    print(f"Found {len(offers)} adscendmedia offers to update")
    
    updated = 0
    skipped = 0
    
    for offer in offers:
        url = offer.get('target_url', '')
        if not url:
            skipped += 1
            continue
        
        # Check if params already exist
        if 'SB1=' in url and 'TYP=' in url and 'OID=' in url:
            skipped += 1
            continue
        
        # Append params
        separator = '&' if '?' in url else '?'
        params_to_add = []
        
        if 'SB1=' not in url:
            params_to_add.append('SB1={sub1}')
        if 'TYP=' not in url:
            params_to_add.append('TYP={sub_id1}')
        if 'OID=' not in url:
            params_to_add.append('OID={offer_id}')
        
        if not params_to_add:
            skipped += 1
            continue
        
        new_url = url + separator + '&'.join(params_to_add)
        
        offers_col.update_one(
            {'_id': offer['_id']},
            {'$set': {'target_url': new_url}}
        )
        updated += 1
    
    print(f"✅ Updated {updated} offers with SB1/TYP/OID params")
    print(f"⏭️ Skipped {skipped} (already had params or empty URL)")

if __name__ == '__main__':
    add_params()
