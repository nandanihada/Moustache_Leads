#!/usr/bin/env python3
"""
Test script to verify frontend-backend integration
Run this to test if your Flask backend works with the frontend
"""
import requests
import json

BASE_URL = "http://localhost:5000"

def test_login_and_create_placement():
    """Test complete flow: login -> create placement -> list placements"""
    print("🧪 Testing Frontend-Backend Integration")
    print("=" * 50)
    
    # Step 1: Login (you can use any existing user or create one)
    print("1️⃣ Testing Login...")
    login_data = {
        "username": "testuser",  # Use the user we created earlier
        "password": "password123"
    }
    
    try:
        response = requests.post(f"{BASE_URL}/login", json=login_data)
        if response.status_code == 200:
            data = response.json()
            token = data.get('token')
            print(f"✅ Login successful! User: {data.get('user', {}).get('username')}")
        else:
            print(f"❌ Login failed: {response.status_code}")
            print("💡 Try creating a user first:")
            print("   POST /api/auth/register")
            print("   { \"username\": \"testuser\", \"email\": \"test@example.com\", \"password\": \"password123\" }")
            return
    except Exception as e:
        print(f"❌ Login error: {e}")
        return
    
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    
    # Step 2: Get publisher info (auto-creates if needed)
    print("\n2️⃣ Testing Publisher Info...")
    try:
        response = requests.get(f"{BASE_URL}/api/placements/publisher/me", headers=headers)
        if response.status_code == 200:
            publisher = response.json()
            print(f"✅ Publisher info: {publisher['name']} ({publisher['contactEmail']})")
        else:
            print(f"❌ Publisher info failed: {response.status_code}")
            return
    except Exception as e:
        print(f"❌ Publisher error: {e}")
        return
    
    # Step 3: Create a placement (like frontend would)
    print("\n3️⃣ Testing Placement Creation...")
    placement_data = {
        "platformType": "website",
        "offerwallTitle": "Frontend Test Offerwall",
        "currencyName": "Test Coins",
        "exchangeRate": 2.5,
        "postbackUrl": "https://example.com/postback-test",
        "status": "LIVE"
    }
    
    try:
        response = requests.post(f"{BASE_URL}/api/placements/", 
                               headers=headers, json=placement_data)
        if response.status_code == 201:
            placement = response.json()
            print(f"✅ Placement created!")
            print(f"   ID: {placement['id']}")
            print(f"   Identifier: {placement['placementIdentifier']}")
            print(f"   Title: {placement['offerwallTitle']}")
            placement_id = placement['id']
        else:
            print(f"❌ Placement creation failed: {response.status_code}")
            print(f"   Response: {response.text}")
            return
    except Exception as e:
        print(f"❌ Placement creation error: {e}")
        return
    
    # Step 4: List placements (like frontend would)
    print("\n4️⃣ Testing Placement List...")
    try:
        response = requests.get(f"{BASE_URL}/api/placements/", headers=headers)
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Placement list retrieved!")
            print(f"   Total placements: {data['total']}")
            for p in data['placements']:
                print(f"   - {p['offerwallTitle']} ({p['status']}) - {p['placementIdentifier']}")
        else:
            print(f"❌ Placement list failed: {response.status_code}")
    except Exception as e:
        print(f"❌ Placement list error: {e}")
    
    # Step 5: Update placement
    print("\n5️⃣ Testing Placement Update...")
    update_data = {
        "offerwallTitle": "Updated Frontend Test Offerwall",
        "exchangeRate": 3.0,
        "status": "PAUSED"
    }
    
    try:
        response = requests.put(f"{BASE_URL}/api/placements/{placement_id}", 
                              headers=headers, json=update_data)
        if response.status_code == 200:
            updated = response.json()
            print(f"✅ Placement updated!")
            print(f"   New title: {updated['offerwallTitle']}")
            print(f"   New rate: {updated['exchangeRate']}")
            print(f"   New status: {updated['status']}")
        else:
            print(f"❌ Placement update failed: {response.status_code}")
    except Exception as e:
        print(f"❌ Placement update error: {e}")
    
    print("\n" + "=" * 50)
    print("🎉 Frontend-Backend Integration Test Complete!")
    print("\n💡 Your frontend should now be able to:")
    print("   - Login users and get JWT tokens")
    print("   - Create new placements")
    print("   - List existing placements") 
    print("   - Update placement details")
    print("   - Auto-create publisher records")

if __name__ == "__main__":
    test_login_and_create_placement()
