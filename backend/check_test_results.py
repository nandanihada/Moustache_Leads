import pymongo
from datetime import datetime, timedelta

uri = "mongodb+srv://nan_db_user:j6trrN5m33t4Jwz8@mustache.0gly4in.mongodb.net/ascend_db?retryWrites=true&w=majority&tlsAllowInvalidCertificates=true"
client = pymongo.MongoClient(uri)
db = client["ascend_db"]

print("="*80)
print("FINAL TEST RESULTS")
print("="*80)

# Check latest postback
postbacks = db["postback_logs"]
latest_pb = postbacks.find_one(sort=[('timestamp', -1)])

print("\nLatest Postback:")
if latest_pb:
    print(f"  Time: {latest_pb.get('timestamp')}")
    print(f"  Status: {latest_pb.get('status')}")
    print(f"  Message: {latest_pb.get('message', 'N/A')[:100]}")
    print(f"  Raw params: {latest_pb.get('raw_params', {})}")
else:
    print("  No postbacks found")

# Check if click exists
clicks = db["clicks"]
latest_click = clicks.find_one({'offer_id': 'ML-TEST-001'}, sort=[('timestamp', -1)])

print("\nLatest Click for ML-TEST-001:")
if latest_click:
    print(f"  Click ID: {latest_click.get('click_id')}")
    print(f"  User: {latest_click.get('user_id')}")
    print(f"  Placement: {latest_click.get('placement_id')}")
    print(f"  Time: {latest_click.get('timestamp')}")
else:
    print("  No clicks found")

# Check if offer exists with campaign_id
offers = db["offers"]
offer = offers.find_one({'campaign_id': 'VBFS6'})

print("\nOffer with campaign_id=VBFS6:")
if offer:
    print(f"  ✅ EXISTS")
    print(f"  offer_id: {offer.get('offer_id')}")
    print(f"  campaign_id: {offer.get('campaign_id')}")
    print(f"  payout: {offer.get('payout')}")
else:
    print(f"  ❌ NOT FOUND")

print("\n" + "="*80)
print("CONCLUSION:")
if offer and latest_click:
    print("✅ Offer exists, Click tracked - Backend should be able to match!")
else:
    print("❌ Missing data - check what's not working")
print("="*80)
