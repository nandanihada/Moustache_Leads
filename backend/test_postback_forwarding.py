#!/usr/bin/env python3
"""
Test postback forwarding locally
Simulates receiving a postback and checks if it's forwarded to all placements
"""

import requests
import time
from database import db_instance

print("\n" + "="*80)
print("🧪 TESTING POSTBACK FORWARDING")
print("="*80)

# Step 1: Check how many placements have postbackUrl
print("\n📋 Step 1: Checking placements with postbackUrl...")
placements = db_instance.get_collection('placements')
placements_with_postback = list(placements.find({
    'postbackUrl': {'$exists': True, '$ne': '', '$ne': None}
}))

print(f"Found {len(placements_with_postback)} placements with postbackUrl:")
for p in placements_with_postback:
    print(f"  - {p.get('offerwallTitle')}: {p.get('postbackUrl')}")

if len(placements_with_postback) == 0:
    print("\n❌ ERROR: No placements have postbackUrl configured!")
    print("   Please configure postbackUrl for at least one placement.")
    exit(1)

# Step 2: Send a test postback to your backend
print("\n📤 Step 2: Sending test postback to backend...")

# Use the unique key from one of your placements or a test key
test_url = "http://localhost:5000/postback/KWhO4xAMLjJns51ri6a_OVQUzMKD7xvL"

test_params = {
    'click_id': 'TEST-CLICK-123',
    'status': 'approved',
    'payout': '1.50',
    'offer_id': 'ML-00065',
    'conversion_id': 'TEST-CONV-456',
    'user_id': 'test_user',
    'username': 'test_user'
}

print(f"URL: {test_url}")
print(f"Params: {test_params}")

try:
    response = requests.get(test_url, params=test_params, timeout=10)
    print(f"\n✅ Postback sent!")
    print(f"Status: {response.status_code}")
    print(f"Response: {response.json()}")
except Exception as e:
    print(f"\n❌ Error sending postback: {e}")
    exit(1)

# Step 3: Wait a moment for processing
print("\n⏳ Waiting 2 seconds for processing...")
time.sleep(2)

# Step 4: Check placement_postback_logs
print("\n📊 Step 3: Checking placement_postback_logs...")
logs = db_instance.get_collection('placement_postback_logs')
recent_logs = list(logs.find().sort('timestamp', -1).limit(5))

print(f"Found {len(recent_logs)} recent log entries:")
for i, log in enumerate(recent_logs, 1):
    print(f"\n{i}. Placement: {log.get('placement_title', 'Unknown')}")
    print(f"   URL: {log.get('postback_url')}")
    print(f"   Status: {log.get('status')}")
    print(f"   Response Code: {log.get('response_code')}")
    if log.get('error'):
        print(f"   Error: {log.get('error')}")

# Step 5: Summary
print("\n" + "="*80)
print("📊 SUMMARY:")
print("="*80)

success_count = logs.count_documents({'status': 'success'})
failed_count = logs.count_documents({'status': 'failed'})

print(f"\nTotal placements with postbackUrl: {len(placements_with_postback)}")
print(f"Successful forwards: {success_count}")
print(f"Failed forwards: {failed_count}")

if success_count > 0:
    print("\n✅ SUCCESS! Postbacks are being forwarded!")
    print("   Check the logs above to see which placements received the postback.")
else:
    print("\n⚠️  No successful forwards found.")
    print("   Check the error messages above.")

print("\n" + "="*80)
