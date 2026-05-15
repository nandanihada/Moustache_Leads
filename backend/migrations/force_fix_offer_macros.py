"""
Migration: Force-fix ALL offer URLs for target networks.

For every offer from these networks, ensures the URL has ONLY:
  aff_sub={sub1}&aff_click_id={click_id}

Removes any: aff_sub={user_id}, aff_sub2={sub1}, or other macro variations.

Usage:
    python migrations/force_fix_offer_macros.py          # Dry run
    python migrations/force_fix_offer_macros.py --apply  # Apply
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import db_instance
import re
from urllib.parse import urlparse, parse_qs, urlencode, urlunparse

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

# Params to REMOVE from URLs (we'll re-add the correct ones)
PARAMS_TO_REMOVE = ['aff_sub', 'aff_sub2', 'aff_click_id', 'payout', 'status', 'offer_id']

# Params to ADD (correct macros)
PARAMS_TO_ADD = {
    'aff_sub': '{sub1}',
    'aff_click_id': '{click_id}',
    'payout': '{payout}',
    'status': '{status}',
    'offer_id': '{cid}',
}


def fix_url(target_url):
    """Remove old macros and add correct ones"""
    if not target_url:
        return target_url, False

    # Parse the URL
    parsed = urlparse(target_url)
    
    # Parse existing query params (keep them as raw strings to preserve {macros})
    # We can't use parse_qs because it URL-decodes, so work with raw query string
    query_string = parsed.query
    
    # Split into individual params
    existing_params = []
    if query_string:
        for part in query_string.split('&'):
            if '=' in part:
                key, value = part.split('=', 1)
                existing_params.append((key, value))
            else:
                existing_params.append((part, ''))
    
    # Remove the params we want to replace
    filtered_params = [(k, v) for k, v in existing_params if k not in PARAMS_TO_REMOVE]
    
    # Add the correct params
    for key, value in PARAMS_TO_ADD.items():
        filtered_params.append((key, value))
    
    # Rebuild query string (without URL encoding to keep {macros} readable)
    new_query = '&'.join([f"{k}={v}" for k, v in filtered_params])
    
    # Rebuild URL
    new_parsed = parsed._replace(query=new_query)
    new_url = urlunparse(new_parsed)
    
    return new_url, new_url != target_url


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
    print(f"📊 Found {len(offers)} offers from target networks\n")

    updated_count = 0
    skipped_count = 0
    samples_shown = 0

    for offer in offers:
        target_url = offer.get('target_url', '')
        offer_id = offer.get('offer_id', str(offer.get('_id', '')))
        network = offer.get('network', '')

        if not target_url:
            skipped_count += 1
            continue

        new_url, changed = fix_url(target_url)

        if not changed:
            skipped_count += 1
            continue

        if dry_run and samples_shown < 10:
            print(f"  [{network}] {offer_id}")
            print(f"    OLD: {target_url}")
            print(f"    NEW: {new_url}")
            print()
            samples_shown += 1
        elif not dry_run:
            offers_collection.update_one(
                {'_id': offer['_id']},
                {'$set': {'target_url': new_url}}
            )

        updated_count += 1

    if dry_run and updated_count > 10:
        print(f"  ... and {updated_count - 10} more\n")

    print(f"{'=' * 60}")
    print(f"📋 Summary:")
    print(f"   Total offers: {len(offers)}")
    print(f"   Will update: {updated_count}")
    print(f"   Already correct: {skipped_count}")

    if dry_run:
        print(f"\n⚠️  DRY RUN — run with --apply to update.")
    else:
        print(f"\n✅ Done! {updated_count} offer URLs fixed.")


if __name__ == '__main__':
    apply = '--apply' in sys.argv
    if apply:
        print("🚀 APPLYING: Force-fixing all offer URLs with correct macros...")
    else:
        print("👀 DRY RUN: Preview...")
    print("=" * 60)
    run_migration(dry_run=not apply)
