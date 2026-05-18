"""
Migration: Fix Mobplus (m2888.net) offer macros
================================================
Problem: Mobplus offers have {CLICK_ID} and {SOURCE} in target URLs,
         but our macro service only supports lowercase {click_id} and {sub1}.
         
Fix: Replace {CLICK_ID} → {click_id} and {SOURCE} → {sub1} in all
     m2888.net offer target_urls.

Usage:
    # Dry run (preview changes without saving):
    python migrations/fix_mobplus_macros.py
    
    # Apply changes:
    python migrations/fix_mobplus_macros.py --apply
"""

import sys
import os
import re

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import db_instance


def fix_mobplus_macros(dry_run=True):
    """
    Find all offers with m2888.net URLs and fix their macros.
    
    Replacements:
        {CLICK_ID} → {click_id}
        {SOURCE}   → {sub1}
    """
    offers_col = db_instance.get_collection('offers')
    if offers_col is None:
        print("❌ Could not connect to offers collection")
        return
    
    # Find all offers with m2888.net in target_url
    query = {
        'target_url': {'$regex': 'm2888\\.net', '$options': 'i'}
    }
    
    mobplus_offers = list(offers_col.find(query, {
        'offer_id': 1,
        'name': 1,
        'target_url': 1,
        'network': 1,
        'status': 1
    }))
    
    print(f"\n{'='*60}")
    print(f"  Mobplus (m2888.net) Macro Fix Migration")
    print(f"  Mode: {'DRY RUN (no changes)' if dry_run else '⚠️  APPLYING CHANGES'}")
    print(f"{'='*60}")
    print(f"\n📊 Found {len(mobplus_offers)} offers with m2888.net URLs\n")
    
    if not mobplus_offers:
        print("✅ No offers to fix. Exiting.")
        return
    
    updated_count = 0
    skipped_count = 0
    already_correct = 0
    
    for offer in mobplus_offers:
        offer_id = offer.get('offer_id', str(offer.get('_id', '')))
        name = offer.get('name', 'Unknown')
        original_url = offer.get('target_url', '')
        status = offer.get('status', 'unknown')
        
        if not original_url:
            skipped_count += 1
            continue
        
        # Apply replacements
        new_url = original_url
        new_url = new_url.replace('{CLICK_ID}', '{click_id}')
        new_url = new_url.replace('{SOURCE}', '{sub1}')
        
        # Also handle other common uppercase variants just in case
        new_url = new_url.replace('{SUBID}', '{sub1}')
        new_url = new_url.replace('{SUB_ID}', '{sub1}')
        new_url = new_url.replace('{PUBLISHER_ID}', '{publisher_id}')
        new_url = new_url.replace('{USER_ID}', '{user_id}')
        
        if new_url == original_url:
            already_correct += 1
            continue
        
        # Show the change
        print(f"  [{status.upper():8s}] {offer_id} — {name[:40]}")
        print(f"    BEFORE: {original_url}")
        print(f"    AFTER:  {new_url}")
        print()
        
        if not dry_run:
            result = offers_col.update_one(
                {'_id': offer['_id']},
                {'$set': {'target_url': new_url}}
            )
            if result.modified_count > 0:
                updated_count += 1
            else:
                skipped_count += 1
        else:
            updated_count += 1
    
    print(f"\n{'='*60}")
    print(f"  SUMMARY")
    print(f"{'='*60}")
    print(f"  Total m2888.net offers found: {len(mobplus_offers)}")
    print(f"  Already correct (no change):  {already_correct}")
    print(f"  {'Would update' if dry_run else 'Updated'}:       {updated_count}")
    print(f"  Skipped (no URL/error):       {skipped_count}")
    
    if dry_run and updated_count > 0:
        print(f"\n  ⚠️  Run with --apply to save changes:")
        print(f"     python migrations/fix_mobplus_macros.py --apply")
    elif not dry_run and updated_count > 0:
        print(f"\n  ✅ Successfully updated {updated_count} offers!")
    
    print()


if __name__ == '__main__':
    apply = '--apply' in sys.argv
    fix_mobplus_macros(dry_run=not apply)
