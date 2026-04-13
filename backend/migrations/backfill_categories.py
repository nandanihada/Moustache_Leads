"""
Migration: Backfill categories array for existing offers.

For each offer that doesn't have a 'categories' array, this script:
1. Uses the existing vertical/category as the primary category
2. Runs detect_categories_from_text on name+description to find up to 3 categories
3. Stores the result in the 'categories' field

Run from backend/: python migrations/backfill_categories.py
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from database import db_instance
from models.offer import detect_categories_from_text

def backfill():
    offers_col = db_instance.get_collection('offers')
    if offers_col is None:
        print("ERROR: Could not connect to database")
        return

    # Process ALL offers to re-detect categories with updated keywords
    cursor = offers_col.find({})

    total = 0
    updated = 0

    for offer in cursor:
        total += 1
        name = offer.get('name', '')
        description = offer.get('description', '')

        # Always re-detect categories from name/description with updated keywords
        categories = detect_categories_from_text(name, description)

        # Update the offer
        offers_col.update_one(
            {'_id': offer['_id']},
            {'$set': {
                'categories': categories,
                'vertical': categories[0],
                'category': categories[0]
            }}
        )
        updated += 1

        if updated % 100 == 0:
            print(f"  Processed {updated}/{total} offers...")

    print(f"\nDone! Processed {total} offers, updated {updated} with categories array.")


if __name__ == '__main__':
    print("=== Backfill Categories Migration ===")
    print("This will add a 'categories' array (up to 3) to all existing offers.\n")
    backfill()
