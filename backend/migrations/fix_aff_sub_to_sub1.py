"""
Migration: Change aff_sub={user_id} to aff_sub={sub1} and remove aff_sub2={sub1}
in all offer URLs for target networks.

Reason: We don't want to share publisher's user_id with upward partners.
Instead, we send the end user (sub1) in aff_sub.

Networks: Innovate, LeadAds, Chameleon, CPA Merchant, Quiver

Usage:
    python migrations/fix_aff_sub_to_sub1.py          # Dry run
    python migrations/fix_aff_sub_to_sub1.py --apply  # Apply
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import db_instance
import re

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
    'qiver',
]


def run_migration(dry_run=True):
    offers_collection = db_instance.get_collection('offers')
    if offers_collection is None:
        print("❌ Cannot connect to database")
        return

    network_pattern = '|'.join([re.escape(n) for n in TARGET_NETWORKS])
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

        new_url = target_url
        changed = False

        # 1. Replace aff_sub={user_id} with aff_sub={sub1}
        if 'aff_sub={user_id}' in new_url:
            new_url = new_url.replace('aff_sub={user_id}', 'aff_sub={sub1}')
            changed = True

        # 2. Remove &aff_sub2={sub1} (it's no longer needed)
        if '&aff_sub2={sub1}' in new_url:
            new_url = new_url.replace('&aff_sub2={sub1}', '')
            changed = True
        if '?aff_sub2={sub1}&' in new_url:
            new_url = new_url.replace('aff_sub2={sub1}&', '')
            changed = True
        if '?aff_sub2={sub1}' in new_url:
            new_url = new_url.replace('?aff_sub2={sub1}', '')
            changed = True

        if not changed:
            skipped_count += 1
            continue

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
    print(f"   Total offers: {len(offers)}")
    print(f"   Updated: {updated_count}")
    print(f"   Skipped (no change needed): {skipped_count}")

    if dry_run:
        print(f"\n⚠️  DRY RUN — run with --apply to update.")
    else:
        print(f"\n✅ Done! {updated_count} offer URLs updated.")


if __name__ == '__main__':
    apply = '--apply' in sys.argv
    if apply:
        print("🚀 APPLYING: Changing aff_sub={user_id} → aff_sub={sub1}, removing aff_sub2...")
    else:
        print("👀 DRY RUN: Preview changes...")
    print("=" * 60)
    run_migration(dry_run=not apply)
