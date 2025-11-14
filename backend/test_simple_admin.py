#!/usr/bin/env python3

import requests
from models.user import User
from utils.auth import generate_token

def test_simple_admin():
    print("🔍 TESTING SIMPLE ADMIN ROUTE")
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
    
    # Test the simple test route
    print("Testing simple test route...")
    try:
        response = requests.get('http://localhost:5000/api/admin/test-publishers', headers=headers)
        print(f"Status: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Simple route works! Found {data.get('count')} publishers")
        
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    test_simple_admin()
