"""
Migration script to add traffic source fields to all existing offers
based on their category/vertical.
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from database import db_instance
from services.traffic_source_rules_service import TrafficSourceRulesService

def add_traffic_sources():
    """Add traffic source fields to all offers that don't have them"""
    offers = db_instance.get_collection('offers')
    
    if offers is None:
        print("Failed to connect to database")
        return
    
    # Find offers without traffic source fields
    query = {
        '$or': [
            {'allowed_traffic_sources': {'$exists': False}},
            {'allowed_traffic_sources': []},
            {'allowed_traffic_sources': None}
        ]
    }
    
    offers_to_update = list(offers.find(query))
    total = len(offers_to_update)
    
    print(f"Found {total} offers without traffic source fields")
    
    updated = 0
    for i, offer in enumerate(offers_to_update, 1):
        category = offer.get('vertical') or offer.get('category') or 'OTHER'
        
        # Generate traffic sources based on category
        rules = TrafficSourceRulesService.generate_traffic_sources(category=category)
        
        # Update the offer
        offers.update_one(
            {'_id': offer['_id']},
            {'$set': {
                'allowed_traffic_sources': rules['allowed'],
                'risky_traffic_sources': rules['risky'],
                'disallowed_traffic_sources': rules['disallowed']
            }}
        )
        updated += 1
        
        if i % 100 == 0:
            print(f"  Updated {i}/{total} offers...")
    
    print(f"\nUpdated {updated} offers with traffic source fields")

if __name__ == '__main__':
    add_traffic_sources()
