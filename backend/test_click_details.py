#!/usr/bin/env python
"""
Test Click Details and History Endpoints
Shows how to view detailed click information
"""
import requests
import json

BASE_URL = "http://localhost:5000"

print("=" * 100)
print("🔍 DETAILED CLICK TRACKING - HOW TO VIEW CLICK DETAILS")
print("=" * 100)

# ============================================================================
# STEP 1: GET ADMIN TOKEN
# ============================================================================
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

# ============================================================================
# STEP 2: GET ALL CLICK HISTORY
# ============================================================================
print("\n2️⃣  GETTING ALL CLICK HISTORY...")

click_history_response = requests.get(
    f'{BASE_URL}/api/admin/offerwall/click-history?limit=10',
    headers=headers,
    timeout=5
)

if click_history_response.status_code == 200:
    data = click_history_response.json().get('data', [])
    print(f"""
✅ CLICK HISTORY (Latest 10 clicks):
   Total clicks in system: {click_history_response.json().get('total', 0)}
""")
    
    if data:
        print("   Recent Clicks:")
        for i, click in enumerate(data, 1):
            print(f"""
   {i}. Click ID: {click.get('click_id')}
      User: {click.get('user_id')}
      Publisher: {click.get('publisher_id')}
      Offer: {click.get('offer_name')} ({click.get('offer_id')})
      Time: {click.get('timestamp')}
      Device: {click.get('device', {}).get('type', 'Unknown')}
      Country: {click.get('geo', {}).get('country', 'Unknown')}
      IP: {click.get('network', {}).get('ip_address', 'Unknown')}
""")
else:
    print(f"❌ Failed to get click history: {click_history_response.status_code}")

# ============================================================================
# STEP 3: GET CLICKS BY SPECIFIC USER
# ============================================================================
print("\n3️⃣  GETTING CLICKS BY SPECIFIC USER (real_user_123)...")

user_clicks_response = requests.get(
    f'{BASE_URL}/api/admin/offerwall/click-history?user_id=real_user_123&limit=10',
    headers=headers,
    timeout=5
)

if user_clicks_response.status_code == 200:
    user_data = user_clicks_response.json().get('data', [])
    print(f"""
✅ CLICKS BY USER (real_user_123):
   Total clicks: {user_clicks_response.json().get('total', 0)}
""")
    
    if user_data:
        print("   User's Clicks:")
        for i, click in enumerate(user_data, 1):
            print(f"""
   {i}. Offer: {click.get('offer_name')}
      Time: {click.get('timestamp')}
      Publisher: {click.get('publisher_id')}
      Device: {click.get('device', {}).get('type')}
      Location: {click.get('geo', {}).get('city')}, {click.get('geo', {}).get('country')}
""")

# ============================================================================
# STEP 4: GET CLICKS BY SPECIFIC PUBLISHER
# ============================================================================
print("\n4️⃣  GETTING CLICKS BY SPECIFIC PUBLISHER (pub_001)...")

pub_clicks_response = requests.get(
    f'{BASE_URL}/api/admin/offerwall/click-history?publisher_id=pub_001&limit=10',
    headers=headers,
    timeout=5
)

if pub_clicks_response.status_code == 200:
    pub_data = pub_clicks_response.json().get('data', [])
    print(f"""
✅ CLICKS BY PUBLISHER (pub_001):
   Total clicks: {pub_clicks_response.json().get('total', 0)}
""")
    
    if pub_data:
        print("   Publisher's Clicks:")
        for i, click in enumerate(pub_data, 1):
            print(f"""
   {i}. User: {click.get('user_id')}
      Offer: {click.get('offer_name')}
      Time: {click.get('timestamp')}
      Device: {click.get('device', {}).get('type')}
      Fraud Status: {click.get('fraud_indicators', {}).get('fraud_status', 'clean')}
""")

# ============================================================================
# STEP 5: GET USER CLICK TIMELINE
# ============================================================================
print("\n5️⃣  GETTING USER CLICK TIMELINE (real_user_123)...")

timeline_response = requests.get(
    f'{BASE_URL}/api/admin/offerwall/user-click-timeline/real_user_123',
    headers=headers,
    timeout=5
)

if timeline_response.status_code == 200:
    timeline_data = timeline_response.json()
    print(f"""
✅ USER CLICK TIMELINE:
   User: {timeline_data.get('user_id')}
   Total Clicks: {timeline_data.get('total_clicks', 0)}
""")
    
    timeline = timeline_data.get('timeline', [])
    if timeline:
        print("   Timeline (newest first):")
        for i, click in enumerate(timeline, 1):
            print(f"""
   {i}. {click.get('timestamp')}
      Offer: {click.get('offer_name')}
      Publisher: {click.get('publisher_id')}
      Device: {click.get('device_type')}
      Location: {click.get('city')}, {click.get('country')}
      IP: {click.get('ip_address')}
      Fraud: {click.get('fraud_status')}
""")

# ============================================================================
# STEP 6: GET PUBLISHER CLICK TIMELINE
# ============================================================================
print("\n6️⃣  GETTING PUBLISHER CLICK TIMELINE (pub_001)...")

pub_timeline_response = requests.get(
    f'{BASE_URL}/api/admin/offerwall/publisher-click-timeline/pub_001',
    headers=headers,
    timeout=5
)

