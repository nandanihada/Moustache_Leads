"""
Migration: Add ALL tracking macros to Quiver offer URLs.

Quiver offers have plain URLs with no macros at all.
This adds: &aff_sub={user_id}&aff_sub2={sub1}&aff_click_id={click_id}

Usage:
    python migrations/fix_quiver_offer_urls.py          # Dry run (preview)
    python migrations/fix_quiver_offer_urls.py --apply  # Apply changes
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import db_instance
import re


# Macros to add to Quiver offer URLs
MACROS_TO_ADD = 'aff_sub={user_id}&aff_sub2={sub1}&aff_click_id={click_id}'


def run_migration(dry_run=True):
    """Add tracking macros to all Quiver offer URLs"""

    offers_collection = db_instance.get_collection('offers')
    if offers_collection is None:
        print("❌ Cannot connect to database")
        return

    # Find all Quiver offers
    query = {
        'network': {'$regex': 'quiver', '$options': 'i'},
        'target_url': {'$exists': True, '$ne': ''}
    }

    offers = list(offers_collection.find(query))
    print(f"📊 Found {len(offers)} Quiver offers")

    updated_count = 0
    skipped_count = 0

    for offer in offers:
        target_url = offer.get('target_url', '')
        offer_id = offer.get('offer_id', str(offer.get('_id', '')))
        name = offer.get('name', '')

        if not target_url:
            skipped_count += 1
            continue

        # Skip if already has aff_sub= (means macros were already added)
        if 'aff_sub=' in target_url:
            skipped_count += 1
            continue

        # Add macros
        separator = '&' if '?' in target_url else '?'
        new_url = f"{target_url}{separator}{MACROS_TO_ADD}"

        if dry_run:
            print(f"  [{offer_id}] {name}")
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
    print(f"   Total Quiver offers: {len(offers)}")
    print(f"   Updated: {updated_count}")
    print(f"   Skipped (already has macros): {skipped_count}")

    if dry_run:
        print(f"\n⚠️  DRY RUN — no changes made. Run with --apply to update.")
    else:
        print(f"\n✅ Done! {updated_count} Quiver offer URLs updated with tracking macros.")


if __name__ == '__main__':
    apply = '--apply' in sys.argv

    if apply:
        print("🚀 APPLYING: Adding macros to Quiver offer URLs...")
        print("=" * 60)
    else:
        print("👀 DRY RUN: Preview (run with --apply to execute)")
        print("=" * 60)

    run_migration(dry_run=not apply)
