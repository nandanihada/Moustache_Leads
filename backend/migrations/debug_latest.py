import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from database import db_instance

fwd = db_instance.get_collection('forwarded_postbacks')
received = db_instance.get_collection('received_postbacks')
conv = db_instance.get_collection('conversions')

# Latest forwarded_postbacks with source=verified_postback
print("=== LATEST VERIFIED FORWARDED (last 5) ===")
for f in fwd.find({'source': 'verified_postback'}).sort('timestamp', -1).limit(5):
    f['_id'] = str(f['_id'])
    print(f"  publisher={f.get('publisher_name')}, user={f.get('username')}, points={f.get('points')}, "
          f"status={f.get('forward_status')}, offer={f.get('offer_id')}, time={f.get('timestamp')}")

# Latest forwarded_postbacks with no_url status
print("\n=== FORWARDED WITH no_url STATUS ===")
for f in fwd.find({'forward_status': 'no_url'}).sort('timestamp', -1).limit(5):
    f['_id'] = str(f['_id'])
    print(f"  publisher={f.get('publisher_name')}, user={f.get('username')}, points={f.get('points')}, time={f.get('timestamp')}")

# All non-fake forwarded in last day
from datetime import datetime, timedelta
since = datetime.utcnow() - timedelta(days=1)
print(f"\n=== ALL NON-FAKE FORWARDED (last 24h) ===")
for f in fwd.find({'timestamp': {'$gte': since}, 'source': {'$ne': 'fallback_fake'}}).sort('timestamp', -1).limit(10):
    f['_id'] = str(f['_id'])
    print(f"  source={f.get('source')}, publisher={f.get('publisher_name')}, status={f.get('forward_status')}, "
          f"points={f.get('points')}, time={f.get('timestamp')}")

# Latest received postbacks
print(f"\n=== LATEST RECEIVED (last 5) ===")
for r in received.find({}).sort('timestamp', -1).limit(5):
    print(f"  partner={r.get('partner_name')}, status={r.get('status')}, conv_id={r.get('conversion_id', 'none')}, "
          f"time={r.get('timestamp')}")

# Latest conversions
print(f"\n=== LATEST CONVERSIONS (last 5 by conversion_time) ===")
for c in conv.find({}).sort('conversion_time', -1).limit(5):
    print(f"  {c.get('conversion_id')}: click={c.get('click_id')}, offer={c.get('offer_id')}, "
          f"source={c.get('source')}, payout={c.get('payout')}, time={c.get('conversion_time')}")

# Check publisher_id on the user who clicked
clicks = db_instance.get_collection('clicks')
click = clicks.find_one({'click_id': 'CLK-34A683D895F8'})
if click:
    print(f"\n=== CLICK CLK-34A683D895F8 ===")
    print(f"  user_id: {click.get('user_id')}")
    print(f"  username: {click.get('username')}")
    print(f"  offer_id: {click.get('offer_id')}")
    print(f"  placement_id: {click.get('placement_id')}")
    
    # Check if user exists
    users = db_instance.get_collection('users')
    uid = click.get('user_id')
    if uid:
        from bson import ObjectId
        try:
            user = users.find_one({'_id': ObjectId(uid)})
        except:
            user = users.find_one({'username': uid})
        if user:
            print(f"  USER FOUND: username={user.get('username')}, postback_url={user.get('postback_url', 'NONE')}")
        else:
            print(f"  USER NOT FOUND for user_id={uid}")
