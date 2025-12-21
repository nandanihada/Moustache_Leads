"""
Test postback forwarding locally
Simulates what the upward partner sends
"""
import requests
import json

# The postback URL (use the standalone key from your database)
postback_url = "http://localhost:5000/postback/KWhO4xAMLjJns51ri6a_OVQUzMKD7xvL"

# Simulate the POST data that the upward partner sends
post_data = {
    "survey_id": "VBFS6",  # External offer ID
    "transaction_id": "test-txn-123",
    "payout": "0.1",
    "status": "pass",
    "username": "anonymous",  # We'll ignore this
    "click_id": "",  # Empty - we'll find by offer_id
    "user_id": ""  # Empty
}

print("="*80)
print("🧪 TESTING POSTBACK FORWARDING")
print("="*80)
print(f"📤 Sending POST to: {postback_url}")
print(f"📦 POST data: {json.dumps(post_data, indent=2)}")
print("="*80)

try:
    response = requests.post(
        postback_url,
        json=post_data,
        timeout=10
    )
    
    print(f"\n✅ Response Status: {response.status_code}")
    print(f"📥 Response Body: {response.text}")
    print("="*80)
    
    if response.status_code == 200:
        print("✅ SUCCESS! Check the backend logs above for details.")
        print("   Look for:")
        print("   - '📦 Received POST body'")
        print("   - '✅ Mapped VBFS6 → ML-00057'")
        print("   - '✅ Found click'")
        print("   - '✅ Sent to [owner]'")
    else:
        print(f"❌ Failed with status {response.status_code}")
        
except Exception as e:
    print(f"❌ Error: {e}")
    print("   Make sure backend is running on localhost:5000")

print("="*80)
