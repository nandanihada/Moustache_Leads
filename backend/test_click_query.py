#!/usr/bin/env python
"""
Test: Query clicks from comprehensive collection
Check if clicks are being saved and retrieved correctly
"""
import requests
from pymongo import MongoClient
import json

BASE_URL = "http://localhost:5000"
MONGO_URI = "mongodb+srv://mustache:mustache123@mustache.0gly4in.mongodb.net/?retryWrites=true&w=majority"

print("=" * 100)
print("🔍 TESTING CLICK QUERY")
print("=" * 100)

# Connect to MongoDB directly
print("\n1️⃣  CONNECTING TO MONGODB...")
try:
    client = MongoClient(MONGO_URI)
    db = client['ascend_db']
    print("✅ Connected to MongoDB")
except Exception as e:
    print(f"❌ Failed to connect: {e}")
    exit(1)

# Check comprehensive clicks collection
print("\n2️⃣  CHECKING COMPREHENSIVE CLICKS COLLECTION...")
try:
    clicks_col = db['offerwall_clicks_detailed']
    total_clicks = clicks_col.count_documents({})
    print(f"✅ Total clicks in collection: {total_clicks}")
    
    # Get all clicks
    all_clicks = list(clicks_col.find().limit(10))
    print(f"✅ Retrieved {len(all_clicks)} clicks")
    
    # Show first click
    if all_clicks:
        first_click = all_clicks[0]
        print(f"\n📋 First click structure:")
        print(f"   - click_id: {first_click.get('click_id')}")
        print(f"   - user_id: {first_click.get('user_id')}")
        print(f"   - placement_id: {first_click.get('placement_id')}")
        print(f"   - timestamp: {first_click.get('timestamp')}")
        print(f"   - offer_name: {first_click.get('offer_name')}")
        
except Exception as e:
    print(f"❌ Error: {e}")

# Test query with user_id and placement_id
print("\n3️⃣  TESTING QUERY WITH user_id=bhindi...")
try:
    query = {'user_id': 'bhindi', 'placement_id': '4hN81lEwE7Fw1hnI'}
    print(f"Query: {query}")
    
    clicks = list(clicks_col.find(query).sort('timestamp', -1).limit(50))
    print(f"✅ Found {len(clicks)} clicks matching query")
    
    for i, click in enumerate(clicks, 1):
        print(f"\n   Click {i}:")
        print(f"   - click_id: {click.get('click_id')}")
        print(f"   - user_id: {click.get('user_id')}")
        print(f"   - placement_id: {click.get('placement_id')}")
        print(f"   - offer_name: {click.get('offer_name')}")
        print(f"   - timestamp: {click.get('timestamp')}")
        
except Exception as e:
    print(f"❌ Error: {e}")

# Test API endpoint
print("\n4️⃣  TESTING API ENDPOINT...")
try:
    # Get admin token
    login_response = requests.post(
        f'{BASE_URL}/api/auth/login',
        json={'username': 'admin', 'password': 'admin123'},
        timeout=5
    )
    
    if login_response.status_code != 200:
        print(f"❌ Login failed: {login_response.status_code}")
    else:
        token = login_response.json().get('token')
        headers = {'Authorization': f'Bearer {token}'}
        
        # Test the endpoint
        response = requests.get(
            f'{BASE_URL}/api/offerwall/user/clicks?user_id=bhindi&placement_id=4hN81lEwE7Fw1hnI&limit=50',
            headers=headers,
            timeout=5
        )
        
        print(f"✅ API Response status: {response.status_code}")
        data = response.json()
        print(f"✅ Clicks returned: {len(data.get('clicks', []))}")
        
        if data.get('clicks'):
            for i, click in enumerate(data['clicks'][:3], 1):
                print(f"\n   Click {i}:")
                print(f"   - user_id: {click.get('user_id')}")
                print(f"   - offer_name: {click.get('offer_name')}")
                print(f"   - created_at: {click.get('created_at')}")
        
except Exception as e:
    print(f"❌ Error: {e}")

print("\n" + "=" * 100)
print("✅ TEST COMPLETE")
print("=" * 100)
