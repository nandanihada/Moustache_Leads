#!/usr/bin/env python3
"""Test new click with comprehensive details"""

import requests
import json
import time

# Get admin token
print("🔐 Getting admin token...")
auth_response = requests.post(
    'http://localhost:5000/api/auth/login',
    json={'username': 'admin', 'password': 'admin123'}
)

if auth_response.status_code != 200:
    print(f"❌ Failed to get token")
    exit(1)

token = auth_response.json().get('token')
print(f"✅ Got token")

# Create a session
print("\n📡 Creating session...")
session_response = requests.post(
    'http://localhost:5000/api/offerwall/session/create',
    json={
        'user_id': 'testuser_final',
        'placement_id': '4hN81lEwE7Fw1hnI'
    }
)

if session_response.status_code != 200:
    print(f"❌ Failed to create session")
    exit(1)

session_id = session_response.json().get('session_id')
print(f"✅ Session created: {session_id}")

# Track a click with user_agent
print("\n📤 Tracking click with user_agent...")
click_response = requests.post(
    'http://localhost:5000/api/offerwall/track/click',
    json={
        'session_id': session_id,
        'user_id': 'testuser_final',
        'placement_id': '4hN81lEwE7Fw1hnI',
        'offer_id': 'ML-00001',
        'offer_name': 'Final Test Offer',
        'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'time_to_click': 1500
    }
)

if click_response.status_code != 200:
    print(f"❌ Failed to track click: {click_response.status_code}")
    print(click_response.text)
    exit(1)

click_id = click_response.json().get('click_id')
print(f"✅ Click tracked: {click_id}")

# Wait for data to be written
time.sleep(2)

# Get click details
print("\n📡 Getting click details...")
headers = {
    'Authorization': f'Bearer {token}',
    'Content-Type': 'application/json'
}

details_response = requests.get(
    f'http://localhost:5000/api/admin/offerwall/click-details/{click_id}',
    headers=headers
)

if details_response.status_code != 200:
    print(f"❌ Failed to get details: {details_response.status_code}")
    print(details_response.text)
    exit(1)

data = details_response.json()
click_data = data['data']

print(f"\n✅ Click details retrieved!")
print(f"\n📋 Key Information:")
print(f"  Publisher Name: {click_data.get('publisher_name')}")
print(f"  Device Type: {click_data.get('device', {}).get('type')}")
print(f"  Browser: {click_data.get('device', {}).get('browser')}")
print(f"  OS: {click_data.get('device', {}).get('os')}")
print(f"  IP Address: {click_data.get('network', {}).get('ip_address')}")
print(f"  Country: {click_data.get('geo', {}).get('country')}")
print(f"  City: {click_data.get('geo', {}).get('city')}")
print(f"  ISP: {click_data.get('network', {}).get('isp')}")
print(f"  Fraud Status: {click_data.get('fraud_indicators', {}).get('fraud_status')}")

# Check if comprehensive data is present
print(f"\n🔍 Data Quality Check:")
has_device = bool(click_data.get('device', {}).get('browser'))
has_geo = bool(click_data.get('geo', {}).get('country') and click_data.get('geo', {}).get('country') != 'Unknown')
has_network = bool(click_data.get('network', {}).get('ip_address'))
has_fraud = bool(click_data.get('fraud_indicators', {}).get('fraud_status'))

print(f"  ✅ Device Info: {'YES' if has_device else 'NO'}")
print(f"  ✅ Geo Info: {'YES' if has_geo else 'NO'}")
print(f"  ✅ Network Info: {'YES' if has_network else 'NO'}")
print(f"  ✅ Fraud Info: {'YES' if has_fraud else 'NO'}")

if has_device and has_geo and has_network and has_fraud:
    print(f"\n🎉 SUCCESS! All comprehensive data is present!")
else:
    print(f"\n⚠️ Some data is missing. Full response:")
    print(json.dumps(click_data, indent=2, default=str)[:1000])
