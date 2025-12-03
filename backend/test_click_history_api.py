#!/usr/bin/env python
"""
Test: Click history API endpoint
"""
import requests
import json

BASE_URL = "http://localhost:5000"

print("=" * 100)
print("🔍 TESTING CLICK HISTORY API")
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
print(f"✅ Token obtained")

headers = {
    'Authorization': f'Bearer {token}',
    'Content-Type': 'application/json'
}

# Test the click history endpoint
print("\n2️⃣  CALLING CLICK HISTORY ENDPOINT...")
try:
    response = requests.get(
        f'{BASE_URL}/api/admin/offerwall/click-history?limit=50',
        headers=headers,
        timeout=5
    )
    
    print(f"✅ Response status: {response.status_code}")
    data = response.json()
    
    print(f"✅ Response: {json.dumps(data, indent=2, default=str)}")
    
    if response.status_code == 200:
        clicks = data.get('data', [])
        print(f"\n✅ Total clicks: {data.get('total')}")
        print(f"✅ Clicks returned: {len(clicks)}")
        
        if clicks:
            click = clicks[0]
            print(f"\n📊 FIRST CLICK:")
            print(f"   Click ID: {click.get('click_id')}")
            print(f"   User ID: {click.get('user_id')}")
            print(f"   Offer: {click.get('offer_name')}")
            print(f"   Geo: {click.get('geo')}")
            print(f"   Fraud: {click.get('fraud_indicators')}")
        
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()

print("\n" + "=" * 100)
print("✅ TEST COMPLETE")
print("=" * 100)
