#!/usr/bin/env python
"""
Test: Directly save a click to comprehensive collection
Check if the comprehensive tracker is working
"""
import requests
import json

BASE_URL = "http://localhost:5000"

print("=" * 100)
print("🔍 TESTING DIRECT CLICK SAVE")
print("=" * 100)

# Get admin token
print("\n1️⃣  GETTING ADMIN TOKEN...")
login_response = requests.post(
    f'{BASE_URL}/api/auth/login',
    json={'username': 'admin', 'password': 'admin123'},
    timeout=5
)

if login_response.status_code != 200:
    print(f"❌ Login failed: {login_response.status_code}")
    exit(1)

token = login_response.json().get('token')
print(f"✅ Token obtained")

headers = {
    'Authorization': f'Bearer {token}',
    'Content-Type': 'application/json'
}

# Track a click directly
print("\n2️⃣  TRACKING A CLICK...")
click_data = {
    'session_id': 'test_session_' + str(__import__('time').time()),
    'user_id': 'bhindi',
    'placement_id': '4hN81lEwE7Fw1hnI',
    'offer_id': 'ML-00065',
    'offer_name': 'Test Offer Direct',
    'device_type': 'desktop',
    'browser': 'Chrome',
    'os': 'Windows',
    'country': 'United States',
    'ip_address': '192.168.1.1',
    'publisher_id': 'pub_001'
}

try:
    response = requests.post(
        f'{BASE_URL}/api/offerwall/track/click',
        json=click_data,
        headers=headers,
        timeout=5
    )
    
    print(f"✅ Click tracking response: {response.status_code}")
    result = response.json()
    print(f"✅ Response: {json.dumps(result, indent=2)}")
    
    if response.status_code == 200:
        click_id = result.get('click_id')
        print(f"\n✅ Click tracked successfully!")
        print(f"   Click ID: {click_id}")
    else:
        print(f"\n❌ Click tracking failed!")
        
except Exception as e:
    print(f"❌ Error: {e}")

# Now query the clicks
print("\n3️⃣  QUERYING CLICKS...")
try:
    response = requests.get(
        f'{BASE_URL}/api/offerwall/user/clicks?user_id=bhindi&placement_id=4hN81lEwE7Fw1hnI&limit=50',
        headers=headers,
        timeout=5
    )
    
    print(f"✅ Query response: {response.status_code}")
    data = response.json()
    clicks = data.get('clicks', [])
    print(f"✅ Clicks returned: {len(clicks)}")
    
    if clicks:
        for i, click in enumerate(clicks, 1):
            print(f"\n   Click {i}:")
            print(f"   - user_id: {click.get('user_id')}")
            print(f"   - offer_name: {click.get('offer_name')}")
            print(f"   - created_at: {click.get('created_at')}")
    else:
        print("\n❌ NO CLICKS FOUND!")
        
except Exception as e:
    print(f"❌ Error: {e}")

print("\n" + "=" * 100)
print("✅ TEST COMPLETE")
print("=" * 100)
