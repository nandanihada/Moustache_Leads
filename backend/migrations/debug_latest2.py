import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from database import db_instance
from datetime import datetime, timedelta

fwd = db_instance.get_collection('forwarded_postbacks')
pts = db_instance.get_collection('points_transactions')
users = db_instance.get_collection('users')

# Latest verified forwarded
print("=== LATEST VERIFIED FORWARDED ===")
for f in fwd.find({'source': 'verified_postback'}).sort('timestamp', -1).limit(3):
    f['_id'] = str(f['_id'])
    print(f"  publisher={f.get('publisher_name')}, user={f.get('username')}, points={f.get('points')}, "
          f"status={f.get('forward_status')}, offer={f.get('offer_id')}, click={f.get('click_id')}")

# Points transactions for elegant
print("\n=== POINTS TRANSACTIONS (verified) ===")
for p in pts.find({'source': 'verified_postback'}).sort('timestamp', -1).limit(5):
    print(f"  user={p.get('username')}, points={p.get('points')}, offer={p.get('offer_id')}, "
          f"source={p.get('source')}, time={p.get('timestamp')}")

# All recent points transactions
print("\n=== ALL RECENT POINTS TX (last 24h) ===")
since = datetime.utcnow() - timedelta(days=1)
for p in pts.find({'timestamp': {'$gte': since}}).sort('timestamp', -1).limit(10):
    print(f"  user={p.get('username')}, points={p.get('points')}, type={p.get('type')}, "
          f"source={p.get('source')}, time={p.get('timestamp')}")

# Check elegant's total_points
from bson import ObjectId
elegant = users.find_one({'username': 'elegant'})
if elegant:
    print(f"\n=== USER elegant ===")
    print(f"  total_points: {elegant.get('total_points')}")
    print(f"  monthly_earnings: {elegant.get('monthly_earnings')}")
    print(f"  postback_url: {elegant.get('postback_url')}")
