"""
Soft-delete active MobPlus offers that have NO user grants
===========================================================
From the 60 active mobplus offers, find the ones without grants
and move them to recycle bin.
"""
import sys, os
from datetime import datetime
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from database import db_instance

offers_col = db_instance.get_collection('offers')
grants_col = db_instance.get_collection('offer_grants')

# Get all active mobplus offers
active_mobplus = list(offers_col.find(
    {'network': 'mobplus', 'deleted': {'$ne': True}},
    {'offer_id': 1, 'name': 1, '_id': 1}
))

print(f"Total active mobplus offers: {len(active_mobplus)}")

# Get offer_ids
offer_ids = [o.get('offer_id', str(o.get('_id', ''))) for o in active_mobplus]

# Find which have grants
granted_ids = set()
if grants_col is not None:
    grants = list(grants_col.find({'offer_id': {'$in': offer_ids}, 'is_active': True}, {'offer_id': 1}))
    granted_ids = set(g['offer_id'] for g in grants)

# Find offers WITHOUT grants
no_grant_ids = [oid for oid in offer_ids if oid not in granted_ids]

print(f"With grants (KEEP): {len(granted_ids)}")
print(f"Without grants (DELETE): {len(no_grant_ids)}")

if no_grant_ids:
    # Soft-delete them (move to recycle bin)
    result = offers_col.update_many(
        {'offer_id': {'$in': no_grant_ids}, 'deleted': {'$ne': True}},
        {'$set': {
            'deleted': True,
            'is_active': False,
            'deleted_at': datetime.utcnow(),
            'updated_at': datetime.utcnow()
        }}
    )
    print(f"\n✅ Soft-deleted {result.modified_count} offers (moved to recycle bin)")
    
    # Verify
    remaining = offers_col.count_documents({'network': 'mobplus', 'deleted': {'$ne': True}})
    print(f"Remaining active mobplus offers: {remaining}")
else:
    print("\nNo offers to delete — all have grants.")
