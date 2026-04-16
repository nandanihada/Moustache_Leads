import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from database import db_instance

received = db_instance.get_collection('received_postbacks')
conversions = db_instance.get_collection('conversions')
fwd = db_instance.get_collection('forwarded_postbacks')

# Get the most recent received postback (the postman one)
latest = received.find_one({'partner_name': 'postmantest'}, sort=[('timestamp', -1)])
if latest:
    latest['_id'] = str(latest['_id'])
    print("=== LATEST RECEIVED POSTBACK (postmantest) ===")
    for k, v in sorted(latest.items()):
        print(f"  {k}: {repr(v)[:200]}")
else:
    print("No postmantest received postback found")
    # Try most recent
    latest = received.find_one({}, sort=[('timestamp', -1)])
    if latest:
        latest['_id'] = str(latest['_id'])
        print("=== MOST RECENT RECEIVED POSTBACK ===")
        for k, v in sorted(latest.items()):
            print(f"  {k}: {repr(v)[:200]}")

# Check recent conversions
print("\n=== RECENT CONVERSIONS (last 5) ===")
for c in conversions.find({}).sort('conversion_time', -1).limit(5):
    print(f"  {c.get('conversion_id')}: click={c.get('click_id')}, offer={c.get('offer_id')}, source={c.get('source')}, time={c.get('conversion_time')}")

# Check recent forwarded
print("\n=== RECENT FORWARDED (last 5, non-fake) ===")
for f in fwd.find({'source': {'$ne': 'fallback_fake'}}).sort('timestamp', -1).limit(5):
    print(f"  publisher={f.get('publisher_name')}, points={f.get('points')}, source={f.get('source')}, time={f.get('timestamp')}")
