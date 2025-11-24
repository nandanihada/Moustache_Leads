#!/usr/bin/env python3

import requests

BASE_URL = 'http://127.0.0.1:5000'

# Login as publisher
login = requests.post(f'{BASE_URL}/api/auth/login',
    json={'username': 'testuser2', 'password': 'password123'}
)
token = login.json().get('token')
headers = {'Authorization': f'Bearer {token}'}

# Get offers
resp = requests.get(
    f'{BASE_URL}/api/publisher/offers/available',
    params={'page': 1, 'per_page': 5},
    headers=headers
)

offers = resp.json().get('offers', [])
print(f"Publisher sees {len(offers)} offers\n")

# Find the offer that was just approved
for offer in offers:
    if offer['offer_id'] == 'ML-00063':
        print(f"Offer: {offer['name']}")
        print(f"  - has_access: {offer.get('has_access')}")
        print(f"  - requires_approval: {offer.get('requires_approval')}")
        print(f"  - request_status: {offer.get('request_status')}")
        print(f"  - is_preview: {offer.get('is_preview', False)}")
        print(f"  - target_url present: {'target_url' in offer}")
        print(f"  - masked_url present: {'masked_url' in offer}")
        
        if 'target_url' in offer:
            print(f"\n✅ SUCCESS! Publisher now has access to tracking URL!")
            print(f"   target_url: {offer['target_url'][:60]}...")
        else:
            print(f"\n❌ ERROR! Tracking URL still not visible!")
        break
