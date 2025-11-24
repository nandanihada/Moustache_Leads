#!/usr/bin/env python3

import requests
from database import db_instance

BASE_URL = 'http://127.0.0.1:5000'

# Get a pending request
requests_collection = db_instance.get_collection('affiliate_requests')
pending_req = requests_collection.find_one({'status': 'pending'})

if not pending_req:
    print("No pending requests found")
    exit(1)

request_id = str(pending_req['_id'])
print(f"Testing with request ID: {request_id}")
print(f"Offer: {pending_req['offer_id']}")
print()

# Login as admin
login = requests.post(f'{BASE_URL}/api/auth/login',
    json={'username': 'admin', 'password': 'admin123'}
)
token = login.json().get('token')
headers = {'Authorization': f'Bearer {token}'}

# Try to approve
print("Approving request...")
resp = requests.post(
    f'{BASE_URL}/api/admin/offer-access-requests/{request_id}/approve',
    json={'notes': 'Approved for testing'},
    headers=headers
)

print(f"Status: {resp.status_code}")
print(f"Response: {resp.json()}")

if resp.status_code == 200:
    print("\n✅ Approval successful!")
    
    # Check if request status changed
    updated_req = requests_collection.find_one({'_id': pending_req['_id']})
    print(f"Updated status: {updated_req.get('status')}")
else:
    print("\n❌ Approval failed!")
