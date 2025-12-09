"""
Simple test to check if login logs endpoint works
"""

import requests
import json

# Test without authentication first
print("Testing login logs endpoint...")
print("=" * 60)

# Test 1: Health check
print("\n1. Testing health endpoint...")
try:
    response = requests.get('http://localhost:5000/health')
    print(f"Status: {response.status_code}")
    print(f"Response: {response.json()}")
except Exception as e:
    print(f"Error: {e}")

# Test 2: Login to get token
print("\n2. Logging in to get token...")
try:
    login_data = {
        "username": "admin",
        "password": "admin123"  # Change this to your actual admin password
    }
    response = requests.post('http://localhost:5000/api/auth/login', json=login_data)
    print(f"Status: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        token = data.get('token')
        print(f"✅ Login successful!")
        print(f"Token: {token[:50]}...")
        
        # Test 3: Get login logs with token
        print("\n3. Getting login logs with token...")
        headers = {
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json'
        }
        
        response = requests.get('http://localhost:5000/api/admin/login-logs?page=1&limit=10', headers=headers)
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Success! Got {data.get('total', 0)} total logs")
            print(f"Showing {len(data.get('logs', []))} logs")
            
            if data.get('logs'):
                print("\nFirst log:")
                print(json.dumps(data['logs'][0], indent=2, default=str))
        else:
            print(f"❌ Error: {response.status_code}")
            print(f"Response: {response.text}")
    else:
        print(f"❌ Login failed: {response.status_code}")
        print(f"Response: {response.json()}")
        
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()

print("\n" + "=" * 60)
print("Test complete!")
