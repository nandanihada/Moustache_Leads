"""Check exact network name variants for mobplus"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from database import db_instance

offers_col = db_instance.get_collection('offers')

# Get ALL distinct network values that contain 'mob' (case insensitive)
all_networks = offers_col.distinct('network', {'deleted': {'$ne': True}})
mob_networks = [n for n in all_networks if n and 'mob' in n.lower()]

print(f"=== Network values containing 'mob' (active offers) ===")
for n in mob_networks:
    count = offers_col.count_documents({'network': n, 'deleted': {'$ne': True}})
    # Show repr to see hidden chars
    print(f"  {repr(n):30s} -> {count} offers")

# Also check in recycle bin
print(f"\n=== Network values containing 'mob' (recycle bin) ===")
all_networks_deleted = offers_col.distinct('network', {'deleted': True})
mob_networks_deleted = [n for n in all_networks_deleted if n and 'mob' in n.lower()]
for n in mob_networks_deleted:
    count = offers_col.count_documents({'network': n, 'deleted': True})
    print(f"  {repr(n):30s} -> {count} offers")

# Total
print(f"\n=== Summary ===")
for n in mob_networks:
    active = offers_col.count_documents({'network': n, 'deleted': {'$ne': True}})
    deleted = offers_col.count_documents({'network': n, 'deleted': True})
    print(f"  {repr(n):30s} -> active: {active}, deleted: {deleted}")
