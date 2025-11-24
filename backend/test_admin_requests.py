#!/usr/bin/env python3

import requests
import json

BASE_URL = 'http://localhost:5000'

# Step 1: Publisher requests access
print("=" * 60)
print("STEP 1: Publisher requests access")
print("=" * 60)

login = requests.post(f'{BASE_URL}/api/auth/login', 
    json={'username': 'testuser2', 'password': 'password123'}
)
token = login.json().get('token')
headers = {'Authorization': f'Bearer {token}'}

# Get first offer
offers_resp = requests.get(
    f'{BASE_URL}/api/publisher/offers/available',
    params={'page': 1, 'per_page': 5},
    headers=headers
)
offers = offers_resp.json().get('offers', [])
if offers:
    offer_id = offers[0]['offer_id']
    print(f"✅ Got offer: {offer_id}")
    
    # Request access
    req_resp = requests.post(
        f'{BASE_URL}/api/publisher/offers/{offer_id}/request-access',
        json={'message': 'Please approve'},
        headers=headers
    )
    print(f"Request status: {req_resp.status_code}")
    print(f"Response: {req_resp.json()}\n")

# Step 2: Admin checks requests
print("=" * 60)
print("STEP 2: Admin checks requests")
print("=" * 60)

# Login as admin
admin_login = requests.post(f'{BASE_URL}/api/auth/login',
    json={'username': 'admin', 'password': 'admin123'}
)

if admin_login.status_code == 200:
    admin_token = admin_login.json().get('token')
    admin_headers = {'Authorization': f'Bearer {admin_token}'}
    
    # Get all requests
    requests_resp = requests.get(
        f'{BASE_URL}/api/admin/offer-access-requests',
        headers=admin_headers
    )
    
    print(f"Status: {requests_resp.status_code}")
    data = requests_resp.json()
    print(f"Total requests: {data.get('pagination', {}).get('total', 0)}")
    
    if data.get('requests'):
        for req in data['requests'][:3]:
            print(f"\n  Request ID: {req.get('_id')}")
            print(f"  Offer: {req.get('offer_details', {}).get('name')}")
            print(f"  User: {req.get('user_details', {}).get('username')}")
            print(f"  Status: {req.get('status')}")
    else:
        print("❌ No requests found!")
else:
    print(f"❌ Admin login failed: {admin_login.status_code}")
    print(admin_login.text)
