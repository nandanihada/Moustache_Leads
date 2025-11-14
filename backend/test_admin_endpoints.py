#!/usr/bin/env python3

import requests
import json
from models.user import User
from utils.auth import generate_token

def test_admin_endpoints():
    print("=== TESTING ADMIN PLACEMENT ENDPOINTS ===")
    
    # Get admin user and generate token
    user_model = User()
    admin_user = user_model.find_by_username('admin')
    
    if not admin_user:
        print("❌ Admin user not found!")
        return
    
    print(f"✅ Found admin user: {admin_user['username']} ({admin_user['email']})")
    
    # Generate admin token
    admin_token = generate_token(admin_user)
    print(f"✅ Generated admin token: {admin_token[:50]}...")
    
    # Test admin placement endpoint
    base_url = "http://localhost:5000"
    headers = {
        'Authorization': f'Bearer {admin_token}',
        'Content-Type': 'application/json'
    }
    
    try:
        # Test admin placements endpoint
        print("\n--- Testing GET /api/placements/admin/all ---")
        response = requests.get(f"{base_url}/api/placements/admin/all", headers=headers)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Success! Found {len(data.get('placements', []))} placements")
            print(f"Total: {data.get('total', 0)}")
            
            # Show pending placements
            pending_placements = [p for p in data.get('placements', []) if p.get('approvalStatus') == 'PENDING_APPROVAL']
            print(f"📋 Pending placements: {len(pending_placements)}")
            
            for placement in pending_placements:
                print(f"  - {placement.get('offerwallTitle')} by {placement.get('publisherName')} (ID: {placement.get('id')})")
        else:
            print(f"❌ Error: {response.status_code}")
            print(f"Response: {response.text}")
            
        # Test admin stats endpoint
        print("\n--- Testing GET /api/placements/admin/stats ---")
        response = requests.get(f"{base_url}/api/placements/admin/stats", headers=headers)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Stats: {data}")
        else:
            print(f"❌ Error: {response.status_code}")
            print(f"Response: {response.text}")
            
    except requests.exceptions.ConnectionError:
        print("❌ Could not connect to server. Is the Flask app running on localhost:5000?")
    except Exception as e:
        print(f"❌ Error: {str(e)}")

if __name__ == "__main__":
    test_admin_endpoints()
