#!/usr/bin/env python3

import requests
from database import db_instance

BASE_URL = 'http://127.0.0.1:5000'

# Check what request IDs look like in database
requests_collection = db_instance.get_collection('affiliate_requests')
req = requests_collection.find_one({})

if req:
    print("Sample request from database:")
    print(f"  _id: {req.get('_id')} (type: {type(req.get('_id'))})")
    print(f"  request_id: {req.get('request_id')}")
    print(f"  status: {req.get('status')}")
    print()

# Login as admin
login = requests.post(f'{BASE_URL}/api/auth/login',
    json={'username': 'admin', 'password': 'admin123'}
)
token = login.json().get('token')
headers = {'Authorization': f'Bearer {token}'}

# Get requests
print("Getting requests from API...")
resp = requests.get(f'{BASE_URL}/api/admin/offer-access-requests', headers=headers)

if resp.status_code == 200:
    data = resp.json()
    print(f"✅ Got {len(data.get('requests', []))} requests")
    
    if data.get('requests'):
        req = data['requests'][0]
        print(f"\nFirst request from API:")
        print(f"  _id: {req.get('_id')}")
        print(f"  request_id: {req.get('request_id')}")
        print(f"  status: {req.get('status')}")
        print(f"  offer_id: {req.get('offer_id')}")
        print(f"  All keys: {list(req.keys())}")
else:
    print(f"❌ Error: {resp.status_code}")
    print(resp.text)
