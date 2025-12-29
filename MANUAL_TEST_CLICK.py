#!/usr/bin/env python3
"""
Manually test click tracking by calling the API directly
"""

import requests
import json
import time

BASE_URL = "http://localhost:5000"
USER_ID = "test_user"
PLACEMENT_ID = "4hN81lEwE7Fw1hnI"

print("=" * 80)
print("🚀 MANUAL CLICK TRACKING TEST")
print("=" * 80)

# Step 1: Create session
print("\n🔑 Step 1: Creating session...")
session_response = requests.post(f"{BASE_URL}/api/offerwall/session/create", json={
    'placement_id': PLACEMENT_ID,
    'user_id': USER_ID,
    'device_info': {
        'device_type': 'desktop',
        'browser': 'Chrome',
        'os': 'Windows'
    }
})

if session_response.status_code == 200:
    session_data = session_response.json()
    session_id = session_data.get('session_id')
    print(f"✅ Session created: {session_id}")
else:
    print(f"❌ Failed to create session: {session_response.text}")
    exit(1)

# Step 2: Track a click
print("\n🖱️  Step 2: Tracking click...")
click_data = {
    'session_id': session_id,
    'offer_id': 'ML-00057',
    'placement_id': PLACEMENT_ID,
    'user_id': USER_ID,
    'offer_name': 'TEST OFFER - Manual Click',
    'offer_url': 'http://example.com/test',
    'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    'referrer': 'http://localhost:5173'
}

print(f"📤 Sending click data: {json.dumps(click_data, indent=2)}")

click_response = requests.post(f"{BASE_URL}/api/offerwall/track/click", json=click_data)
print(f"Response Status: {click_response.status_code}")
print(f"Response Body: {click_response.text}")

if click_response.status_code == 200:
    click_result = click_response.json()
    click_id = click_result.get('click_id')
    print(f"✅ Click tracked: {click_id}")
else:
    print(f"❌ Click tracking failed")
    exit(1)

# Step 3: Wait and check database
print("\n⏱️  Step 3: Waiting 2 seconds and checking database...")
time.sleep(2)

# Check clicks via API
print("\n📊 Step 4: Checking clicks via API...")
clicks_response = requests.get(f"{BASE_URL}/api/offerwall/user/clicks", params={
    'user_id': USER_ID,
    'placement_id': PLACEMENT_ID,
    'limit': 5
})

if clicks_response.status_code == 200:
    clicks_data = clicks_response.json()
    total = clicks_data.get('total_clicks', 0)
    print(f"✅ Total clicks: {total}")
    
    if total > 0:
        print(f"Recent clicks:")
        for click in clicks_data.get('clicks', []):
            print(f"  - {click.get('offer_name')} ({click.get('offer_id')})")
            print(f"    Time: {click.get('clicked_ago')}")
    else:
        print("❌ NO CLICKS FOUND IN DATABASE!")
else:
    print(f"❌ Failed to get clicks: {clicks_response.text}")

# Check activity via API
print("\n📊 Step 5: Checking activity via API...")
activity_response = requests.get(f"{BASE_URL}/api/offerwall/user/activity", params={
    'user_id': USER_ID,
    'placement_id': PLACEMENT_ID
})

if activity_response.status_code == 200:
    activity_data = activity_response.json()
    total = activity_data.get('total_completed', 0)
    print(f"✅ Total completed offers: {total}")
else:
    print(f"❌ Failed to get activity: {activity_response.text}")

print("\n" + "=" * 80)
print("✅ TEST COMPLETE")
print("=" * 80)
