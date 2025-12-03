#!/usr/bin/env python3
"""Test the click history endpoint"""

import requests
import json

# Get admin token first
print("🔐 Getting admin token...")
auth_response = requests.post(
    'http://localhost:5000/api/auth/login',
    json={
        'username': 'admin',
        'password': 'admin123'
    }
)

if auth_response.status_code != 200:
    print(f"❌ Failed to get token: {auth_response.status_code}")
    print(auth_response.text)
    exit(1)

token = auth_response.json().get('token')
print(f"✅ Got token: {token[:20]}...")

# Test the endpoint
print("\n📡 Testing /api/admin/offerwall/click-history endpoint...")
headers = {
    'Authorization': f'Bearer {token}',
    'Content-Type': 'application/json'
}

response = requests.get(
    'http://localhost:5000/api/admin/offerwall/click-history?limit=50',
    headers=headers
)

print(f"Status: {response.status_code}")
print(f"Response: {response.text[:500]}")

if response.status_code == 200:
    data = response.json()
    print(f"\n✅ SUCCESS!")
    print(f"Total clicks: {data.get('total', 0)}")
    if data.get('data'):
        print(f"First click: {json.dumps(data['data'][0], indent=2, default=str)[:300]}")
else:
    print(f"\n❌ FAILED with status {response.status_code}")
