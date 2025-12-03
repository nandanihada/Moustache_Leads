#!/usr/bin/env python3
"""
Debug Click Tracking Script
Use this to test click tracking step by step
"""

import requests
import json
import time

BASE_URL = "http://localhost:5000"
USER_ID = "test_user"
PLACEMENT_ID = "4hN81lEwE7Fw1hnI"

def test_step_by_step():
    """Test click tracking step by step with detailed logging"""
    
    print("🚀 DEBUG CLICK TRACKING - STEP BY STEP")
    print("=" * 60)
    
    # Step 1: Check current state
    print("\n📊 STEP 1: Check current database state")
    clicks_response = requests.get(f"{BASE_URL}/api/offerwall/user/clicks", params={
        'user_id': USER_ID,
        'placement_id': PLACEMENT_ID
    })
    
    if clicks_response.status_code == 200:
        data = clicks_response.json()
        print(f"✅ Current clicks in database: {data.get('total_clicks', 0)}")
        for click in data.get('clicks', []):
            print(f"   - {click.get('offer_name')} ({click.get('clicked_ago')})")
    else:
        print(f"❌ Failed to get current clicks: {clicks_response.status_code}")
    
    # Step 2: Create session
    print(f"\n🔑 STEP 2: Create session")
    session_response = requests.post(f"{BASE_URL}/api/offerwall/session/create", json={
        'placement_id': PLACEMENT_ID,
        'user_id': USER_ID,
        'device_info': {
            'device_type': 'desktop',
            'browser': 'Chrome',
            'os': 'Windows'
        }
    })
    
    print(f"Session Response Status: {session_response.status_code}")
    if session_response.status_code == 200:
        session_data = session_response.json()
        session_id = session_data.get('session_id')
        print(f"✅ Session created: {session_id}")
    else:
        print(f"❌ Session creation failed: {session_response.text}")
        return
    
    # Step 3: Track a click
    print(f"\n🖱️  STEP 3: Track a click")
    click_data = {
        'session_id': session_id,
        'offer_id': 'ML-00057',
        'placement_id': PLACEMENT_ID,
        'user_id': USER_ID,
        'offer_name': 'DEBUG TEST OFFER',
        'offer_url': 'http://example.com/debug',
        'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'referrer': 'http://localhost:5173'
    }
    
    print(f"Click data being sent: {json.dumps(click_data, indent=2)}")
    
    click_response = requests.post(f"{BASE_URL}/api/offerwall/track/click", json=click_data)
    print(f"Click Response Status: {click_response.status_code}")
    
    if click_response.status_code == 200:
        click_result = click_response.json()
        click_id = click_result.get('click_id')
        print(f"✅ Click tracked successfully: {click_id}")
    else:
        print(f"❌ Click tracking failed: {click_response.text}")
        return
    
    # Step 4: Wait a moment and check database
    print(f"\n⏱️  STEP 4: Wait 2 seconds and check database")
    time.sleep(2)
    
    clicks_response = requests.get(f"{BASE_URL}/api/offerwall/user/clicks", params={
        'user_id': USER_ID,
        'placement_id': PLACEMENT_ID
    })
    
    print(f"Clicks Check Status: {clicks_response.status_code}")
    if clicks_response.status_code == 200:
        data = clicks_response.json()
        print(f"✅ Total clicks after tracking: {data.get('total_clicks', 0)}")
        print("Recent clicks:")
        for i, click in enumerate(data.get('clicks', [])):
            print(f"   {i+1}. {click.get('offer_name')} ({click.get('offer_id')}) - {click.get('clicked_ago')}")
            
        # Check if our debug click is there
        debug_click_found = False
        for click in data.get('clicks', []):
            if click.get('offer_name') == 'DEBUG TEST OFFER':
                debug_click_found = True
                print(f"✅ DEBUG CLICK FOUND: {click.get('offer_name')} - {click.get('clicked_ago')}")
                break
        
        if not debug_click_found:
            print("❌ DEBUG CLICK NOT FOUND IN DATABASE!")
    else:
        print(f"❌ Failed to check clicks: {clicks_response.text}")
    
    # Step 5: Test activity endpoint
    print(f"\n📈 STEP 5: Test activity endpoint")
    activity_response = requests.get(f"{BASE_URL}/api/offerwall/user/activity", params={
        'user_id': USER_ID,
        'placement_id': PLACEMENT_ID
    })
    
    print(f"Activity Response Status: {activity_response.status_code}")
    if activity_response.status_code == 200:
        activity_data = activity_response.json()
        print(f"✅ Activities: {activity_data.get('total_completed', 0)} completed offers")
    else:
        print(f"❌ Activity check failed: {activity_response.text}")
    
    # Step 6: Test stats endpoint
    print(f"\n📊 STEP 6: Test stats endpoint")
    stats_response = requests.get(f"{BASE_URL}/api/offerwall/user/stats", params={
        'user_id': USER_ID,
        'placement_id': PLACEMENT_ID
    })
    
    print(f"Stats Response Status: {stats_response.status_code}")
    if stats_response.status_code == 200:
        stats_data = stats_response.json()
        stats = stats_data.get('stats', {})
        print(f"✅ Stats: {stats.get('offers_clicked', 0)} clicked, {stats.get('offers_completed', 0)} completed")
        print(f"   Total earned: {stats.get('total_earned', 0)} coins")
    else:
        print(f"❌ Stats check failed: {stats_response.text}")
    
    print(f"\n🎯 DEBUG COMPLETE!")
    print(f"📱 Test in frontend: http://localhost:5173/offerwall?placement_id={PLACEMENT_ID}&user_id={USER_ID}")
    print(f"🔍 Check browser console and backend logs for detailed debugging")

if __name__ == "__main__":
    test_step_by_step()
