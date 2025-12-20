"""
Test the complete postback forwarding flow locally
Simulates:
1. User clicking an offer
2. Upward partner sending postback
3. System forwarding to SurveyTitans
"""

import requests
import json
from datetime import datetime

BASE_URL = "http://localhost:5000"

print("="*80)
print("TESTING COMPLETE POSTBACK FLOW LOCALLY")
print("="*80)

# Step 1: Simulate a click on the offer
print("\n1️⃣ Simulating user clicking offer on SurveyTitans' offerwall...")
click_url = f"{BASE_URL}/track/ML-00057?user_id=test_user_123&sub1=zalUDOuAS0gaBh33"
print(f"   URL: {click_url}")

try:
    response = requests.get(click_url, allow_redirects=False)
    print(f"   Status: {response.status_code}")
    if response.status_code == 302:
        print(f"   ✅ Redirected to: {response.headers.get('Location', 'N/A')[:100]}...")
        print(f"   ✅ Click tracked successfully!")
    else:
        print(f"   ⚠️ Unexpected response: {response.text[:200]}")
except Exception as e:
    print(f"   ❌ Error: {e}")

# Wait a moment
import time
time.sleep(2)

# Step 2: Simulate upward partner sending postback
print("\n2️⃣ Simulating upward partner sending postback...")
postback_url = f"{BASE_URL}/postback/KWhO4xAMLjJns51ri6a_OVQUzMKD7xvL"

# This is the exact data format they send
postback_data = {
    "aff_sub": "",
    "click_id": "",
    "completion_time": "0",
    "currency": "USD",
    "email": "",
    "evaluation_result": "unknown",
    "ip_address": "",
    "payout": "0.1",
    "referrer": "",
    "responses": {
        "q1": "Test response"
    },
    "responses_count": "1",
    "session_id": "test-session-123",
    "simple_user_id": "",
    "status": "pass",
    "sub1": "",
    "sub2": "",
    "survey_id": "VBFS6",  # This is the key!
    "timestamp": str(int(datetime.utcnow().timestamp())),
    "transaction_id": "test-txn-123",
    "user_agent": "",
    "user_id": "",
    "username": "anonymous"
}

print(f"   URL: {postback_url}")
print(f"   Data: survey_id={postback_data['survey_id']}, transaction_id={postback_data['transaction_id']}")

try:
    response = requests.post(postback_url, json=postback_data, headers={'Content-Type': 'application/json'})
    print(f"   Status: {response.status_code}")
    print(f"   Response: {response.text[:200]}")
    
    if response.status_code == 200:
        print(f"   ✅ Postback received successfully!")
    else:
        print(f"   ⚠️ Unexpected response")
except Exception as e:
    print(f"   ❌ Error: {e}")

# Step 3: Check if it was forwarded
print("\n3️⃣ Checking forwarded postbacks...")
print("   Check the Python backend terminal for logs showing:")
print("   - 📦 Received POST body")
print("   - 📋 Postback parameters")
print("   - ✅ Mapped external offer_id 'VBFS6' → internal offer_id 'ML-00057'")
print("   - ✅ Found click by offer_id")
print("   - ✅ Processing click - placement_id: zalUDOuAS0gaBh33")
print("   - 📋 Placement: [name]")
print("   - 👤 Placement owner: [username]")
print("   - ✅ Found owner: [username]")
print("   - 💰 Offer: ML-00057")
print("   - 📋 Macro replacements:")
print("   - 📤 Final URL: [SurveyTitans postback URL with real values]")
print("   - ✅ Sent to [owner]! Status: 200")

print("\n" + "="*80)
print("TEST COMPLETE")
print("="*80)
print("\n📝 What to check:")
print("   1. Check Python backend terminal for detailed logs")
print("   2. Verify placement_id was found (zalUDOuAS0gaBh33)")
print("   3. Verify it forwarded to SurveyTitans")
print("   4. Verify macros were replaced with real values")
print("\n💡 If you see errors, share the Python terminal output!")
