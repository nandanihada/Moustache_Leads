"""FAST bulk refine: Get all unrefined offers in one query, update in bulk"""
import sys, os, datetime
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from dotenv import load_dotenv
load_dotenv()
from database import db_instance
from services.description_refiner_service import _fallback_parse

col = db_instance.get_collection('offers')

# Single query: all active offers WITHOUT refined_description
print("Finding all unrefined active offers...")
offers = list(col.find(
    {'is_active': True, '$or': [{'refined_description': {'$exists': False}}, {'refined_description': None}]},
    {'offer_id': 1, 'name': 1, 'description': 1, 'payout': 1, '_id': 0}
).limit(2000))

print(f"Found {len(offers)} offers to refine")

if len(offers) == 0:
    print("All done!")
    sys.exit(0)

# Bulk process
from pymongo import UpdateOne
bulk_ops = []
for offer in offers:
    oid = offer.get('offer_id', '')
    if not oid:
        continue
    refined = _fallback_parse(offer.get('name', ''), offer.get('description', ''), float(offer.get('payout', 0) or 0))
    bulk_ops.append(UpdateOne(
        {'offer_id': oid},
        {'$set': {'refined_description': refined, 'refined_at': datetime.datetime.now(datetime.timezone.utc)}}
    ))

# Execute in batches of 500
print(f"Executing {len(bulk_ops)} updates in bulk...")
for i in range(0, len(bulk_ops), 500):
    batch = bulk_ops[i:i+500]
    result = col.bulk_write(batch)
    print(f"  Batch {i//500 + 1}: {result.modified_count} modified")

print(f"\n✅ Done! Refined {len(bulk_ops)} offers with fallback parser")
