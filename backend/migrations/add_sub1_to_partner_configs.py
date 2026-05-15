"""
Migration: Add sub1 → aff_sub2 to partner offer_url_params for target networks.

This ensures that future offer imports from these networks will automatically
get &aff_sub2={sub1} appended to their URLs.

Networks: Innovate, LeadAds, Chameleon, CPA Merchant, Quiver

Usage:
    python migrations/add_sub1_to_partner_configs.py          # Dry run
    python migrations/add_sub1_to_partner_configs.py --apply  # Apply changes
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import db_instance
import re

# Partner names to update (case-insensitive matching)
TARGET_PARTNERS = [
    'innovate',
    'leadads',
    'lead ads',
    'chameleon',
    'chameleonads',
    'chameleon ads',
    'cpamerchant',
    'cpa merchant',
    'quiver',
]


def run_migration(dry_run=True):
    """Add sub1 → aff_sub2 mapping to partner offer_url_params"""
    
    partners_collection = db_instance.get_collection('partners')
    if partners_collection is None:
        print("❌ Cannot connect to database")
        return
    
    # Build regex pattern
    pattern = '|'.join([re.escape(n) for n in TARGET_PARTNERS])
    
    # Find matching partners
    query = {
        'partner_name': {'$regex': pattern, '$options': 'i'}
    }
    
    partners = list(partners_collection.find(query))
    print(f"📊 Found {len(partners)} matching partners")
    
    updated_count = 0
    skipped_count = 0
    
    for partner in partners:
        partner_name = partner.get('partner_name', 'Unknown')
        offer_url_params = partner.get('offer_url_params', [])
        
        # Check if sub1 → aff_sub2 already exists
        already_has_sub1 = any(
            p.get('our_field') == 'sub1' and p.get('their_param') == 'aff_sub2'
            for p in offer_url_params
        )
        
        if already_has_sub1:
            print(f"  ⏭️  {partner_name} — already has sub1 → aff_sub2, skipping")
            skipped_count += 1
            continue
        
        # Add the new mapping
        new_param = {'our_field': 'sub1', 'their_param': 'aff_sub2'}
        new_offer_url_params = offer_url_params + [new_param]
        
        if dry_run:
            print(f"  ✏️  {partner_name}")
            print(f"      Current params: {offer_url_params}")
            print(f"      Adding: {new_param}")
            print()
        else:
            partners_collection.update_one(
                {'_id': partner['_id']},
                {'$set': {'offer_url_params': new_offer_url_params}}
            )
            print(f"  ✅ {partner_name} — added sub1 → aff_sub2")
        
        updated_count += 1
    
    print(f"\n{'=' * 60}")
    print(f"📋 Summary:")
    print(f"   Partners found: {len(partners)}")
    print(f"   Updated: {updated_count}")
    print(f"   Skipped (already configured): {skipped_count}")
    
    if dry_run:
        print(f"\n⚠️  DRY RUN — no changes made. Run with --apply to update the database.")
    else:
        print(f"\n✅ Migration complete! {updated_count} partner configs updated.")


if __name__ == '__main__':
    apply = '--apply' in sys.argv
    
    if apply:
        print("🚀 APPLYING migration: Adding sub1 → aff_sub2 to partner configs...")
        print("=" * 60)
    else:
        print("👀 DRY RUN: Previewing changes (run with --apply to execute)")
        print("=" * 60)
    
    run_migration(dry_run=not apply)