if pub_timeline_response.status_code == 200:
    pub_timeline_data = pub_timeline_response.json()
    print(f"""
✅ PUBLISHER CLICK TIMELINE:
   Publisher: {pub_timeline_data.get('publisher_id')}
   Total Clicks: {pub_timeline_data.get('total_clicks', 0)}
""")
    
    pub_timeline = pub_timeline_data.get('timeline', [])
    if pub_timeline:
        print("   Timeline (newest first):")
        for i, click in enumerate(pub_timeline[:5], 1):  # Show first 5
            print(f"""
   {i}. {click.get('timestamp')}
      User: {click.get('user_id')}
      Offer: {click.get('offer_name')}
      Device: {click.get('device_type')}
      Location: {click.get('city')}, {click.get('country')}
      IP: {click.get('ip_address')}
""")

# ============================================================================
# STEP 7: GET DETAILED CLICK INFORMATION
# ============================================================================
print("\n7️⃣  GETTING DETAILED CLICK INFORMATION...")

# Get first click ID from history
if click_history_response.status_code == 200 and data:
    first_click_id = data[0].get('click_id')
    
    print(f"\n   Fetching details for click: {first_click_id}")
    
    click_details_response = requests.get(
        f'{BASE_URL}/api/admin/offerwall/click-details/{first_click_id}',
        headers=headers,
        timeout=5
    )
    
    if click_details_response.status_code == 200:
        click_details = click_details_response.json().get('data', {})
        print(f"""
✅ DETAILED CLICK INFORMATION:

   BASIC INFO:
   - Click ID: {click_details.get('click_id')}
   - User ID: {click_details.get('user_id')}
   - Publisher ID: {click_details.get('publisher_id')}
   - Offer: {click_details.get('offer_name')} ({click_details.get('offer_id')})
   - Time: {click_details.get('timestamp')}

   DEVICE INFO:
   - Type: {click_details.get('device', {}).get('type')}
   - Model: {click_details.get('device', {}).get('model')}
   - OS: {click_details.get('device', {}).get('os')} {click_details.get('device', {}).get('os_version')}
   - Browser: {click_details.get('device', {}).get('browser')} {click_details.get('device', {}).get('browser_version')}
   - Screen: {click_details.get('device', {}).get('screen_resolution')}
   - Timezone: {click_details.get('device', {}).get('timezone')}

   NETWORK INFO:
   - IP Address: {click_details.get('network', {}).get('ip_address')}
   - ASN: {click_details.get('network', {}).get('asn')}
   - ISP: {click_details.get('network', {}).get('isp')}
   - VPN Detected: {click_details.get('network', {}).get('vpn_detected')}
   - Proxy Detected: {click_details.get('network', {}).get('proxy_detected')}
   - Tor Detected: {click_details.get('network', {}).get('tor_detected')}

   GEO LOCATION:
   - Country: {click_details.get('geo', {}).get('country')} ({click_details.get('geo', {}).get('country_code')})
   - Region: {click_details.get('geo', {}).get('region')}
   - City: {click_details.get('geo', {}).get('city')}
   - Postal Code: {click_details.get('geo', {}).get('postal_code')}
   - Coordinates: {click_details.get('geo', {}).get('latitude')}, {click_details.get('geo', {}).get('longitude')}

   FRAUD INDICATORS:
   - Fraud Status: {click_details.get('fraud_indicators', {}).get('fraud_status')}
   - Fraud Score: {click_details.get('fraud_indicators', {}).get('fraud_score')}
   - Duplicate Detected: {click_details.get('fraud_indicators', {}).get('duplicate_detected')}
   - Fast Click: {click_details.get('fraud_indicators', {}).get('fast_click')}
   - Bot-like: {click_details.get('fraud_indicators', {}).get('bot_like')}
""")

print("\n" + "=" * 100)
print("✅ CLICK DETAILS TEST COMPLETE")
print("=" * 100)
print("""
📊 AVAILABLE ENDPOINTS FOR CLICK TRACKING:

1. GET ALL CLICKS:
   GET /api/admin/offerwall/click-history?limit=50&skip=0
   Optional filters: user_id, publisher_id, offer_id

2. GET CLICKS BY USER:
   GET /api/admin/offerwall/click-history?user_id=USER_ID&limit=50

3. GET CLICKS BY PUBLISHER:
   GET /api/admin/offerwall/click-history?publisher_id=PUB_ID&limit=50

4. GET CLICKS BY OFFER:
   GET /api/admin/offerwall/click-history?offer_id=OFFER_ID&limit=50

5. GET USER CLICK TIMELINE:
   GET /api/admin/offerwall/user-click-timeline/USER_ID?limit=100

6. GET PUBLISHER CLICK TIMELINE:
   GET /api/admin/offerwall/publisher-click-timeline/PUB_ID?limit=100

7. GET DETAILED CLICK INFO:
   GET /api/admin/offerwall/click-details/CLICK_ID

📋 INFORMATION AVAILABLE FOR EACH CLICK:
   ✅ User ID, Publisher ID, Offer ID
   ✅ Exact timestamp of click
   ✅ Device type, model, OS, browser
   ✅ IP address, ASN, ISP, organization
   ✅ VPN/Proxy/Tor detection
   ✅ Country, region, city, coordinates
   ✅ Fraud indicators and fraud score
   ✅ Device fingerprinting data
""")
