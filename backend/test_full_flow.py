"""
Send test postback and show detailed output
"""
import requests
import json
import time

# The postback URL
postback_url = "http://localhost:5000/postback/KWhO4xAMLjJns51ri6a_OVQUzMKD7xvL"

# POST data
post_data = {
    "survey_id": "VBFS6",
    "transaction_id": "test-txn-456",
    "payout": "0.1",
    "status": "pass",
    "username": "anonymous",
    "click_id": "",
    "user_id": ""
}

print("="*80)
print("SENDING TEST POSTBACK")
print("="*80)
print(f"URL: {postback_url}")
print(f"Data: {json.dumps(post_data, indent=2)}")
print("="*80)

try:
    response = requests.post(postback_url, json=post_data, timeout=10)
    print(f"\n✅ Status: {response.status_code}")
    print(f"Response: {response.text}")
    
    # Wait a moment
    time.sleep(1)
    
    # Now check the database
    print("\n" + "="*80)
    print("CHECKING DATABASE...")
    print("="*80)
    
    import sys
    sys.path.append('.')
    from database import db_instance
    
    if not db_instance.is_connected():
        db_instance.connect()
    
    # Check forwarded_postbacks
    forwarded = db_instance.get_collection('forwarded_postbacks')
    if forwarded is not None:
        latest = list(forwarded.find().sort('timestamp', -1).limit(1))
        if latest:
            fwd = latest[0]
            print(f"\n✅ Latest Forwarded Postback:")
            print(f"   Publisher: {fwd.get('publisher_name')}")
            print(f"   Username: {fwd.get('username')}")
            print(f"   Points: {fwd.get('points')}")
            print(f"   Forward URL: {fwd.get('forward_url')}")
            print(f"   Status: {fwd.get('forward_status')}")
            print(f"   Response Code: {fwd.get('response_code')}")
        else:
            print("\n⚠️ No forwarded postbacks found!")
            print("   This means the code is not reaching the forwarding step.")
    
except Exception as e:
    print(f"\n❌ Error: {e}")
    import traceback
    traceback.print_exc()

print("="*80)
