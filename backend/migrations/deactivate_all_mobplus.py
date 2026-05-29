"""Make all mobplus offers inactive"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from database import db_instance

col = db_instance.get_collection('offers')
r = col.update_many(
    {'network': 'mobplus', 'deleted': {'$ne': True}},
    {'$set': {'status': 'inactive', 'is_active': False}}
)
print(f"Made {r.modified_count} mobplus offers inactive")
