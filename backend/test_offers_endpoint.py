#!/usr/bin/env python3

import requests
import json

def test_offers_with_auth():
    """Test the offers endpoint with proper authentication"""
    
    # First, let's login to get a token
    try:
        print("🔐 Logging in to get auth token...")
        login_response = requests.post('http://localhost:5000/api/auth/login', 
            json={
                'username': 'testuser2',  # Use the test user we just created
                'password': 'password123'   # Known password
            }
        )
        
        if login_response.status_code != 200:
            print(f"❌ Login failed: {login_response.status_code} - {login_response.text}")
            
            # Try to create a test user first
            print("🔧 Trying to register a test user...")
            register_response = requests.post('http://localhost:5000/api/auth/register',
                json={
                    'username': 'testuser',
                    'password': 'testpass',
                    'email': 'test@example.com',
                    'firstName': 'Test',
                    'lastName': 'User'
                }
            )
            print(f"Register response: {register_response.status_code} - {register_response.text}")
            return
        
        login_data = login_response.json()
        token = login_data.get('token')
        
        if not token:
            print(f"❌ No token received: {login_data}")
            return
            
        print(f"✅ Login successful, got token: {token[:20]}...")
        
        # Now test the offers endpoint with authentication
        headers = {
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json'
        }
        
        print("\n🔍 Testing offers endpoint with auth...")
        offers_response = requests.get(
            'http://localhost:5000/api/publisher/offers/available',
            params={
                'page': 1,
                'per_page': 10,
                'status': 'active'
            },
            headers=headers
        )
        
        print(f"Offers Status: {offers_response.status_code}")
        
        if offers_response.status_code == 200:
            offers_data = offers_response.json()
            print(f"✅ Success! Found {len(offers_data.get('offers', []))} offers")
            print(f"Pagination: {offers_data.get('pagination', {})}")
            
            # Show first offer details
            offers = offers_data.get('offers', [])
            if offers:
                first_offer = offers[0]
                print(f"\n📋 First offer:")
                print(f"   ID: {first_offer.get('offer_id')}")
                print(f"   Name: {first_offer.get('name')}")
                print(f"   Payout: ${first_offer.get('payout')}")
                print(f"   Has Access: {first_offer.get('has_access')}")
                print(f"   Requires Approval: {first_offer.get('requires_approval')}")
                print(f"   Approval Status: {first_offer.get('approval_status')}")
        else:
            print(f"❌ Error: {offers_response.text}")
            
    except Exception as e:
        print(f"❌ Error: {str(e)}")

if __name__ == "__main__":
    test_offers_with_auth()
