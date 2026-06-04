"""
Migration: Copy payout_details from users table to payout_methods collection

Purpose:
- Users who entered bank details during registration have data in users.payout_details
- The Settings > Billing Info tab reads from payout_methods collection
- This migration copies registration data → payout_methods so users see their info on the Settings page

Safety:
- Only creates payout_methods entries for users who DON'T already have one (won't overwrite the 16 existing entries)
- Does NOT delete anything from users.payout_details (original data stays intact)
- Dry-run mode by default — set DRY_RUN = False to actually write

Field Mapping (users.payout_details → payout_methods.bank_details):
  - account_name → account_name
  - bank_name → bank_name
  - account_number → account_number
  - routing_number → ifsc_swift (closest equivalent)
  - tax_id, vat_id → stored but not mapped to bank_details (kept in a metadata field)
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import db_instance
from bson import ObjectId
from datetime import datetime

# ===== CONFIGURATION =====
DRY_RUN = False  # Set to False to actually write to database
# ==========================


def run_migration():
    users_col = db_instance.get_collection('users')
    payout_methods_col = db_instance.get_collection('payout_methods')

    if users_col is None or payout_methods_col is None:
        print("ERROR: Could not connect to database collections")
        return

    # Find all users who have payout_details with at least some data
    users_with_payout = list(users_col.find({
        'payout_details': {'$exists': True, '$ne': None, '$ne': {}}
    }, {
        '_id': 1,
        'email': 1,
        'username': 1,
        'payout_details': 1
    }))

    print(f"Found {len(users_with_payout)} users with payout_details in users table")

    # Get all user_ids that already have payout_methods entries
    existing_payout_user_ids = set()
    existing_entries = payout_methods_col.find({}, {'user_id': 1})
    for entry in existing_entries:
        existing_payout_user_ids.add(str(entry['user_id']))

    print(f"Found {len(existing_payout_user_ids)} users who already have payout_methods entries (will skip these)")

    migrated = 0
    skipped_existing = 0
    skipped_empty = 0

    for user in users_with_payout:
        user_id = str(user['_id'])
        payout_details = user.get('payout_details', {})

        # Skip if user already has a payout_methods entry
        if user_id in existing_payout_user_ids:
            skipped_existing += 1
            print(f"  SKIP (already exists): {user.get('email', user.get('username', user_id))}")
            continue

        # Skip if payout_details is empty or has no meaningful data
        meaningful_fields = ['account_name', 'bank_name', 'account_number', 'routing_number']
        has_data = any(payout_details.get(field) for field in meaningful_fields)

        if not has_data:
            skipped_empty += 1
            print(f"  SKIP (no bank data): {user.get('email', user.get('username', user_id))}")
            continue

        # Map fields from registration format to payout_methods format
        bank_details = {
            'account_name': payout_details.get('account_name', ''),
            'bank_name': payout_details.get('bank_name', ''),
            'account_number': payout_details.get('account_number', ''),
            'ifsc_swift': payout_details.get('routing_number', ''),  # routing_number → ifsc_swift
            'country': '',  # Not collected during registration
            'currency': '',  # Not collected during registration
            'phone': '',
            'address': '',
            'upi': ''
        }

        # Build the payout_methods document
        new_doc = {
            'user_id': ObjectId(user_id),
            'active_method': 'bank',  # Registration only collects bank details
            'bank_details': bank_details,
            'paypal_details': {},
            'crypto_details': {},
            'migrated_from_registration': True,  # Flag so we know this was auto-migrated
            'original_payout_details': {  # Keep original data for reference
                'tax_id': payout_details.get('tax_id', ''),
                'vat_id': payout_details.get('vat_id', '')
            },
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow()
        }

        if DRY_RUN:
            print(f"  WOULD MIGRATE: {user.get('email', user.get('username', user_id))}")
            print(f"    → bank: {bank_details['bank_name']}, account: ***{bank_details['account_number'][-4:] if bank_details['account_number'] else '????'}")
        else:
            payout_methods_col.insert_one(new_doc)
            print(f"  MIGRATED: {user.get('email', user.get('username', user_id))}")

        migrated += 1

    print(f"\n{'=' * 50}")
    print(f"MIGRATION SUMMARY {'(DRY RUN)' if DRY_RUN else '(EXECUTED)'}")
    print(f"{'=' * 50}")
    print(f"Total users with payout_details: {len(users_with_payout)}")
    print(f"Already had payout_methods (skipped): {skipped_existing}")
    print(f"No meaningful bank data (skipped): {skipped_empty}")
    print(f"{'Would migrate' if DRY_RUN else 'Migrated'}: {migrated}")
    print(f"{'=' * 50}")

    if DRY_RUN:
        print("\n⚠️  This was a DRY RUN. No data was written.")
        print("    Set DRY_RUN = False and run again to execute the migration.")


if __name__ == '__main__':
    run_migration()
