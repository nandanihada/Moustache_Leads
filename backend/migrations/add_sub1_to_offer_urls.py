"""
Migration: Add aff_sub2={sub1} to all offer URLs for specified networks.

Networks: Innovate, LeadAds, Chameleon, CPA Merchant, Quiver

This appends &aff_sub2={sub1} to the target_url of all offers from these networks
that don't already have aff_sub2 in their URL.

Usage:
    python migrations/add_sub1_to_offer_urls.py          # Dry run (preview changes)
    python migrations/add_sub1_to_offer_urls.py --apply  # Apply changes to DB
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import db_instance
from urllib.parse import urlparse, parse_qs
import re

# Networks to update (case-insensitive matching)
TARGET_NETWORKS = [
    'innovate',
    'leadads',
    'lead ads',
    'chameleon',
    'chameleonads',
    'chameleon ads',
    'cpamerchant',
    'cpa merchant',
    'quiver',
    'Qiver'
]

def run_migration(dry_run=True):
    """Add aff_sub2={sub1} to offer URLs for target networks"""
    
    offers_collection = db_instance.get_collection('offers')
    if offers_collection is None:
        print("❌ Cannot connect to database")
        return
    
    # Build regex pattern for network matching
    network_pattern = '|'.join([re.escape(n) for n in TARGET_NETWORKS])
    
    # Find all offers from target networks that have a target_url
    query = {
        'network': {'$regex': network_pattern, '$options': 'i'},
        'target_url': {'$exists': True, '$ne': ''}
    }
    
    offers = list(offers_collection.find(query))
    print(f"📊 Found {len(offers)} offers from target networks")
    
    updated_count = 0
    skipped_count = 0
    
    for offer in offers:
        target_url = offer.get('target_url', '')
        offer_id = offer.get('offer_id', str(offer.get('_id', '')))
        network = offer.get('network', '')
        
        if not target_url:
            skipped_count += 1
            continue
        
        # Skip if aff_sub2 already exists in the URL
        if 'aff_sub2=' in target_url or 'aff_sub2={sub1}' in target_url:
            skipped_count += 1
            continue
        
        # Skip if {sub1} is already present somewhere in the URL
        if '{sub1}' in target_url:
            skipped_count += 1
            continue
        
        # Append &aff_sub2={sub1} to the URL
        separator = '&' if '?' in target_url else '?'
        new_url = f"{target_url}{separator}aff_sub2={{sub1}}"
        
        if dry_run:
            print(f"  [{network}] {offer_id}")
            print(f"    OLD: {target_url}")
            print(f"    NEW: {new_url}")
            print()
        else:
            offers_collection.update_one(
                {'_id': offer['_id']},
                {'$set': {'target_url': new_url}}
            )
        
        updated_count += 1
    
    print(f"\n{'=' * 60}")
    print(f"📋 Summary:")
    print(f"   Total offers found: {len(offers)}")
    print(f"   Updated: {updated_count}")
    print(f"   Skipped (already has aff_sub2 or {'{sub1}'}): {skipped_count}")
    
    if dry_run:
        print(f"\n⚠️  DRY RUN — no changes made. Run with --apply to update the database.")
    else:
        print(f"\n✅ Migration complete! {updated_count} offer URLs updated.")


if __name__ == '__main__':
    apply = '--apply' in sys.argv
    
    if apply:
        print("🚀 APPLYING migration: Adding aff_sub2={sub1} to offer URLs...")
        print("=" * 60)
    else:
        print("👀 DRY RUN: Previewing changes (run with --apply to execute)")
        print("=" * 60)
    
    run_migration(dry_run=not apply)
