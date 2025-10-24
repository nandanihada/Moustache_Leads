#!/usr/bin/env python3
"""
Debug script to test offers API
"""

import requests
import json

def debug_offers():
    """Debug offers API connection"""
    
    base_url = "http://localhost:5000"
    
    print("🔍 Debugging Offers API Connection")
    print("=" * 40)
    
    # Test 1: Health check
    print("\n1. Testing health endpoint...")
    try:
        health_response = requests.get(f"{base_url}/health", timeout=5)
        print(f"   Status: {health_response.status_code}")
        if health_response.status_code == 200:
            print(f"   Response: {health_response.json()}")
        else:
            print(f"   Error: {health_response.text}")
    except Exception as e:
        print(f"   Error: {str(e)}")
    
    # Test 2: Login
    print("\n2. Testing admin login...")
    login_data = {"username": "admin", "password": "admin123"}
    
    try:
        login_response = requests.post(f"{base_url}/api/auth/login", json=login_data, timeout=5)
        print(f"   Status: {login_response.status_code}")
        
        if login_response.status_code == 200:
            login_result = login_response.json()
            token = login_result['token']
            print(f"   Login successful! Role: {login_result['user'].get('role', 'user')}")
            
            # Test 3: Get offers
            print("\n3. Testing offers API...")
            headers = {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}
            
            offers_response = requests.get(f"{base_url}/api/admin/offers", headers=headers, timeout=5)
            print(f"   Status: {offers_response.status_code}")
            
            if offers_response.status_code == 200:
                offers_result = offers_response.json()
                offers_count = len(offers_result.get('offers', []))
                print(f"   Found {offers_count} offers")
                
                if offers_count == 0:
                    print("\n4. Creating sample offer...")
                    sample_offer = {
                        "campaign_id": "DEBUG-001",
                        "name": "Debug Test Offer",
                        "description": "Test offer for debugging",
                        "status": "active",
                        "countries": ["US"],
                        "payout": 10.00,
                        "network": "DebugNetwork",
                        "target_url": "https://example.com/debug"
                    }
                    
                    create_response = requests.post(f"{base_url}/api/admin/offers", 
                                                   json=sample_offer, headers=headers, timeout=5)
                    print(f"   Create Status: {create_response.status_code}")
                    
                    if create_response.status_code == 201:
                        create_result = create_response.json()
                        print(f"   Created offer: {create_result['offer']['offer_id']}")
                    else:
                        print(f"   Create Error: {create_response.text}")
                else:
                    for offer in offers_result['offers'][:3]:
                        print(f"   - {offer['offer_id']}: {offer['name']}")
            else:
                print(f"   Error: {offers_response.text}")
        else:
            print(f"   Login Error: {login_response.text}")
            
            # Try to register admin user
            print("\n   Trying to register admin user...")
            register_data = {
                "username": "admin",
                "email": "admin@ascend.com", 
                "password": "admin123"
            }
            
            register_response = requests.post(f"{base_url}/api/auth/register", json=register_data, timeout=5)
            print(f"   Register Status: {register_response.status_code}")
            
            if register_response.status_code == 201:
                print("   Admin user created! Try login again.")
            else:
                print(f"   Register Error: {register_response.text}")
                
    except Exception as e:
        print(f"   Error: {str(e)}")
    
    print(f"\n🔍 Debug complete!")

if __name__ == "__main__":
    debug_offers()
