#!/usr/bin/env python3

import requests

# Quick test to see if offers are accessible
BASE_URL = 'http://localhost:5000'

# Login
login = requests.post(f'{BASE_URL}/api/auth/login', 
    json={'username': 'testuser2', 'password': 'password123'}
)

if login.status_code == 200:
    token = login.json().get('token')
    headers = {'Authorization': f'Bearer {token}'}
    
    # Get offers
    offers = requests.get(
        f'{BASE_URL}/api/publisher/offers/available',
        params={'page': 1, 'per_page': 10},
        headers=headers
    )
    
    print(f"Status: {offers.status_code}")
    data = offers.json()
    print(f"Offers found: {len(data.get('offers', []))}")
    
    if data.get('offers'):
        for offer in data['offers'][:2]:
            print(f"  - {offer['name']}: has_access={offer.get('has_access')}, requires_approval={offer.get('requires_approval')}")
else:
    print(f"Login failed: {login.status_code}")
