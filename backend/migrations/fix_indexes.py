"""
Diagnose and fix index issues on the Oregon cluster.
The $in and $ne operators are returning wrong results - likely a corrupt index.
Run: python migrations/fix_indexes.py
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from database import db_instance

offers = db_instance.get_collection('offers')

print("=" * 60)
print("INDEX DIAGNOSIS")
print("=" * 60)

# 1. List all indexes on offers collection
print("\n1. Current indexes on 'offers' collection:")
for idx_name, idx_info in offers.index_information().items():
    print(f"   {idx_name}: {idx_info.get('key')}")

# 2. Test queries with hint (force collection scan, bypass indexes)
print("\n2. Testing queries with collection scan (no index):")

# Force no index usage with hint({'$natural': 1})
c1 = offers.count_documents({'status': {'$in': ['active', 'running', 'rotating']}}, hint={'$natural': 1})
print(f"   status $in [active,running,rotating] (no index): {c1}")

c2 = offers.count_documents({'deleted': {'$ne': True}}, hint={'$natural': 1}, maxTimeMS=30000)
print(f"   deleted $ne True (no index): {c2}")

c3 = offers.count_documents(
    {'status': {'$in': ['active', 'running', 'rotating']}, 'deleted': {'$ne': True}},
    hint={'$natural': 1},
    maxTimeMS=30000
)
print(f"   Combined publisher query (no index): {c3}")

# 3. Drop and recreate indexes
print("\n3. Dropping all non-_id indexes on offers collection...")
# Get all index names except _id
indexes_to_drop = [name for name in offers.index_information().keys() if name != '_id_']
for idx_name in indexes_to_drop:
    try:
        offers.drop_index(idx_name)
        print(f"   Dropped: {idx_name}")
    except Exception as e:
        print(f"   Failed to drop {idx_name}: {e}")

# 4. Recreate clean indexes
print("\n4. Recreating clean indexes...")
from pymongo import ASCENDING, DESCENDING

# Main publisher query index
offers.create_index(
    [('status', ASCENDING), ('deleted', ASCENDING), ('is_pinned', DESCENDING), ('created_at', DESCENDING)],
    name='publisher_offers_idx',
    background=True
)
print("   Created: publisher_offers_idx")

# Offer ID lookup
offers.create_index([('offer_id', ASCENDING)], name='offer_id_idx', unique=True, background=True)
print("   Created: offer_id_idx")

# Status index
offers.create_index([('status', ASCENDING)], name='status_idx', background=True)
print("   Created: status_idx")

# Network index (for filtering)
offers.create_index([('network', ASCENDING), ('status', ASCENDING)], name='network_status_idx', background=True)
print("   Created: network_status_idx")

# 5. Verify queries work now
print("\n5. Verifying queries after index rebuild:")
c4 = offers.count_documents({'status': {'$in': ['active', 'running', 'rotating']}})
print(f"   status $in [active,running,rotating]: {c4}")

c5 = offers.count_documents({'status': {'$in': ['active', 'running', 'rotating']}, 'deleted': {'$ne': True}})
print(f"   Publisher query (with index): {c5}")

print("\nDone! Indexes rebuilt.")
