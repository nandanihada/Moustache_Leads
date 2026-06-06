"""Quick check: which offers have refined_description"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from dotenv import load_dotenv
load_dotenv()
from database import db_instance

col = db_instance.get_collection('offers')
refined = list(col.find(
    {'refined_description': {'$exists': True, '$ne': None}},
    {'offer_id': 1, 'name': 1, '_id': 0}
).limit(200))

print(f"Total offers with refined_description: {len(refined)}")
print("")
for i, o in enumerate(refined):
    oid = o.get('offer_id', '?')
    name = o.get('name', '?')[:65]
    print(f"  {i+1:3d}. {oid} — {name}")
