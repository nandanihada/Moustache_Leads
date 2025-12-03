#!/usr/bin/env python
"""
Test: Get the actual error from the endpoint
"""
import requests
import json

BASE_URL = "http://localhost:5000"

print("=" * 100)
print("🔍 TESTING ENDPOINT ERROR")
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

# Track a click
print("\n2️⃣  TRACKING A CLICK...")
click_data = {
    'session_id': 'test_session_error',
    'user_id': 'test_user_error',
    'placement_id': '4hN81lEwE7Fw1hnI',
    'offer_id': 'ML-00065',
    'offer_name': 'Test Offer Error',
    'device_type': 'desktop',
    'browser': 'Chrome',
    'os': 'Windows',
    'country': 'United States',
    'ip_address': '192.168.1.1',
}

try:
    response = requests.post(
        f'{BASE_URL}/api/offerwall/track/click',
        json=click_data,
        headers=headers,
        timeout=5
    )
    
    print(f"✅ Response status: {response.status_code}")
    print(f"✅ Response text: {response.text}")
    
    try:
        data = response.json()
        print(f"✅ Response JSON: {json.dumps(data, indent=2)}")
    except:
        print(f"❌ Could not parse JSON response")
        
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()

print("\n" + "=" * 100)
print("✅ TEST COMPLETE")
print("=" * 100)
