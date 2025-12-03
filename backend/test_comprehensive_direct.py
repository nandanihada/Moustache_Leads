#!/usr/bin/env python
"""
Test: Directly test comprehensive tracker
"""
from database import db_instance
from models.comprehensive_tracking import ComprehensiveOfferwallTracker
import datetime

print("=" * 100)
print("🔍 TESTING COMPREHENSIVE TRACKER DIRECTLY")
print("=" * 100)

# Initialize tracker
print("\n1️⃣  INITIALIZING TRACKER...")
try:
    tracker = ComprehensiveOfferwallTracker(db_instance)
    print("✅ Tracker initialized")
except Exception as e:
    print(f"❌ Error: {e}")
    exit(1)

# Track a click
print("\n2️⃣  TRACKING A CLICK...")
try:
    click_data = {
        'session_id': 'test_session_direct',
        'user_id': 'bhindi_direct',
        'placement_id': '4hN81lEwE7Fw1hnI',
        'offer_id': 'ML-00065',
        'offer_name': 'Test Direct Click',
        'publisher_id': 'pub_001',
        'device_type': 'desktop',
        'browser': 'Chrome',
        'os': 'Windows',
        'country': 'United States',
        'ip_address': '192.168.1.1',
    }
    
    click_id, error = tracker.track_click(click_data)
    
    if error:
        print(f"❌ Error: {error}")
    else:
        print(f"✅ Click tracked: {click_id}")
        
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()

# Query the click
print("\n3️⃣  QUERYING THE CLICK...")
try:
    clicks_col = db_instance.get_collection('offerwall_clicks_detailed')
    query = {'user_id': 'bhindi_direct', 'placement_id': '4hN81lEwE7Fw1hnI'}
    clicks = list(clicks_col.find(query))
    
    print(f"✅ Found {len(clicks)} clicks")
    
    if clicks:
        for i, click in enumerate(clicks, 1):
            print(f"\n   Click {i}:")
            print(f"   - click_id: {click.get('click_id')}")
            print(f"   - user_id: {click.get('user_id')}")
            print(f"   - offer_name: {click.get('offer_name')}")
            print(f"   - timestamp: {click.get('timestamp')}")
    else:
        print("❌ NO CLICKS FOUND!")
        
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()

print("\n" + "=" * 100)
print("✅ TEST COMPLETE")
print("=" * 100)
