#!/usr/bin/env python3
"""
Debug authentication issues
"""
import requests
import json

BASE_URL = "http://localhost:5000"

def test_auth_flow():
    """Test the complete auth flow"""
    print("🔍 Debugging Authentication Flow")
    print("=" * 40)
    
    # Step 1: Try to login with demo user
    print("1️⃣ Testing Demo Login...")
    login_data = {"username": "demo", "password": "demo123"}
    
    try:
        response = requests.post(f"{BASE_URL}/login", json=login_data)
        print(f"Login Response Status: {response.status_code}")
        print(f"Login Response: {response.text}")
        
        if response.status_code == 200:
            data = response.json()
            token = data.get('token')
            print(f"✅ Token received: {token[:50]}...")
            
            # Step 2: Test placement endpoint with token
            print("\n2️⃣ Testing Placement Endpoint...")
            headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
            
            # Test GET placements
            response = requests.get(f"{BASE_URL}/api/placements/", headers=headers)
            print(f"Placements GET Status: {response.status_code}")
            print(f"Placements GET Response: {response.text}")
            
            # Test publisher endpoint
            print("\n3️⃣ Testing Publisher Endpoint...")
            response = requests.get(f"{BASE_URL}/api/placements/publisher/me", headers=headers)
            print(f"Publisher GET Status: {response.status_code}")
            print(f"Publisher GET Response: {response.text}")
            
        else:
            print(f"❌ Login failed: {response.status_code}")
            
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    test_auth_flow()
