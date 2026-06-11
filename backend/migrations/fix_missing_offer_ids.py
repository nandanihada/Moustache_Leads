"""
Migration: Fix offers that have missing or null offer_id field.

These offers show a MongoDB ObjectId on the offerwall instead of a proper ML-XXXXX id.
This script assigns them proper offer_ids.

Run with: python fix_missing_offer_ids.py
"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), '../.env'))

from database import db_instance
from datetime import datetime

def run():
    offers_col = db_instance.get_collection('offers')
    counter_col = db_instance.get_collection('counters')

    if offers_col is None:
        print("ERROR: Cannot connect to database")
        return

    # Find offers with missing or empty offer_id
    missing = list(offers_col.find({
        '$or': [
            {'offer_id': {'$exists': False}},
            {'offer_id': None},
            {'offer_id': ''},
        ]
    }, {'_id': 1, 'name': 1, 'campaign_id': 1, 'network': 1, 'offer_id': 1}))

    print(f"Found {len(missing)} offers with missing offer_id")

    if not missing:
        print("Nothing to fix!")
        return

    # Get current counter
    counter = counter_col.find_one({'_id': 'offer_counter'})
    current_seq = counter['sequence_value'] if counter else 0

    fixed = 0
    for offer in missing:
        # Check if campaign_id can be used as offer_id
        campaign_id = offer.get('campaign_id', '')
        if campaign_id and campaign_id.strip():
            new_offer_id = str(campaign_id).strip()
            source = 'campaign_id'
        else:
            # Assign new ML-XXXXX id
            current_seq += 1
            new_offer_id = f"ML-{current_seq:05d}"
            source = 'generated'

        result = offers_col.update_one(
            {'_id': offer['_id']},
            {'$set': {
                'offer_id': new_offer_id,
                'offer_id_fixed_at': datetime.utcnow(),
                'offer_id_fixed_from': source
            }}
        )

        if result.modified_count:
            print(f"  Fixed: '{offer.get('name', 'Unknown')}' → {new_offer_id} (from {source})")
            fixed += 1

    # Update counter if we generated new ids
    if current_seq > (counter['sequence_value'] if counter else 0):
        counter_col.update_one(
            {'_id': 'offer_counter'},
            {'$set': {'sequence_value': current_seq}},
            upsert=True
        )

    print(f"\nDone! Fixed {fixed} of {len(missing)} offers.")

if __name__ == '__main__':
    run()
