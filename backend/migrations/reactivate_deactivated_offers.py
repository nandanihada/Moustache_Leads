"""
URGENT FIX: Reactivate offers that were incorrectly deactivated by
the 'deactivate_searched_only_offers.py' migration.

These offers should be visible to publishers. Sets them back to 'active'.

Usage:
    python migrations/reactivate_deactivated_offers.py           # dry run (shows count)
    python migrations/reactivate_deactivated_offers.py --execute  # actually reactivate
"""

import sys
import os
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from database import db_instance


def run(execute=False):
    if not db_instance.is_connected():
        db_instance.connect()

    if not db_instance.is_connected():
        print("❌ Database not connected")
        return

    offers_col = db_instance.get_collection('offers')

    # Find all offers that were deactivated by the searched_only migration
    query = {
        'status': 'inactive',
        'deactivated_reason': 'no_interaction_searched_only'
    }

    count = offers_col.count_documents(query)
    print(f"Found {count} offers deactivated by 'no_interaction_searched_only' reason")

    if count == 0:
        # Also check for any inactive offers that are not deleted
        total_inactive = offers_col.count_documents({'status': 'inactive', 'deleted': {'$ne': True}})
        total_active = offers_col.count_documents({'status': {'$in': ['active', 'running', 'rotating']}, 'deleted': {'$ne': True}})
        print(f"\nCurrent stats:")
        print(f"  Active/Running/Rotating offers: {total_active}")
        print(f"  Inactive (not deleted) offers: {total_inactive}")
        print(f"\nNo offers with 'no_interaction_searched_only' reason found.")
        print("If offers are still missing, they may have been deactivated for another reason.")
        return

    # Show samples
    samples = list(offers_col.find(query, {'offer_id': 1, 'name': 1}).limit(10))
    print("\nSample offers to reactivate:")
    for s in samples:
        print(f"  {s.get('offer_id')} - {s.get('name', '')[:60]}")

    if not execute:
        print(f"\n=== DRY RUN — {count} offers would be reactivated. Pass --execute to apply. ===")
        return

    # Reactivate them
    result = offers_col.update_many(
        query,
        {
            '$set': {'status': 'active', 'updated_at': datetime.utcnow()},
            '$unset': {'deactivated_reason': ''}
        }
    )

    print(f"\n✅ DONE: Reactivated {result.modified_count} offers.")

    # Show new totals
    total_active = offers_col.count_documents({'status': {'$in': ['active', 'running', 'rotating']}, 'deleted': {'$ne': True}})
    print(f"Total active/running/rotating offers now: {total_active}")


if __name__ == '__main__':
    execute = '--execute' in sys.argv
    run(execute=execute)
