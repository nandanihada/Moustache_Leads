import pymongo
from datetime import datetime, timedelta

# Connect to MongoDB
client = pymongo.MongoClient("mongodb://localhost:27017/")
db = client["affiliate_network"]

print("\n" + "="*80)
print("CHECKING LATEST POSTBACK LOGS")
print("="*80)

# Check latest postback log
postback_logs = db["postback_logs"]
latest = postback_logs.find_one(sort=[('timestamp', -1)])

if latest:
    print(f"\n📦 Latest Postback:")
    print(f"   Time: {latest.get('timestamp')}")
    print(f"   Offer ID: {latest.get('offer_id')}")
    print(f"   Status: {latest.get('status')}")
    print(f"   Message: {latest.get('message')}")
    print(f"   Raw params: {latest.get('raw_params', {})}")

# Check if any clicks exist for ML-00098
clicks = db["clicks"]
recent_clicks = list(clicks.find(
    {'offer_id': 'ML-00098'},
    sort=[('timestamp', -1)]
).limit(3))

print(f"\n🖱️ Recent clicks for ML-00098: {len(recent_clicks)}")
for click in recent_clicks:
    print(f"   - Click ID: {click.get('click_id')[:20]}... User: {click.get('user_id')}, Time: {click.get('timestamp')}")

# Check if campaign_id matching found the offer
print(f"\n🔍 Checking if offer can be found by campaign_id...")
offers = db["offers"]
offer = offers.find_one({'campaign_id': 'VBFS6'})
if offer:
    print(f"   ✅ Found: offer_id={offer.get('offer_id')}, campaign_id={offer.get('campaign_id')}")
else:
    print(f"   ❌ NOT FOUND")

print("\n" + "="*80)
