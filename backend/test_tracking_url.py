#!/usr/bin/env python3

import requests
import json

BASE_URL = 'http://localhost:5000'

print("=" * 60)
print("TEST: Tracking URL visibility based on approval")
print("=" * 60)

# Login as publisher
login = requests.post(f'{BASE_URL}/api/auth/login', 
    json={'username': 'testuser2', 'password': 'password123'}
)
token = login.json().get('token')
headers = {'Authorization': f'Bearer {token}'}

# Get offers
offers_resp = requests.get(
    f'{BASE_URL}/api/publisher/offers/available',
    params={'page': 1, 'per_page': 5},
    headers=headers
)

offers = offers_resp.json().get('offers', [])
print(f"\n✅ Got {len(offers)} offers\n")

for i, offer in enumerate(offers[:2]):
    print(f"Offer {i+1}: {offer['name']}")
    print(f"  - offer_id: {offer['offer_id']}")
    print(f"  - has_access: {offer.get('has_access')}")
    print(f"  - requires_approval: {offer.get('requires_approval')}")
    print(f"  - request_status: {offer.get('request_status', 'N/A')}")
    print(f"  - is_preview: {offer.get('is_preview', False)}")
    print(f"  - target_url present: {'target_url' in offer}")
    print(f"  - masked_url present: {'masked_url' in offer}")
    
    if 'target_url' in offer:
        print(f"  ⚠️  WARNING: Tracking URL visible without approval!")
        print(f"     target_url: {offer['target_url'][:50]}...")
    else:
        print(f"  ✅ Tracking URL hidden (correct)")
    print()

print("=" * 60)
print("TEST: After requesting access")
print("=" * 60)

# Request access to first offer
if offers:
    offer_id = offers[0]['offer_id']
    print(f"\nRequesting access to: {offer_id}")
    
    req_resp = requests.post(
        f'{BASE_URL}/api/publisher/offers/{offer_id}/request-access',
        json={'message': 'Please approve'},
        headers=headers
    )
    
    if req_resp.status_code == 200:
        print("✅ Request submitted")
    else:
        print(f"⚠️  Status: {req_resp.status_code} - {req_resp.json().get('error')}")
    
    # Get offers again
    offers_resp2 = requests.get(
        f'{BASE_URL}/api/publisher/offers/available',
        params={'page': 1, 'per_page': 5},
        headers=headers
    )
    
    offers2 = offers_resp2.json().get('offers', [])
    
    # Find the same offer
    for offer in offers2:
        if offer['offer_id'] == offer_id:
            print(f"\nAfter request:")
            print(f"  - has_access: {offer.get('has_access')}")
            print(f"  - request_status: {offer.get('request_status', 'N/A')}")
            print(f"  - target_url present: {'target_url' in offer}")
            
            if 'target_url' in offer:
                print(f"  ⚠️  WARNING: Tracking URL still visible!")
            else:
                print(f"  ✅ Tracking URL still hidden (correct)")
            break
