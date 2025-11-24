#!/usr/bin/env python3

import requests
import json

def test_request_access():
    """Test requesting access to an offer"""
    
    BASE_URL = 'http://localhost:5000'
    
    # Login
    print("🔐 Logging in...")
    login_response = requests.post(f'{BASE_URL}/api/auth/login', 
        json={
            'username': 'testuser2',
            'password': 'password123'
        }
    )
    
    if login_response.status_code != 200:
        print(f"❌ Login failed: {login_response.text}")
        return
    
    token = login_response.json().get('token')
    print(f"✅ Login successful\n")
    
    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    }
    
    # Get offers
    print("📋 Getting offers...")
    offers_response = requests.get(
        f'{BASE_URL}/api/publisher/offers/available',
        params={'page': 1, 'per_page': 5, 'status': 'active'},
        headers=headers
    )
    
    if offers_response.status_code != 200:
        print(f"❌ Failed to get offers: {offers_response.text}")
        return
    
    offers = offers_response.json().get('offers', [])
    if not offers:
        print("❌ No offers found")
        return
    
    offer_id = offers[0].get('offer_id')
    print(f"✅ Got {len(offers)} offers")
    print(f"   Testing with offer: {offer_id}\n")
    
    # Try to request access
    print("🔄 Requesting access...")
    print(f"   URL: POST /api/publisher/offers/{offer_id}/request-access")
    print(f"   Body: {{'message': 'Test request'}}")
    print(f"   Headers: Authorization: Bearer {token[:30]}...\n")
    
    request_response = requests.post(
        f'{BASE_URL}/api/publisher/offers/{offer_id}/request-access',
        json={'message': 'Test request'},
        headers=headers
    )
    
    print(f"Status Code: {request_response.status_code}")
    print(f"Response: {request_response.text}\n")
    
    if request_response.status_code == 200:
        print("✅ Request successful!")
    else:
        print("❌ Request failed!")
        
        # Try to understand the error
        try:
            error_data = request_response.json()
            print(f"\nError details:")
            print(json.dumps(error_data, indent=2))
        except:
            pass

if __name__ == "__main__":
    test_request_access()
