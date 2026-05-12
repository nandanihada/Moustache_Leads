"""Check ash's duplicate records"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from database import db_instance
from bson import ObjectId

user_id = '69a9a5e655f321cc19f6a74d'

# Check forwarded_postbacks
fwd = db_instance.get_collection('forwarded_postbacks')
records = list(fwd.find({'publisher_id': user_id}).sort('timestamp', -1))
print(f"Forwarded postbacks for ash: {len(records)}")
for r in records:
    print(f"  - {r.get('timestamp')} | points={r.get('points')} | status={r.get('forward_status')} | source={r.get('source')}")

# Check user total_points
users = db_instance.get_collection('users')
user = users.find_one({'_id': ObjectId(user_id)})
print(f"\nash total_points: {user.get('total_points')}")

# Check conversions
conv = db_instance.get_collection('conversions')
convs = list(conv.find({'user_id': user_id}).sort('conversion_time', -1))
print(f"\nConversions for ash: {len(convs)}")
for c in convs:
    print(f"  - {c.get('conversion_time')} | {c.get('conversion_id')} | matched_by={c.get('matched_by')}")

# Check points_transactions
pts = db_instance.get_collection('points_transactions')
pts_records = list(pts.find({'user_id': user_id}).sort('timestamp', -1))
print(f"\nPoints transactions for ash: {len(pts_records)}")
for p in pts_records:
    print(f"  - {p.get('timestamp')} | points={p.get('points')} | source={p.get('source')} | offer={p.get('offer_id')}")
