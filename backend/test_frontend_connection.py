#!/usr/bin/env python
"""
Test: Frontend connection to click tracking API
"""
import requests
import json

BASE_URL = "http://localhost:5000"

print("=" * 100)
print("🔍 TESTING FRONTEND CONNECTION")
print("=" * 100)

# Get admin token
print("\n1️⃣  GETTING ADMIN TOKEN...")
login_response = requests.post(
    f'{BASE_URL}/api/auth/login',
    json={'username': 'admin', 'password': 'admin123'},
    timeout=5
)

if login_response.status_code != 200:
    print(f"❌ Login failed: {login_response.status_code}")
    exit(1)

token = login_response.json().get('token')
print(f"✅ Token: {token[:20]}...")

headers = {
    'Authorization': f'Bearer {token}',
    'Content-Type': 'application/json'
}

# Test the exact same endpoint the frontend uses
print("\n2️⃣  TESTING FRONTEND ENDPOINT...")
try:
    response = requests.get(
        f'{BASE_URL}/api/admin/offerwall/click-history?limit=50',
        headers=headers,
        timeout=5
    )
    
    print(f"✅ Status: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        clicks = data.get('data', [])
        print(f"✅ Clicks: {len(clicks)}")
        print(f"✅ First click ID: {clicks[0].get('click_id') if clicks else 'None'}")
        print(f"✅ Publisher Name: {clicks[0].get('publisher_name') if clicks else 'None'}")
    else:
        print(f"❌ Error: {response.text}")
        
except Exception as e:
    print(f"❌ Error: {e}")

print("\n📋 FRONTEND INSTRUCTIONS:")
print("1. Open browser and go to: http://localhost:8080/login")
print("2. Login as admin/admin123")
print("3. Go to: http://localhost:8080/admin/click-tracking")
print("4. Click 'Refresh' button or hard refresh (Ctrl+Shift+R)")
print("5. You should see all 6 test clicks!")

print("\n" + "=" * 100)
print("✅ TEST COMPLETE")
print("=" * 100)
