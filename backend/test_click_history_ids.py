#!/usr/bin/env python3
"""Check click history IDs"""

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
print(f"✅ Got token")

# Get click history
print("\n📡 Getting click history...")
headers = {
    'Authorization': f'Bearer {token}',
    'Content-Type': 'application/json'
}

response = requests.get(
    'http://localhost:5000/api/admin/offerwall/click-history?limit=5',
    headers=headers
)

if response.status_code != 200:
    print(f"❌ Failed to get click history: {response.status_code}")
    exit(1)

data = response.json()
print(f"\n✅ Got {len(data['data'])} clicks")

# Show the first click
if data['data']:
    click = data['data'][0]
    print(f"\nFirst click details:")
    print(f"  click_id: {click.get('click_id')}")
    print(f"  user_id: {click.get('user_id')}")
    print(f"  offer_name: {click.get('offer_name')}")
    print(f"  event_type: {click.get('event_type')}")
    print(f"  publisher_name: {click.get('publisher_name')}")
    
    # Try to get details for this click
    click_id = click.get('click_id')
    print(f"\n📡 Getting details for click_id: {click_id}...")
    
    details_response = requests.get(
        f'http://localhost:5000/api/admin/offerwall/click-details/{click_id}',
        headers=headers
    )
    
    if details_response.status_code == 200:
        details_data = details_response.json()
        print(f"✅ Got details!")
        print(json.dumps(details_data['data'], indent=2, default=str)[:500])
    else:
        print(f"❌ Failed to get details: {details_response.status_code}")
        print(details_response.text)
