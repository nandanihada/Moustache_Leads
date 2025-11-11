#!/usr/bin/env python3
"""
Test Complete Tracking Flow: Click → Conversion → Reports
"""

import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

import requests
import time
from database import db_instance
import jwt

def get_user_id():
    """Get user ID from token"""
    try:
        with open('jwt_token.txt', 'r') as f:
            token = f.read().strip()
        decoded = jwt.decode(token, options={"verify_signature": False})
        return decoded.get('user_id')
    except Exception as e:
        print(f"❌ Error reading token: {e}")
        return None

def test_complete_flow():
    """Test the complete tracking flow"""
    
    print("\n🎯 TESTING COMPLETE TRACKING FLOW")
    print("="*70)
    
    user_id = get_user_id()
    if not user_id:
        print("❌ Could not get user ID")
        return
    
    print(f"\n👤 Publisher ID: {user_id}")
    
    # Step 1: Simulate Click
    print("\n" + "="*70)
    print("STEP 1: SIMULATING CLICK")
    print("="*70)
    
    tracking_url = f"http://localhost:5000/track/ML-00057?user_id={user_id}&sub1=test_flow"
    print(f"\n📍 Tracking URL: {tracking_url}")
    
    try:
        # Don't follow redirect, just record click
        response = requests.get(tracking_url, allow_redirects=False)
        print(f"\n✅ Click tracked! Status: {response.status_code}")
        
        if response.status_code == 302:
            redirect_url = response.headers.get('Location', '')
            print(f"↗️  Redirect URL: {redirect_url}")
            
            # Extract click_id from redirect URL
            if 'click_id=' in redirect_url:
                click_id = redirect_url.split('click_id=')[1].split('&')[0]
                print(f"🎫 Click ID: {click_id}")
            else:
                print("⚠️  No click_id in redirect URL")
                return
        else:
            print("⚠️  Expected redirect (302), got:", response.status_code)
            return
            
    except Exception as e:
        print(f"❌ Error tracking click: {e}")
        return
    
    # Wait a moment
    time.sleep(1)
    
    # Step 2: Verify Click in Database
    print("\n" + "="*70)
    print("STEP 2: VERIFYING CLICK IN DATABASE")
    print("="*70)
    
    clicks_collection = db_instance.get_collection('clicks')
    click = clicks_collection.find_one({'click_id': click_id})
    
    if click:
        print("\n✅ Click found in database!")
        print(f"\n📊 Click Details:")
        print(f"  Click ID: {click.get('click_id')}")
        print(f"  Offer ID: {click.get('offer_id')}")
        print(f"  Publisher: {click.get('user_id')}")
        print(f"  Country: {click.get('country', 'N/A')}")
        print(f"  Device: {click.get('device_type', 'N/A')}")
        print(f"  Sub ID 1: {click.get('sub_id1', 'N/A')}")
        print(f"  Timestamp: {click.get('click_time')}")
    else:
        print("❌ Click not found in database")
        return
    
    # Step 3: Simulate Conversion (Postback)
    print("\n" + "="*70)
    print("STEP 3: SIMULATING CONVERSION POSTBACK")
    print("="*70)
    
    postback_url = f"http://localhost:5000/api/analytics/postback"
    postback_params = {
        'click_id': click_id,
        'status': 'approved',
        'payout': '90.01',
        'transaction_id': f'TEST-TXN-{int(time.time())}'
    }
    
    print(f"\n📤 Sending postback:")
    print(f"  URL: {postback_url}")
    print(f"  Params: {postback_params}")
    
    try:
        response = requests.get(postback_url, params=postback_params)
        print(f"\n✅ Postback sent! Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"📦 Response: {data}")
            conversion_id = data.get('conversion_id', 'N/A')
            print(f"🎉 Conversion ID: {conversion_id}")
        else:
            print(f"⚠️  Response: {response.text}")
            return
            
    except Exception as e:
        print(f"❌ Error sending postback: {e}")
        return
    
    # Wait a moment
    time.sleep(1)
    
    # Step 4: Verify Conversion in Database
    print("\n" + "="*70)
    print("STEP 4: VERIFYING CONVERSION IN DATABASE")
    print("="*70)
    
    conversions_collection = db_instance.get_collection('conversions')
    conversion = conversions_collection.find_one({'click_id': click_id})
    
    if conversion:
        print("\n✅ Conversion found in database!")
        print(f"\n💰 Conversion Details:")
        print(f"  Conversion ID: {conversion.get('conversion_id')}")
        print(f"  Click ID: {conversion.get('click_id')}")
        print(f"  Transaction ID: {conversion.get('transaction_id')}")
        print(f"  Status: {conversion.get('status')}")
        print(f"  Payout: ${conversion.get('payout')}")
        print(f"  Publisher: {conversion.get('user_id')}")
        print(f"  Timestamp: {conversion.get('conversion_time')}")
    else:
        print("❌ Conversion not found in database")
        return
    
    # Step 5: Summary
    print("\n" + "="*70)
    print("STEP 5: DATA SUMMARY")
    print("="*70)
    
    # Count total clicks and conversions for this user
    total_clicks = clicks_collection.count_documents({'user_id': user_id})
    total_conversions = conversions_collection.count_documents({'user_id': user_id})
    
    # Calculate total payout
    pipeline = [
        {'$match': {'user_id': user_id, 'status': 'approved'}},
        {'$group': {'_id': None, 'total': {'$sum': '$payout'}}}
    ]
    result = list(conversions_collection.aggregate(pipeline))
    total_payout = result[0]['total'] if result else 0
    
    print(f"\n📊 Your Stats:")
    print(f"  Total Clicks: {total_clicks}")
    print(f"  Total Conversions: {total_conversions}")
    print(f"  Total Payout: ${total_payout:.2f}")
    
    if total_clicks > 0:
        cr = (total_conversions / total_clicks) * 100
        print(f"  Conversion Rate: {cr:.1f}%")
    
    # Step 6: Next Steps
    print("\n" + "="*70)
    print("✅ COMPLETE FLOW TEST SUCCESSFUL!")
    print("="*70)
    
    print(f"\n📍 View in Reports:")
    print(f"  Performance Report: http://localhost:8080/dashboard/performance-report")
    print(f"  Conversion Report: http://localhost:8080/dashboard/conversion-report")
    
    print(f"\n🎯 This test demonstrated:")
    print(f"  1. ✅ Click tracking (user clicks link)")
    print(f"  2. ✅ Database storage (click recorded)")
    print(f"  3. ✅ Conversion postback (survey completes)")
    print(f"  4. ✅ Conversion recording (payout credited)")
    print(f"  5. ✅ Stats aggregation (reports updated)")
    
    print(f"\n💡 Real Flow:")
    print(f"  1. Share your tracking link")
    print(f"  2. User clicks → Backend records click")
    print(f"  3. User completes survey")
    print(f"  4. Survey sends postback → Backend records conversion")
    print(f"  5. You earn ${conversion.get('payout')}!")
    print(f"  6. Shows in reports instantly")
    
    print("\n" + "="*70)

if __name__ == '__main__':
    test_complete_flow()
