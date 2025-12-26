import pymongo
from datetime import datetime, timedelta

uri = "mongodb+srv://nan_db_user:j6trrN5m33t4Jwz8@mustache.0gly4in.mongodb.net/ascend_db?retryWrites=true&w=majority&tlsAllowInvalidCertificates=true"
client = pymongo.MongoClient(uri)
db = client["ascend_db"]

print("="*80)
print("POSTBACK FORWARDING PROOF")
print("="*80)

# Check the latest forwarded postback
forwarded = db["forwarded_postbacks"]
latest_forwarded = forwarded.find_one(sort=[('timestamp', -1)])

print("\n1. FORWARDED POSTBACK LOG:")
print("-"*80)
if latest_forwarded:
    print(f"Timestamp: {latest_forwarded.get('timestamp')}")
    print(f"Publisher: {latest_forwarded.get('publisher_name', 'N/A')}")
    print(f"Username: {latest_forwarded.get('username', 'N/A')}")
    print(f"Points: {latest_forwarded.get('points', 0)}")
    print(f"Forward URL: {latest_forwarded.get('forward_url', 'N/A')}")
    print(f"Status: {latest_forwarded.get('forward_status', 'N/A')}")
    print(f"Response Code: {latest_forwarded.get('response_code', 'N/A')}")
    print(f"Response: {latest_forwarded.get('response_body', 'N/A')[:200]}")
else:
    print("No forwarded postbacks found")

# Check latest postback log
postback_logs = db["postback_logs"]
latest_log = postback_logs.find_one(sort=[('timestamp', -1)])

print("\n2. POSTBACK RECEIVED LOG:")
print("-"*80)
if latest_log:
    print(f"Timestamp: {latest_log.get('timestamp')}")
    print(f"Status: {latest_log.get('status')}")
    print(f"Message: {latest_log.get('message', 'N/A')}")
    raw = latest_log.get('raw_params', {})
    print(f"Survey ID: {raw.get('survey_id', 'N/A')}")
    print(f"Transaction ID: {raw.get('transaction_id', 'N/A')}")

# Check clicks
clicks = db["clicks"]
latest_click = clicks.find_one(
    {'offer_id': 'ML-TEST-001'},
    sort=[('timestamp', -1)]
)

print("\n3. MATCHED CLICK:")
print("-"*80)
if latest_click:
    print(f"Click ID: {latest_click.get('click_id')}")
    print(f"Offer ID: {latest_click.get('offer_id')}")
    print(f"User ID: {latest_click.get('user_id')}")
    print(f"Placement ID: {latest_click.get('placement_id')}")
    print(f"Timestamp: {latest_click.get('timestamp')}")

print("\n" + "="*80)
print("FORWARDING STATUS:")
print("="*80)

if latest_forwarded:
    status = latest_forwarded.get('forward_status')
    response_code = latest_forwarded.get('response_code')
    
    if status == 'success' and response_code == 200:
        print("\n✅ SUCCESS! Postback was forwarded to downstream partner")
        print(f"   - Response Code: {response_code}")
        print(f"   - Forwarded to: {latest_forwarded.get('forward_url', 'N/A')[:50]}...")
    else:
        print(f"\n⚠️ Forwarding attempted but got status: {status}, code: {response_code}")
else:
    print("\n❌ No forwarding record found - check if postback processing reached forwarding step")

print("\n" + "="*80)
