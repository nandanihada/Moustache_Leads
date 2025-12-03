#!/usr/bin/env python3
"""Test comprehensive click tracking"""

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

# Create a session first
print("\n📡 Creating session...")
session_response = requests.post(
    'http://localhost:5000/api/offerwall/session/create',
    json={
        'user_id': 'testuser_comp',
        'placement_id': '4hN81lEwE7Fw1hnI'
    }
)

if session_response.status_code != 200:
    print(f"❌ Failed to create session: {session_response.status_code}")
    print(session_response.text)
    exit(1)

session_id = session_response.json().get('session_id')
print(f"✅ Session created: {session_id}")

# Track a click
print("\n📤 Tracking click...")
click_response = requests.post(
    'http://localhost:5000/api/offerwall/track/click',
    json={
        'session_id': session_id,
        'user_id': 'testuser_comp',
        'placement_id': '4hN81lEwE7Fw1hnI',
        'offer_id': 'ML-00001',
        'offer_name': 'Test Offer',
        'device_type': 'desktop',
        'browser': 'Chrome',
        'os': 'Windows',
        'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'time_to_click': 1500
    }
)

if click_response.status_code != 200:
    print(f"❌ Failed to track click: {click_response.status_code}")
    print(click_response.text)
    exit(1)

click_id = click_response.json().get('click_id')
print(f"✅ Click tracked: {click_id}")

# Wait a moment for data to be written
time.sleep(1)

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
print(f"\n✅ Click details retrieved:")
print(json.dumps(data['data'], indent=2, default=str))

# Check if comprehensive data is present
click_data = data['data']
print(f"\n🔍 Data presence check:")
print(f"  Device info: {bool(click_data.get('device', {}).get('type'))}")
print(f"  Network info: {bool(click_data.get('network', {}).get('ip_address'))}")
print(f"  Geo info: {bool(click_data.get('geo', {}).get('country'))}")
print(f"  Fraud indicators: {bool(click_data.get('fraud_indicators', {}).get('fraud_status'))}")
