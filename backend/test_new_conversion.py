#!/usr/bin/env python3
"""
Test if new postback creates conversion and shows in reports
"""

import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from database import db_instance
import requests
from datetime import datetime

print("\n🧪 TESTING NEW CONVERSION FLOW")
print("="*70)

# Step 1: Get latest click
clicks_collection = db_instance.get_collection('clicks')
click = clicks_collection.find_one({}, sort=[('click_time', -1)])

if not click:
    print("❌ No clicks found! Click a tracking link first")
    sys.exit(1)

click_id = click['click_id']
print(f"\n1️⃣ Found Click: {click_id}")
print(f"   Offer: {click.get('offer_id')}")

# Step 2: Send test postback
print(f"\n2️⃣ Sending Test Postback...")

postback_data = {
    'transaction_id': f'TEST-{datetime.utcnow().strftime("%Y%m%d-%H%M%S")}',
    'survey_id': 'TEST-SURVEY',
    'username': 'testuser',
    'session_id': f'session-{datetime.utcnow().timestamp()}',
    'payout': '1.50',
    'currency': 'USD',
    'status': 'pass',
    'responses': {'q1': 'Test Answer'},
}

# Get postback URL (find partner key)
partners_collection = db_instance.get_collection('partners')
partner = partners_collection.find_one({})

if partner:
    unique_key = partner.get('unique_key')
    if unique_key:
        postback_url = f'http://localhost:5000/postback/{unique_key}'
        print(f"   URL: {postback_url}")
        
        try:
            response = requests.post(postback_url, data=postback_data, timeout=5)
            print(f"\n3️⃣ Response: {response.status_code} - {response.text}")
            
            if response.status_code == 200:
                # Step 3: Check if conversion was created
                conversions_collection = db_instance.get_collection('conversions')
                conversion = conversions_collection.find_one(
                    {'transaction_id': postback_data['transaction_id']}
                )
                
                if conversion:
                    print(f"\n✅ SUCCESS! Conversion Created:")
                    print(f"   Conversion ID: {conversion['conversion_id']}")
                    print(f"   Transaction: {conversion['transaction_id']}")
                    print(f"   Payout: ${conversion['payout']}")
                    print(f"   Survey ID: {conversion.get('survey_id')}")
                    print(f"\n✅ Should now be visible in Conversion Report!")
                else:
                    print(f"\n❌ Postback accepted but conversion NOT created")
                    print(f"   Check backend logs for errors")
            else:
                print(f"\n❌ Postback failed!")
                
        except Exception as e:
            print(f"\n❌ Error: {e}")
            print(f"   Make sure backend is running!")
    else:
        print(f"\n⚠️ Partner has no unique_key")
else:
    print(f"\n⚠️ No partner found - using direct analytics endpoint")
    
    # Try direct analytics postback
    try:
        response = requests.get(
            'http://localhost:5000/api/analytics/postback',
            params={
                'click_id': click_id,
                **postback_data
            },
            timeout=5
        )
        
        print(f"\n3️⃣ Direct Postback Response: {response.status_code} - {response.text}")
        
        if response.status_code == 200:
            conversions_collection = db_instance.get_collection('conversions')
            conversion = conversions_collection.find_one(
                {'transaction_id': postback_data['transaction_id']}
            )
            
            if conversion:
                print(f"\n✅ SUCCESS via Direct Endpoint!")
                print(f"   Conversion ID: {conversion['conversion_id']}")
                print(f"\n✅ Should now be visible in Conversion Report!")
            else:
                print(f"\n❌ Conversion NOT created")
        
    except Exception as e:
        print(f"\n❌ Error: {e}")

# Step 4: Check total conversions
conversions_collection = db_instance.get_collection('conversions')
total = conversions_collection.count_documents({})

print(f"\n4️⃣ Total Conversions in DB: {total}")
print(f"\n5️⃣ Check Conversion Report:")
print(f"   http://localhost:8080/dashboard/conversion-report")

print("\n" + "="*70)
