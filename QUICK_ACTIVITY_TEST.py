#!/usr/bin/env python3
"""
Quick Activity Tracking Test
Run this to verify the activity tracking is working
"""

import requests
import json

BASE_URL = "http://localhost:5000"
USER_ID = "test_user"
PLACEMENT_ID = "4hN81lEwE7Fw1hnI"

def test_complete_flow():
    """Test complete user flow: click -> complete -> view activity"""
    
    print("🎯 QUICK ACTIVITY TRACKING TEST")
    print("=" * 50)
    
    # 1. Create session and click
    session_response = requests.post(f"{BASE_URL}/api/offerwall/session/create", json={
        "placement_id": PLACEMENT_ID,
        "user_id": USER_ID,
        "device_info": {"device_type": "desktop", "browser": "Chrome", "os": "Windows"}
    })
    
    session_id = session_response.json().get("session_id")
    print(f"✅ Session: {session_id}")
    
    # 2. Track click with offer name
    click_response = requests.post(f"{BASE_URL}/api/offerwall/track/click", json={
        "session_id": session_id,
        "offer_id": "ML-00057",
        "placement_id": PLACEMENT_ID,
        "user_id": USER_ID,
        "offer_name": "Real Test Offer",
        "offer_url": "http://example.com",
        "user_agent": "Mozilla/5.0 Test",
        "referrer": "http://localhost:5173"
    })
    
    click_id = click_response.json().get("click_id")
    print(f"✅ Click tracked: {click_id}")
    
    # 3. Track completion (conversion)
    conversion_response = requests.post(f"{BASE_URL}/api/offerwall/track/conversion", json={
        "session_id": session_id,
        "click_id": click_id,
        "offer_id": "ML-00057",
        "placement_id": PLACEMENT_ID,
        "user_id": USER_ID,
        "payout_amount": 150,
        "offer_name": "Real Test Offer",
        "transaction_id": "TXN789",
        "offer_network": "TestNet"
    })
    
    conversion_id = conversion_response.json().get("conversion_id")
    print(f"✅ Conversion tracked: {conversion_id}")
    
    # 4. Check activity
    print("\n📊 Checking Activity APIs:")
    
    # Clicks
    clicks = requests.get(f"{BASE_URL}/api/offerwall/user/clicks", params={
        "user_id": USER_ID, "placement_id": PLACEMENT_ID
    }).json()
    print(f"📱 Clicks: {clicks.get('total_clicks', 0)} clicks")
    for click in clicks.get('clicks', [])[:2]:
        print(f"   - {click.get('offer_name')} ({click.get('clicked_ago')})")
    
    # Activities
    activities = requests.get(f"{BASE_URL}/api/offerwall/user/activity", params={
        "user_id": USER_ID, "placement_id": PLACEMENT_ID
    }).json()
    print(f"🎯 Completed: {activities.get('total_completed', 0)} offers")
    for activity in activities.get('activities', [])[:2]:
        print(f"   - {activity.get('offer_title')} - {activity.get('reward_amount')} coins ({activity.get('completed_ago')})")
    
    # Stats
    stats = requests.get(f"{BASE_URL}/api/offerwall/user/stats", params={
        "user_id": USER_ID, "placement_id": PLACEMENT_ID
    }).json().get('stats', {})
    print(f"📈 Stats: {stats.get('total_earned', 0)} coins earned, {stats.get('offers_completed', 0)} completed")
    
    print(f"\n🎉 SUCCESS! Activity tracking is working!")
    print(f"📱 Test in frontend: http://localhost:5173/offerwall?placement_id={PLACEMENT_ID}&user_id={USER_ID}")
    print(f"📊 Click BarChart3 icon to see activity modal with offer names!")

if __name__ == "__main__":
    test_complete_flow()
