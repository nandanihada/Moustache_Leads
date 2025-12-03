#!/usr/bin/env python3
"""Check if clicks are being saved to database"""

from database import db_instance
import json

# Connect to database
print("🔗 Connecting to database...")
try:
    db = db_instance.get_db()
    print("✅ Connected to database")
except Exception as e:
    print(f"❌ Failed to connect: {e}")
    exit(1)

# Check offerwall_clicks_detailed collection
print("\n📊 Checking offerwall_clicks_detailed collection...")
clicks_col = db_instance.get_collection('offerwall_clicks_detailed')
count = clicks_col.count_documents({})
print(f"Total clicks in collection: {count}")

if count > 0:
    # Get the most recent click
    recent_click = clicks_col.find_one({}, sort=[('timestamp', -1)])
    print(f"\n✅ Most recent click:")
    print(json.dumps(recent_click, indent=2, default=str)[:500])
else:
    print("❌ No clicks found in collection")

# Check if comprehensive_tracking is working
print("\n🔍 Testing comprehensive tracking directly...")
try:
    from models.comprehensive_tracking import ComprehensiveOfferwallTracker
    
    tracker = ComprehensiveOfferwallTracker(db_instance)
    
    # Try to track a test click
    test_data = {
        'session_id': 'test_session_123',
        'user_id': 'test_user_123',
        'offer_id': 'test_offer_123',
        'offer_name': 'Test Offer',
        'placement_id': 'test_placement_123',
        'publisher_id': 'test_pub_123',
        'publisher_name': 'Test Publisher',
        'device_type': 'desktop',
        'browser': 'Chrome',
        'os': 'Windows',
        'country': 'US',
        'city': 'New York',
        'ip_address': '192.168.1.1',
        'isp': 'Test ISP',
        'asn': 'AS12345',
        'organization': 'Test Org',
        'fraud_score': 0,
        'fraud_status': 'clean',
    }
    
    click_id, error = tracker.track_click(test_data)
    
    if error:
        print(f"❌ Error tracking click: {error}")
    else:
        print(f"✅ Click tracked: {click_id}")
        
        # Check if it was saved
        saved_click = clicks_col.find_one({'click_id': click_id})
        if saved_click:
            print(f"✅ Click found in database!")
            print(f"Device info: {saved_click.get('device', {})}")
            print(f"Geo info: {saved_click.get('geo', {})}")
        else:
            print(f"❌ Click NOT found in database after tracking!")
            
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()
