#!/usr/bin/env python
"""
Debug Real Click Tracking
Check if real clicks from offerwall are being tracked in comprehensive system
"""
import requests
import json

BASE_URL = "http://localhost:5000"

print("=" * 100)
print("🔍 DEBUG REAL CLICK TRACKING")
print("=" * 100)

# Get admin token
print("\n1️⃣  GETTING ADMIN TOKEN...")
login_response = requests.post(
    f'{BASE_URL}/api/auth/login',
    json={'username': 'admin', 'password': 'admin123'},
    timeout=5
)

if login_response.status_code != 200:
    print(f"❌ Login failed: {login_response.status_code}")
    exit(1)

token = login_response.json().get('token')
print(f"✅ Token obtained")

headers = {
    'Authorization': f'Bearer {token}',
    'Content-Type': 'application/json'
}

# Check comprehensive clicks collection
print("\n2️⃣  CHECKING COMPREHENSIVE CLICKS COLLECTION...")
try:
    # This will check what's in the database
    click_history_response = requests.get(
        f'{BASE_URL}/api/admin/offerwall/click-history?limit=100',
        headers=headers,
        timeout=5
    )
    
    if click_history_response.status_code == 200:
        data = click_history_response.json()
        total_clicks = data.get('total', 0)
        clicks = data.get('data', [])
        
        print(f"""
✅ COMPREHENSIVE CLICKS COLLECTION:
   Total clicks in system: {total_clicks}
   Clicks returned: {len(clicks)}
""")
        
        if clicks:
            print("   Recent Clicks:")
            for i, click in enumerate(clicks[:5], 1):
                print(f"""
   {i}. User: {click.get('user_id')}
      Publisher: {click.get('publisher_id')}
      Offer: {click.get('offer_name')}
      Time: {click.get('timestamp')}
      Device: {click.get('device', {}).get('type')}
      Fraud Status: {click.get('fraud_indicators', {}).get('fraud_status')}
""")
        else:
            print("   ⚠️  NO CLICKS FOUND IN COMPREHENSIVE COLLECTION")
            print("   This means real clicks are NOT being tracked!")
    else:
        print(f"❌ Failed to get click history: {click_history_response.status_code}")
        print(click_history_response.text)
        
except Exception as e:
    print(f"❌ Error: {e}")

# Check regular offerwall clicks collection
print("\n3️⃣  CHECKING REGULAR OFFERWALL CLICKS COLLECTION...")
try:
    # Get from MongoDB directly through a test endpoint
    response = requests.get(
        f'{BASE_URL}/api/admin/offerwall/analytics/4hN81lEwE7Fw1hnI',
        headers=headers,
        timeout=5
    )
    
    if response.status_code == 200:
        data = response.json().get('data', {})
        print(f"""
✅ REGULAR OFFERWALL ANALYTICS:
   Clicks: {data.get('total_clicks', 0)}
   Conversions: {data.get('total_conversions', 0)}
""")
    else:
        print(f"⚠️  Could not get regular analytics: {response.status_code}")
        
except Exception as e:
    print(f"⚠️  Error checking regular analytics: {e}")

# Check if comprehensive tracker is initialized
print("\n4️⃣  CHECKING COMPREHENSIVE TRACKER STATUS...")
print("""
The comprehensive tracker should be initialized in app.py.
Check if you see this message in the backend logs:
   ✅ Comprehensive analytics tracker initialized

If you don't see this, the tracker isn't initialized!
""")

# Summary
print("\n" + "=" * 100)
print("📋 WHAT TO CHECK:")
print("=" * 100)
print("""
If NO clicks are showing:

1. ❌ Check backend logs for errors
   - Look for "Error in comprehensive tracking"
   - Look for "Comprehensive impression/click/conversion tracked"

2. ❌ Verify offerwall.py has comprehensive tracking code
   - Should have: "from routes.comprehensive_analytics import comprehensive_tracker"
   - Should have: "comp_tracker.track_click()" calls

3. ❌ Check if comprehensive_tracker is None
   - If it's None, the initialization failed
   - Check app.py initialization code

4. ❌ Verify MongoDB collections exist
   - offerwall_clicks_detailed
   - offerwall_impressions_detailed
   - offerwall_conversions_detailed

5. ❌ Check if click data is being sent to the endpoint
   - Add console.log in OfferwallProfessional.tsx
   - Verify click payload is being sent

NEXT STEPS:
1. Check backend logs for errors
2. Run: python test_real_offerwall_tracking.py
3. Then check this debug script again
4. If still no data, check the frontend is sending clicks
""")
