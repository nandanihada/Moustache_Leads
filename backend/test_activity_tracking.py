#!/usr/bin/env python3
"""
Test Offerwall Activity Tracking
Tests click tracking and conversion tracking
"""

import requests
import json
import time
from datetime import datetime

# Configuration
BASE_URL = "http://localhost:5000"
USER_ID = "test_user"
PLACEMENT_ID = "4hN81lEwE7Fw1hnI"
OFFER_ID = "ML-00057"
OFFER_NAME = "My first offer"
OFFER_URL = "http://localhost:5000/track/ML-00057?user_id=test_user&sub1=4hN81lEwE7Fw1hnI"

def test_click_tracking():
    """Test click tracking"""
    print("🧪 Testing Click Tracking")
    print("=" * 50)
    
    # Create session first
    session_response = requests.post(f"{BASE_URL}/api/offerwall/session/create", json={
        "placement_id": PLACEMENT_ID,
        "user_id": USER_ID,
        "device_info": {
            "device_type": "desktop",
            "browser": "Chrome",
            "os": "Windows"
        }
    })
    
    if session_response.status_code != 200:
        print("❌ Failed to create session")
        return None
        
    session_data = session_response.json()
    session_id = session_data.get("session_id")
    print(f"✅ Session created: {session_id}")
    
    # Track click
    click_data = {
        "session_id": session_id,
        "offer_id": OFFER_ID,
        "placement_id": PLACEMENT_ID,
        "user_id": USER_ID,
        "offer_name": OFFER_NAME,
        "offer_url": OFFER_URL,
        "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "referrer": "http://localhost:5173/offerwall"
    }
    
    click_response = requests.post(f"{BASE_URL}/api/offerwall/track/click", json=click_data)
    
    if click_response.status_code == 200:
        click_result = click_response.json()
        print(f"✅ Click tracked successfully")
        print(f"   Click ID: {click_result.get('click_id')}")
        return session_id, click_result.get('click_id')
    else:
        print(f"❌ Click tracking failed: {click_response.status_code}")
        print(f"   Error: {click_response.text}")
        return None, None

def test_conversion_tracking(session_id, click_id):
    """Test conversion tracking"""
    print("\n🧪 Testing Conversion Tracking")
    print("=" * 50)
    
    conversion_data = {
        "session_id": session_id,
        "click_id": click_id,
        "offer_id": OFFER_ID,
        "placement_id": PLACEMENT_ID,
        "user_id": USER_ID,
        "payout_amount": 100,
        "offer_name": OFFER_NAME,
        "transaction_id": f"TXN_{int(time.time())}",
        "offer_network": "TestNetwork",
        "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    }
    
    conversion_response = requests.post(f"{BASE_URL}/api/offerwall/track/conversion", json=conversion_data)
    
    if conversion_response.status_code == 200:
        conversion_result = conversion_response.json()
        print(f"✅ Conversion tracked successfully")
        print(f"   Conversion ID: {conversion_result.get('conversion_id')}")
        return True
    else:
        print(f"❌ Conversion tracking failed: {conversion_response.status_code}")
        print(f"   Error: {conversion_response.text}")
        return False

def test_activity_endpoints():
    """Test activity tracking endpoints"""
    print("\n🧪 Testing Activity Endpoints")
    print("=" * 50)
    
    # Test clicks endpoint
    clicks_response = requests.get(f"{BASE_URL}/api/offerwall/user/clicks", params={
        "user_id": USER_ID,
        "placement_id": PLACEMENT_ID,
        "limit": "10"
    })
    
    if clicks_response.status_code == 200:
        clicks_data = clicks_response.json()
        print(f"✅ Clicks API: {clicks_data.get('total_clicks', 0)} clicks found")
        for click in clicks_data.get('clicks', [])[:3]:
            print(f"   - {click.get('offer_name')} ({click.get('offer_id')}) - {click.get('clicked_ago')}")
    else:
        print(f"❌ Clicks API Error: {clicks_response.status_code}")
    
    # Test activity endpoint
    activity_response = requests.get(f"{BASE_URL}/api/offerwall/user/activity", params={
        "user_id": USER_ID,
        "placement_id": PLACEMENT_ID,
        "limit": "10"
    })
    
    if activity_response.status_code == 200:
        activity_data = activity_response.json()
        print(f"✅ Activity API: {activity_data.get('total_completed', 0)} completed offers found")
        for activity in activity_data.get('activities', [])[:3]:
            print(f"   - {activity.get('offer_title')} ({activity.get('offer_id')}) - {activity.get('completed_ago')}")
    else:
        print(f"❌ Activity API Error: {activity_response.status_code}")
    
    # Test stats endpoint
    stats_response = requests.get(f"{BASE_URL}/api/offerwall/user/stats", params={
        "user_id": USER_ID,
        "placement_id": PLACEMENT_ID
    })
    
    if stats_response.status_code == 200:
        stats_data = stats_response.json()
        stats = stats_data.get('stats', {})
        print(f"✅ Stats API: {stats.get('offers_clicked', 0)} clicks, {stats.get('offers_completed', 0)} completed, {stats.get('total_earned', 0)} earned")
    else:
        print(f"❌ Stats API Error: {stats_response.status_code}")

def main():
    """Main test function"""
    print("🎯 Offerwall Activity Tracking Test")
    print("=" * 60)
    print(f"User ID: {USER_ID}")
    print(f"Placement ID: {PLACEMENT_ID}")
    print(f"Offer ID: {OFFER_ID}")
    print(f"Offer Name: {OFFER_NAME}")
    print("=" * 60)
    
    # Test click tracking
    session_id, click_id = test_click_tracking()
    
    if session_id and click_id:
        # Wait a moment then test conversion
        time.sleep(1)
        
        # Test conversion tracking
        conversion_success = test_conversion_tracking(session_id, click_id)
        
        if conversion_success:
            # Wait a moment for data to be processed
            time.sleep(1)
            
            # Test activity endpoints
            test_activity_endpoints()
    
    print("\n🎉 Test Complete!")
    print("\n📋 To test in frontend:")
    print(f"1. Open: http://localhost:5173/offerwall?placement_id={PLACEMENT_ID}&user_id={USER_ID}")
    print("2. Click on an offer")
    print("3. Click the BarChart3 icon to see activity")
    print("4. Should show the click and completion in the modal")

if __name__ == "__main__":
    main()
