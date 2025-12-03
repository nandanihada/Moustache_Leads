#!/usr/bin/env python
"""
Test: Verify conversions are being tracked after the fast_conversion fix
"""
import requests
import json
import uuid
from datetime import datetime

BASE_URL = "http://localhost:5000"

print("=" * 100)
print("🔍 TESTING CONVERSION TRACKING AFTER FIX")
print("=" * 100)

try:
    # Step 1: Create a session
    print("\n1️⃣  CREATING SESSION...")
    session_response = requests.post(
        f'{BASE_URL}/api/offerwall/session/create',
        json={
            'user_id': 'test_conversion_user',
            'placement_id': '4hN81lEwE7Fw1hnI',
            'device_type': 'desktop',
            'browser': 'Chrome',
            'os': 'Windows'
        },
        timeout=5
    )
    
    if session_response.status_code != 200:
        print(f"❌ Session creation failed: {session_response.status_code}")
        print(session_response.text)
        exit(1)
    
    session_data = session_response.json()
    session_id = session_data.get('session_id')
    print(f"✅ Session created: {session_id}")
    
    # Step 2: Track a click
    print("\n2️⃣  TRACKING CLICK...")
    click_response = requests.post(
        f'{BASE_URL}/api/offerwall/track/click',
        json={
            'session_id': session_id,
            'user_id': 'test_conversion_user',
            'placement_id': '4hN81lEwE7Fw1hnI',
            'offer_id': 'test_offer_123',
            'offer_name': 'Test Offer for Conversion',
            'device_type': 'desktop',
            'browser': 'Chrome',
            'os': 'Windows'
        },
        timeout=5
    )
    
    if click_response.status_code != 200:
        print(f"❌ Click tracking failed: {click_response.status_code}")
        print(click_response.text)
        exit(1)
    
    click_data = click_response.json()
    click_id = click_data.get('click_id')
    print(f"✅ Click tracked: {click_id}")
    
    # Step 3: Wait 3 seconds (to avoid fast_conversion fraud flag)
    print("\n3️⃣  WAITING 3 SECONDS (to avoid fast_conversion fraud)...")
    import time
    time.sleep(3)
    print("✅ Waited 3 seconds")
    
    # Step 4: Track a conversion
    print("\n4️⃣  TRACKING CONVERSION...")
    conversion_response = requests.post(
        f'{BASE_URL}/api/offerwall/track/conversion',
        json={
            'session_id': session_id,
            'click_id': click_id,
            'offer_id': 'test_offer_123',
            'offer_name': 'Test Offer for Conversion',
            'placement_id': '4hN81lEwE7Fw1hnI',
            'user_id': 'test_conversion_user',
            'payout_amount': 10.00,
            'transaction_id': str(uuid.uuid4()),
            'offer_network': 'test_network'
        },
        timeout=5
    )
    
    if conversion_response.status_code != 200:
        print(f"❌ Conversion tracking failed: {conversion_response.status_code}")
        print(conversion_response.text)
        exit(1)
    
    conversion_data = conversion_response.json()
    conversion_id = conversion_data.get('conversion_id')
    print(f"✅ Conversion tracked: {conversion_id}")
    
    # Step 5: Verify in database
    print("\n5️⃣  VERIFYING IN DATABASE...")
    from database import db_instance
    
    conversions_col = db_instance.get_collection('offerwall_conversions')
    conversion = conversions_col.find_one({'conversion_id': conversion_id})
    
    if conversion:
        print(f"✅ Conversion found in database")
        print(f"   User: {conversion.get('user_id')}")
        print(f"   Offer: {conversion.get('offer_id')}")
        print(f"   Payout: ${conversion.get('payout_amount')}")
        print(f"   Points: {conversion.get('points_awarded')}")
        print(f"   Status: {conversion.get('status')}")
    else:
        print(f"❌ Conversion NOT found in database")
    
    # Step 6: Check user points
    print("\n6️⃣  CHECKING USER POINTS...")
    user_points_col = db_instance.get_collection('user_points')
    user_points = user_points_col.find_one({'user_id': 'test_conversion_user'})
    
    if user_points:
        print(f"✅ User points found")
        print(f"   Total Points: {user_points.get('total_points', 0)}")
        print(f"   Available: {user_points.get('available_points', 0)}")
        print(f"   Redeemed: {user_points.get('redeemed_points', 0)}")
    else:
        print(f"❌ User points NOT found")
    
    print("\n" + "=" * 100)
    print("✅ CONVERSION TRACKING TEST COMPLETE")
    print("=" * 100)
    
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()
