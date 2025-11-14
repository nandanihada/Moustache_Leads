#!/usr/bin/env python3

import requests
from models.user import User
from utils.auth import generate_token

def test_simple_route():
    print("🔍 TESTING SIMPLE ROUTE")
    print("=" * 60)
    
    user_model = User()
    
    # Get admin user
    admin_user = user_model.find_by_username('admin')
    if not admin_user:
        print("❌ Admin user not found")
        return
    
    admin_token = generate_token(admin_user)
    headers = {
        'Authorization': f'Bearer {admin_token}',
        'Content-Type': 'application/json'
    }
    
    # Test a simple admin route that we know works
    print("1️⃣ Testing existing admin route...")
    try:
        response = requests.get('http://localhost:5000/api/placements/admin/all', headers=headers)
        print(f"Placement admin route status: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Existing admin route works! Found {len(data.get('placements', []))} placements")
        else:
            print(f"❌ Existing admin route failed: {response.text}")
    except Exception as e:
        print(f"❌ Error testing existing route: {e}")
    
    # Test our new route
    print("\n2️⃣ Testing new publisher route...")
    try:
        response = requests.get('http://localhost:5000/api/admin/publishers', headers=headers)
        print(f"Publisher route status: {response.status_code}")
        print(f"Response: {response.text}")
    except Exception as e:
        print(f"❌ Error testing publisher route: {e}")

if __name__ == "__main__":
    test_simple_route()
