#!/usr/bin/env python3
"""
Test if postback receiver is still working
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

import requests
from database import db_instance
from datetime import datetime

print("\n🧪 TESTING POSTBACK RECEIVER")
print("="*70)

# Step 1: Check if backend is running
try:
    response = requests.get('http://localhost:5000/api/diagnostic', timeout=2)
    print(f"✅ Backend is running")
except:
    print(f"❌ Backend is NOT running!")
    print(f"   Start it with: cd backend && python app.py")
    sys.exit(1)

# Step 2: Find a partner key
partners_collection = db_instance.get_collection('partners')
partner = partners_collection.find_one({})

if partner:
    unique_key = partner.get('unique_postback_key')
    print(f"\n📋 Found Partner: {partner.get('partner_name')}")
    print(f"   Key: {unique_key}")
else:
    # Use a test key
    unique_key = "TEST_KEY_123"
    print(f"\n⚠️ No partner found, using test key: {unique_key}")

# Step 3: Send test postback
print(f"\n📤 Sending test postback...")

test_data = {
    'transaction_id': f'TEST-{datetime.utcnow().strftime("%Y%m%d-%H%M%S")}',
    'survey_id': 'TEST-SURVEY',
    'username': 'testuser',
    'payout': '0.50',
    'currency': 'USD',
    'status': 'pass',
}

postback_url = f'http://localhost:5000/postback/{unique_key}'
print(f"   URL: {postback_url}")

try:
    response = requests.post(postback_url, data=test_data, timeout=5)
    print(f"\n✅ Response: {response.status_code} - {response.text[:100]}")
    
    if response.status_code == 200:
        # Check if it was saved
        import time
        time.sleep(1)  # Wait a moment
        
        postbacks_collection = db_instance.get_collection('received_postbacks')
        latest = postbacks_collection.find_one(
            {'post_data.transaction_id': test_data['transaction_id']}
        )
        
        if latest:
            print(f"\n✅ POSTBACK SAVED TO DATABASE!")
            print(f"   ID: {latest['_id']}")
            print(f"   Partner: {latest['partner_name']}")
            print(f"   Status: {latest['status']}")
            print(f"\n✅ RECEIVER IS WORKING!")
        else:
            print(f"\n❌ Postback accepted but NOT saved to database!")
            print(f"   Check backend logs!")
    else:
        print(f"\n❌ Postback failed!")
        
except Exception as e:
    print(f"\n❌ Error: {e}")

# Step 4: Check current totals
postbacks_collection = db_instance.get_collection('received_postbacks')
total = postbacks_collection.count_documents({})
print(f"\n📊 Total postbacks in DB: {total}")

print("\n" + "="*70)
print("\n💡 IF POSTBACKS ARE NOT ARRIVING FROM PARTNER:")
print("\n1. Check partner's postback URL configuration")
print("2. Make sure they're sending to correct URL")
print("3. Check backend logs for incoming requests")
print("4. Verify partner hasn't stopped sending")
print("\n" + "="*70)
