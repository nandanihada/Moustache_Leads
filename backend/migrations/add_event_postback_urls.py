"""
Migration: Add event_postback_urls to existing partners
Generates the 4 standard event-typed postback URLs for each partner
(complete, terminate, quotafull, security)
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import db_instance

def run():
    partners_col = db_instance.get_collection('partners')
    if partners_col is None:
        print("❌ Could not connect to database")
        return
    
    standard_event_types = ['complete', 'terminate', 'quotafull', 'security']
    
    # Find all partners that don't have event_postback_urls yet
    partners = list(partners_col.find({
        'unique_postback_key': {'$exists': True, '$ne': None},
        '$or': [
            {'event_postback_urls': {'$exists': False}},
            {'event_postback_urls': None}
        ]
    }))
    
    print(f"Found {len(partners)} partners to update")
    
    updated = 0
    for partner in partners:
        unique_key = partner.get('unique_postback_key')
        if not unique_key:
            continue
        
        parameter_mapping = partner.get('parameter_mapping', {})
        base_url = f"https://postback.moustacheleads.com/postback/{unique_key}"
        
        event_postback_urls = {}
        for evt in standard_event_types:
            evt_base = f"{base_url}/{evt}"
            if parameter_mapping:
                params_list = [f"{our_param}={{{their_param}}}" for their_param, our_param in parameter_mapping.items()]
                event_postback_urls[evt] = f"{evt_base}?{'&'.join(params_list)}"
            else:
                event_postback_urls[evt] = evt_base
        
        partners_col.update_one(
            {'_id': partner['_id']},
            {'$set': {
                'event_postback_urls': event_postback_urls,
                'redirect_mode': False,
                'redirect_url': ''
            }}
        )
        updated += 1
        print(f"  ✅ Updated: {partner.get('partner_name', 'Unknown')} ({unique_key[:8]}...)")
    
    print(f"\n✅ Done! Updated {updated} partners with event_postback_urls")

if __name__ == '__main__':
    run()
