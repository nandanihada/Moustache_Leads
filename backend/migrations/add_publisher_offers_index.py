"""
URGENT: Add optimized index for publisher offers query that's timing out.

This creates a compound index that covers the exact query + sort pattern used by
GET /offers/available endpoint.

Run from backend/ directory:
    python migrations/add_publisher_offers_index.py

Also sets 'deleted' field to False on documents where it doesn't exist,
so the query can use {deleted: {$ne: true}} efficiently with the index.
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from pymongo import ASCENDING, DESCENDING
import logging

logging.basicConfig(level=logging.INFO, format='%(message)s', force=True)


def run():
    from database import db_instance

    if not db_instance.is_connected():
        db_instance.connect()

    if not db_instance.is_connected():
        print("❌ Database not connected")
        return

    db = db_instance.get_db()
    offers = db['offers']

    print("=" * 50)
    print("STEP 1: Backfill 'deleted' field where missing")
    print("=" * 50)

    # Set deleted=False on docs where field doesn't exist
    # This allows {deleted: {$ne: true}} to use an index efficiently
    result = offers.update_many(
        {'deleted': {'$exists': False}},
        {'$set': {'deleted': False}}
    )
    print(f"  Updated {result.modified_count} documents (set deleted=False)")

    print()
    print("=" * 50)
    print("STEP 2: Create optimized compound indexes")
    print("=" * 50)

    # Primary index: covers the main publisher offers query + sort
    try:
        offers.create_index(
            [
                ('status', ASCENDING),
                ('deleted', ASCENDING),
                ('is_pinned', DESCENDING),
                ('pinned_at', DESCENDING),
                ('created_at', DESCENDING)
            ],
            name='idx_publisher_offers_optimized',
            background=True
        )
        print("  ✅ Created idx_publisher_offers_optimized")
    except Exception as e:
        print(f"  ⚠️  idx_publisher_offers_optimized: {e}")

    # Secondary: for search queries (name regex still needs COLLSCAN but at least filtered)
    try:
        offers.create_index(
            [
                ('status', ASCENDING),
                ('deleted', ASCENDING),
                ('name', ASCENDING)
            ],
            name='idx_offers_status_deleted_name',
            background=True
        )
        print("  ✅ Created idx_offers_status_deleted_name")
    except Exception as e:
        print(f"  ⚠️  idx_offers_status_deleted_name: {e}")

    # Index for the pin expiry update_many
    try:
        offers.create_index(
            [
                ('is_pinned', ASCENDING),
                ('pin_expires_at', ASCENDING)
            ],
            name='idx_pin_expiry',
            background=True
        )
        print("  ✅ Created idx_pin_expiry")
    except Exception as e:
        print(f"  ⚠️  idx_pin_expiry: {e}")

    print()
    print("✅ Done! The publisher offers page should load much faster now.")
    print("   Deploy your backend and the new indexes will be used automatically.")


if __name__ == '__main__':
    run()
