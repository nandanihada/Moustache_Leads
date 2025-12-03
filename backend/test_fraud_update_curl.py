#!/usr/bin/env python3
"""Test fraud signal update with detailed logging"""

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
    exit(1)

token = auth_response.json().get('token')
print(f"✅ Got token")

# Get fraud signals first
print("\n📡 Getting fraud signals...")
headers = {
    'Authorization': f'Bearer {token}',
    'Content-Type': 'application/json'
}

response = requests.get(
    'http://localhost:5000/api/admin/offerwall/fraud-signals',
    headers=headers
)

if response.status_code != 200:
    print(f"❌ Failed to get signals: {response.status_code}")
    exit(1)

data = response.json()
signals = data.get('data', [])

if not signals:
    print("❌ No fraud signals found")
    exit(1)

signal_id = signals[0]['_id']
print(f"✅ Found signal: {signal_id}")
print(f"Signal details: {json.dumps(signals[0], indent=2, default=str)}")

# Update the signal with detailed logging
print(f"\n📤 Updating signal {signal_id}...")
url = f'http://localhost:5000/api/admin/offerwall/fraud-signals/{signal_id}'
print(f"URL: {url}")
print(f"Headers: {headers}")
print(f"Body: {json.dumps({'status': 'false_positive'})}")

update_response = requests.put(
    url,
    headers=headers,
    json={'status': 'false_positive'}
)

print(f"\nResponse Status: {update_response.status_code}")
print(f"Response Headers: {dict(update_response.headers)}")
print(f"Response Body: {update_response.text}")

if update_response.status_code == 200:
    print("\n✅ SUCCESS! Signal updated")
else:
    print(f"\n❌ FAILED with status {update_response.status_code}")
