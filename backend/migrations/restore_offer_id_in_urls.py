"""
URGENT FIX: Restore offer_id in target URLs.

The force_fix_offer_macros.py migration incorrectly removed the REAL offer_id 
(e.g. offer_id=8934) from URLs and replaced it with offer_id={cid} (a macro).

This script restores the real offer_id using the offer's campaign_id field.

It replaces: offer_id={cid} → offer_id=<actual_campaign_id>

Usage:
    python migrations/restore_offer_id_in_urls.py          # Dry run
    python migrations/restore_offer_id_in_urls.py --apply  # Apply
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
        'target_url': {'$regex': 'offer_id=\\{cid\\}'}
    }

    offers = list(offers_collection.find(query))
    print(f"📊 Found {len(offers)} offers that still have offer_id={{cid}}\n")

    updated_count = 0
    skipped_count = 0
    no_campaign_id = 0
    samples_shown = 0

    for i, offer in enumerate(offers):
        target_url = offer.get('target_url', '')
        offer_id = offer.get('offer_id', '')
        campaign_id = offer.get('campaign_id', '') or offer.get('external_offer_id', '')
        network = offer.get('network', '')
        name = offer.get('name', '')

        if not target_url:
            skipped_count += 1
            continue

        if 'offer_id={cid}' not in target_url:
            skipped_count += 1
            continue

        if not campaign_id:
            no_campaign_id += 1
            if samples_shown < 5:
                print(f"  ⚠️  [{network}] {offer_id} ({name}) — NO campaign_id to restore!")
                samples_shown += 1
            continue

        # Replace offer_id={cid} with offer_id=<actual_value>
        new_url = target_url.replace('offer_id={cid}', f'offer_id={campaign_id}')

        if dry_run and samples_shown < 10:
            print(f"  [{network}] {offer_id} ({name})")
            print(f"    campaign_id: {campaign_id}")
            print(f"    OLD: {target_url}")
            print(f"    NEW: {new_url}")
            print()
            samples_shown += 1
        elif not dry_run:
            try:
                offers_collection.update_one(
                    {'_id': offer['_id']},
                    {'$set': {'target_url': new_url}}
                )
                if (i + 1) % 50 == 0:
                    print(f"  ... updated {i + 1}/{len(offers)}")
            except Exception as e:
                print(f"  ❌ Error updating {offer_id}: {e}")
                import time
                time.sleep(2)  # Wait and retry
                try:
                    offers_collection.update_one(
                        {'_id': offer['_id']},
                        {'$set': {'target_url': new_url}}
                    )
                except Exception as e2:
                    print(f"  ❌ Retry also failed: {e2}")
                    continue

        updated_count += 1

    if dry_run and updated_count > 10:
        print(f"  ... and {updated_count - 10} more\n")

    print(f"{'=' * 60}")
    print(f"📋 Summary:")
    print(f"   Total offers with offer_id={{cid}}: {len(offers)}")
    print(f"   Fixed: {updated_count}")
    print(f"   Already correct: {skipped_count}")
    print(f"   Missing campaign_id (can't restore): {no_campaign_id}")

    if dry_run:
        print(f"\n⚠️  DRY RUN — run with --apply to fix.")
    else:
        print(f"\n✅ Done! {updated_count} offer URLs restored with real offer_id.")


if __name__ == '__main__':
    apply = '--apply' in sys.argv
    if apply:
        print("🚀 APPLYING: Restoring real offer_id in URLs...")
    else:
        print("👀 DRY RUN: Preview...")
    print("=" * 60)
    run_migration(dry_run=not apply)
