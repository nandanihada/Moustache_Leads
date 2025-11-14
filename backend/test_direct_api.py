#!/usr/bin/env python3

import requests
import json
from models.user import User
from utils.auth import generate_token

def test_direct_api():
    print("🔍 TESTING DIRECT API CALL")
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
    
    print(f"👤 Admin user: {admin_user['username']}")
    print(f"🔑 Token: {admin_token[:50]}...")
    print(f"🛡️ Role: {admin_user.get('role')}")
    
    # Test the exact endpoint
    url = 'http://localhost:5000/api/admin/publishers'
    print(f"📡 Testing URL: {url}")
    
    try:
        response = requests.get(url, headers=headers, timeout=10)
        
        print(f"📥 Status Code: {response.status_code}")
        print(f"📄 Response Headers: {dict(response.headers)}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Success! Found {len(data.get('publishers', []))} publishers")
        else:
            print(f"❌ Error Response: {response.text}")
            
    except requests.exceptions.ConnectionError:
        print("❌ Connection refused - Flask server not running")
        print("💡 Please start the Flask server with: python app.py")
    except Exception as e:
        print(f"❌ Request error: {e}")

if __name__ == "__main__":
    test_direct_api()
