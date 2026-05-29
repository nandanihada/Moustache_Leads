import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from database import db_instance

col = db_instance.get_collection('offers')
total = col.count_documents({})
mobplus = col.count_documents({'network': 'mobplus'})

# Check latest 5 offers by _id (most recently inserted)
recent = list(col.find({}).sort('_id', -1).limit(5))
print(f"Total offers: {total}")
print(f"MobPlus offers: {mobplus}")
print(f"\nLatest 5 offers (by _id):")
for o in recent:
    print(f"  {o.get('offer_id','?'):12s} | {o.get('network','?'):15s} | {o.get('name','?')[:50]}")
