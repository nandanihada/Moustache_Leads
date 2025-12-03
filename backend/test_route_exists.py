#!/usr/bin/env python3
"""Test if the route exists"""

import requests

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
    print(f"❌ Failed to get token")
    exit(1)

token = auth_response.json().get('token')

headers = {
    'Authorization': f'Bearer {token}',
    'Content-Type': 'application/json'
}

# Test with a fake ID to see if the route is found
print("\n📡 Testing route with fake ID...")
response = requests.put(
    'http://localhost:5000/api/admin/offerwall/fraud-signals/fakeid123',
    headers=headers,
    json={'status': 'false_positive'}
)

print(f"Status: {response.status_code}")
print(f"Response: {response.json()}")

if response.status_code == 404 and 'Signal not found' in response.text:
    print("\n✅ Route exists! (404 because signal not found)")
elif response.status_code == 404:
    print("\n❌ Route not found (Flask 404)")
else:
    print(f"\n? Unexpected status: {response.status_code}")
