#!/usr/bin/env python3
"""
Migration: Add ?sub1={sub1} to all Triod offers' target URLs.

Triod offers have target URLs like: https://www.td3j0sk.com/2FG76C3B/LGWHGWC/
This script appends ?sub1={sub1} so they become: https://www.td3j0sk.com/2FG76C3B/LGWHGWC/?sub1={sub1}

Only updates offers that:
1. Have 'triod' in their network name (case-insensitive) OR target_url contains 'td3j0sk.com'
2. Don't already have 'sub1' in the URL
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import db_instance
from datetime import datetime

def run_migration(dry_run=True):
    print(f"{'[DRY RUN] ' if dry_run else ''}Adding ?sub1={{sub1}} to Triod offers...")
    print("=" * 60)
    
    offers_col = db_instance.get_collection('offers')
    if offers_col is None:
        print("ERROR: Could not connect to database")
        return
    
    # Find Triod offers: match by network name OR by target URL domain
    query = {
        '$or': [
            {'network': {'$regex': 'triod', '$options': 'i'}},
            {'target_url': {'$regex': 'td3j0sk\\.com', '$options': 'i'}}
        ]
    }
    
    triod_offers = list(offers_col.find(query, {
        'offer_id': 1, 'name': 1, 'target_url': 1, 'network': 1, 'status': 1
    }))
    
    print(f"Found {len(triod_offers)} Triod offers total.")
    
    updated = 0
    skipped = 0
    
    for offer in triod_offers:
        offer_id = offer.get('offer_id', 'N/A')
        name = offer.get('name', 'N/A')
        target_url = offer.get('target_url', '')
        
        if not target_url:
            print(f"  SKIP [{offer_id}] {name} — no target_url")
            skipped += 1
            continue
        
        # Check if sub1 is already in the URL
        if 'sub1' in target_url.lower():
            print(f"  SKIP [{offer_id}] {name} — already has sub1 in URL")
            skipped += 1
            continue
        
        # Append ?sub1={sub1} (or &sub1={sub1} if URL already has query params)
        if '?' in target_url:
            new_url = target_url + '&sub1={sub1}'
        else:
            new_url = target_url + '?sub1={sub1}'
        
        print(f"  UPDATE [{offer_id}] {name}")
        print(f"    OLD: {target_url}")
        print(f"    NEW: {new_url}")
        
        if not dry_run:
            offers_col.update_one(
                {'_id': offer['_id']},
                {'$set': {
                    'target_url': new_url,
                    'target_url_before_sub1_migration': target_url,
                    'sub1_migration_date': datetime.utcnow()
                }}
            )
        
        updated += 1
    
    print("\n" + "=" * 60)
    print(f"Results: {updated} updated, {skipped} skipped")
    
    if dry_run:
        print("\n⚠️  This was a DRY RUN. No changes were made.")
        print("Run with --apply to make changes: python migrations/add_sub1_to_triod_offers.py --apply")


if __name__ == '__main__':
    apply = '--apply' in sys.argv
    run_migration(dry_run=not apply)
