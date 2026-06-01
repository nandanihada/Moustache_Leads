"""Revert the bad country migration"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from database import db_instance

col = db_instance.get_collection('offers')
result = col.update_many(
    {'countries_fixed_at': {'$exists': True}},
    {'$set': {'countries': ['US']}, '$unset': {'countries_fixed_at': ''}}
)
print(f"Reverted {result.modified_count} offers back to ['US']")
