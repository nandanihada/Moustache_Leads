#!/usr/bin/env python3
"""Get details for the new click"""

import requests
import json

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

# The new click ID
click_id = "1356d109-e0e8-4948-a55b-f3918d1a68c2"

print(f"\n📡 Getting details for click: {click_id}...")
headers = {
    'Authorization': f'Bearer {token}',
    'Content-Type': 'application/json'
}

response = requests.get(
    f'http://localhost:5000/api/admin/offerwall/click-details/{click_id}',
    headers=headers
)

if response.status_code != 200:
    print(f"❌ Failed: {response.status_code}")
    print(response.text)
    exit(1)

data = response.json()
click_data = data['data']

print(f"\n✅ Got details!")
print(f"\n📋 Information:")
print(f"  Publisher Name: {click_data.get('publisher_name')}")
print(f"  Device Type: {click_data.get('device', {}).get('type')}")
print(f"  Browser: {click_data.get('device', {}).get('browser')}")
print(f"  OS: {click_data.get('device', {}).get('os')}")
print(f"  IP Address: {click_data.get('network', {}).get('ip_address')}")
print(f"  Country: {click_data.get('geo', {}).get('country')}")
print(f"  City: {click_data.get('geo', {}).get('city')}")
print(f"  ISP: {click_data.get('network', {}).get('isp')}")
print(f"  Fraud Status: {click_data.get('fraud_indicators', {}).get('fraud_status')}")

print(f"\n🎉 Full response:")
print(json.dumps(click_data, indent=2, default=str)[:1500])
