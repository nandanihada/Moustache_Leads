"""Fix trailing space in mobplus network name"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from database import db_instance

offers_col = db_instance.get_collection('offers')

# Fix 'mobplus ' -> 'mobplus' (both active and deleted)
result = offers_col.update_many(
    {'network': 'mobplus '},
    {'$set': {'network': 'mobplus'}}
)

print(f"Fixed {result.modified_count} offers (matched {result.matched_count})")
print(f"All 'mobplus ' entries normalized to 'mobplus'")

# Verify
active = offers_col.count_documents({'network': 'mobplus', 'deleted': {'$ne': True}})
deleted = offers_col.count_documents({'network': 'mobplus', 'deleted': True})
space_remaining = offers_col.count_documents({'network': 'mobplus '})
print(f"\nAfter fix:")
print(f"  Active 'mobplus': {active}")
print(f"  Deleted 'mobplus': {deleted}")
print(f"  Remaining 'mobplus ' (with space): {space_remaining}")
