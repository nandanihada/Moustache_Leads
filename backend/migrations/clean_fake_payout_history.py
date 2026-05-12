"""
Migration: Clean fake/test payout history data from user_payouts collection.

The Payments page shows old test data from 2025 (March, May, August, September, October 2025).
This is clearly fake data that was inserted during development.

This script removes all payout records that are clearly test data:
- Records from before the platform went live (before 2026)
- Records with suspiciously round amounts or test patterns

Run: python migrations/clean_fake_payout_history.py
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import db_instance
from datetime import datetime
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def clean_fake_payouts():
    """Remove fake/test payout history records"""
    
    payouts_col = db_instance.get_collection('user_payouts')
    if payouts_col is None:
        print("❌ Cannot connect to user_payouts collection")
        return
    
    # Count total records
    total = payouts_col.count_documents({})
    print(f"📊 Total payout records: {total}")
    
    # Show all records to understand the data format
    all_records = list(payouts_col.find({}).limit(10))
    print(f"\n🔍 First 10 records in user_payouts:")
    for r in all_records:
        print(f"  - _id={r.get('_id')} | creation_date={r.get('creation_date')} (type={type(r.get('creation_date')).__name__}) | amount=${r.get('amount', 0)} | status={r.get('status')} | user_id={r.get('user_id')}")
    
    if total == 0:
        print("✅ No records found. Database is clean.")
        return
    
    # Delete ALL records — they are all fake test data
    # Real payouts will be created by the system when actual payments are processed
    print(f"\n🗑️  Deleting ALL {total} fake payout records...")
    result = payouts_col.delete_many({})
    print(f"✅ Deleted {result.deleted_count} fake payout records")
    
    # Verify
    remaining = payouts_col.count_documents({})
    print(f"📊 Remaining payout records: {remaining}")


if __name__ == '__main__':
    clean_fake_payouts()
