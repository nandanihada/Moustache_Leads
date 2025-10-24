#!/usr/bin/env python3
"""
Test script for placement management functionality
Run this after starting the Flask backend (python app.py)
"""
import requests
import json
import sys

BASE_URL = "http://localhost:5000"

def test_login():
    """Test login to get JWT token"""
    print("🔐 Testing Login...")
    
    login_data = {
        "username": "demo",
        "password": "demo123"
    }
    
    try:
        response = requests.post(f"{BASE_URL}/login", json=login_data)
        if response.status_code == 200:
            data = response.json()
            token = data.get('token')
            print(f"✅ Login successful!")
            return token
        else:
            print(f"❌ Login failed: {response.status_code} - {response.text}")
            return None
    except Exception as e:
        print(f"❌ Login error: {e}")
        return None

def test_publisher_info(token):
    """Test getting publisher information"""
    print("\n👤 Testing Publisher Info...")
    
    headers = {"Authorization": f"Bearer {token}"}
    
    try:
        response = requests.get(f"{BASE_URL}/api/placements/publisher/me", headers=headers)
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Publisher info retrieved: {data['name']} ({data['contactEmail']})")
            return data['id']
        else:
            print(f"❌ Publisher info failed: {response.status_code} - {response.text}")
            return None
    except Exception as e:
        print(f"❌ Publisher info error: {e}")
        return None

def test_create_placement(token):
    """Test creating a placement"""
    print("\n📝 Testing Placement Creation...")
    
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    
    placement_data = {
        "platformType": "website",
        "offerwallTitle": "Test Offerwall",
        "currencyName": "Test Coins",
        "exchangeRate": 1.5,
        "postbackUrl": "https://example.com/postback",
        "status": "LIVE"
    }
    
    try:
        response = requests.post(f"{BASE_URL}/api/placements/", 
                               headers=headers, json=placement_data)
        if response.status_code == 201:
            data = response.json()
            print(f"✅ Placement created successfully!")
            print(f"   ID: {data['id']}")
            print(f"   Identifier: {data['placementIdentifier']}")
            print(f"   Title: {data['offerwallTitle']}")
            return data['id']
        else:
            print(f"❌ Placement creation failed: {response.status_code} - {response.text}")
            return None
    except Exception as e:
        print(f"❌ Placement creation error: {e}")
        return None

def test_list_placements(token):
    """Test listing placements"""
    print("\n📋 Testing Placement List...")
    
    headers = {"Authorization": f"Bearer {token}"}
    
    try:
        response = requests.get(f"{BASE_URL}/api/placements/", headers=headers)
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Placement list retrieved!")
            print(f"   Total placements: {data['total']}")
            print(f"   Current page: {data['page']}")
            
            for placement in data['placements']:
                print(f"   - {placement['offerwallTitle']} ({placement['status']})")
            
            return True
        else:
            print(f"❌ Placement listing failed: {response.status_code} - {response.text}")
            return False
    except Exception as e:
        print(f"❌ Placement listing error: {e}")
        return False

def test_update_placement(token, placement_id):
    """Test updating a placement"""
    print(f"\n✏️ Testing Placement Update (ID: {placement_id})...")
    
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    
    update_data = {
        "offerwallTitle": "Updated Test Offerwall",
        "exchangeRate": 2.0,
        "status": "PAUSED"
    }
    
    try:
        response = requests.put(f"{BASE_URL}/api/placements/{placement_id}", 
                              headers=headers, json=update_data)
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Placement updated successfully!")
            print(f"   New title: {data['offerwallTitle']}")
            print(f"   New rate: {data['exchangeRate']}")
            print(f"   New status: {data['status']}")
            return True
        else:
            print(f"❌ Placement update failed: {response.status_code} - {response.text}")
            return False
    except Exception as e:
        print(f"❌ Placement update error: {e}")
        return False

def test_get_single_placement(token, placement_id):
    """Test getting a single placement"""
    print(f"\n🔍 Testing Single Placement Retrieval (ID: {placement_id})...")
    
    headers = {"Authorization": f"Bearer {token}"}
    
    try:
        response = requests.get(f"{BASE_URL}/api/placements/{placement_id}", headers=headers)
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Placement retrieved successfully!")
            print(f"   Title: {data['offerwallTitle']}")
            print(f"   Platform: {data['platformType']}")
            print(f"   Status: {data['status']}")
            return True
        else:
            print(f"❌ Placement retrieval failed: {response.status_code} - {response.text}")
            return False
    except Exception as e:
        print(f"❌ Placement retrieval error: {e}")
        return False

def main():
    """Run all tests"""
    print("🚀 Starting Placement Management Tests")
    print("=" * 50)
    
    # Test login
    token = test_login()
    if not token:
        print("\n❌ Cannot proceed without valid JWT token")
        sys.exit(1)
    
    # Test publisher info
    publisher_id = test_publisher_info(token)
    if not publisher_id:
        print("\n❌ Cannot proceed without publisher info")
        sys.exit(1)
    
    # Test placement operations
    placement_id = test_create_placement(token)
    if placement_id:
        test_get_single_placement(token, placement_id)
        test_update_placement(token, placement_id)
    
    test_list_placements(token)
    
    print("\n" + "=" * 50)
    print("🎉 All tests completed!")
    
    if placement_id:
        print(f"\n💡 API Endpoints Available:")
        print(f"   - POST   {BASE_URL}/api/placements/")
        print(f"   - GET    {BASE_URL}/api/placements/")
        print(f"   - GET    {BASE_URL}/api/placements/{{id}}")
        print(f"   - PUT    {BASE_URL}/api/placements/{{id}}")
        print(f"   - DELETE {BASE_URL}/api/placements/{{id}}")
        print(f"   - GET    {BASE_URL}/api/placements/publisher/me")

if __name__ == "__main__":
    main()
