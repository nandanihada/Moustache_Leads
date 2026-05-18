"""
Diagnose why offers aren't visible and fix them.
Run: python migrations/diagnose_and_fix_offers.py
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from database import db_instance
from collections import Counter

offers = db_instance.get_collection('offers')

print("=" * 60)
print("OFFER DIAGNOSIS")
print("=" * 60)

# 1. Total count
total = offers.estimated_document_count()
print(f"\n1. Total offers in DB: {total}")

# 2. Status distribution (sample ALL, not just 100)
print("\n2. Status distribution (full scan):")
pipeline = [
    {'$group': {'_id': '$status', 'count': {'$sum': 1}}}
]
for doc in offers.aggregate(pipeline):
    print(f"   {doc['_id']}: {doc['count']}")

# 3. Check 'deleted' field distribution
print("\n3. 'deleted' field distribution:")
pipeline2 = [
    {'$group': {'_id': '$deleted', 'count': {'$sum': 1}}}
]
for doc in offers.aggregate(pipeline2):
    print(f"   deleted={doc['_id']} (type={type(doc['_id']).__name__}): {doc['count']}")

# 4. Check what publisher query would return
pub_query = {
    'status': {'$in': ['active', 'running', 'rotating']},
    'deleted': {'$ne': True}
}
pub_count = offers.count_documents(pub_query)
print(f"\n4. Publisher-visible offers (active/running/rotating, not deleted): {pub_count}")

# 5. Non-deleted offers that are NOT active/running/rotating
non_active = offers.count_documents({
    'status': {'$nin': ['active', 'running', 'rotating']},
    'deleted': {'$ne': True}
})
print(f"\n5. Non-deleted offers that are NOT active/running/rotating: {non_active}")

# 6. Sample some non-active offers to see their status
print("\n6. Sample of non-active, non-deleted offers:")
samples = list(offers.find(
    {'status': {'$nin': ['active', 'running', 'rotating']}, 'deleted': {'$ne': True}},
    {'offer_id': 1, 'name': 1, 'status': 1, 'deleted': 1}
).limit(10))
for s in samples:
    print(f"   {s.get('offer_id')}: status={s.get('status')}, deleted={s.get('deleted')}")

# 7. Check if deleted is stored as string "True" vs boolean True
deleted_string = offers.count_documents({'deleted': 'True'})
deleted_bool = offers.count_documents({'deleted': True})
deleted_false = offers.count_documents({'deleted': False})
deleted_missing = offers.count_documents({'deleted': {'$exists': False}})
print(f"\n7. Deleted field types:")
print(f"   deleted=True (bool): {deleted_bool}")
print(f"   deleted='True' (string): {deleted_string}")
print(f"   deleted=False (bool): {deleted_false}")
print(f"   deleted field missing: {deleted_missing}")

print("\n" + "=" * 60)
print("FIX: Setting ALL non-deleted offers to 'active'")
print("=" * 60)

# Fix: Update all offers where deleted is NOT True (boolean) AND deleted is NOT "True" (string)
# to status = 'active'
result = offers.update_many(
    {
        'deleted': {'$nin': [True, 'True', 'true']},
        'status': {'$nin': ['active', 'running', 'rotating']}
    },
    {'$set': {'status': 'active'}}
)
print(f"\nReactivated {result.modified_count} offers to 'active' status")

# Verify
final_count = offers.count_documents(pub_query)
print(f"Total publisher-visible offers now: {final_count}")
print("\nDone!")
