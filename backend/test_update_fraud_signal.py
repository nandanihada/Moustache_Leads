#!/usr/bin/env python3
"""Test updating a fraud signal"""

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

# Update the signal
print(f"\n📤 Updating signal {signal_id}...")
update_response = requests.put(
    f'http://localhost:5000/api/admin/offerwall/fraud-signals/{signal_id}',
    headers=headers,
    json={'status': 'false_positive'}
)

print(f"Status: {update_response.status_code}")
print(f"Response: {update_response.json()}")

if update_response.status_code == 200:
    print("\n✅ SUCCESS! Signal updated to false_positive")
else:
    print(f"\n❌ FAILED with status {update_response.status_code}")
