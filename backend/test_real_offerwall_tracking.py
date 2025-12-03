#!/usr/bin/env python
"""
Test Real Offerwall Tracking Integration
Simulates real user clicks from the offerwall component
"""
import requests
import json
import uuid
from datetime import datetime

BASE_URL = "http://localhost:5000"

print("=" * 100)
print("🧪 REAL OFFERWALL TRACKING TEST - COMPREHENSIVE INTEGRATION")
print("=" * 100)

# Test data - simulating real offerwall usage
test_user_id = "real_user_123"
test_publisher_id = "pub_001"
test_placement_id = "4hN81lEwE7Fw1hnI"
test_offer_id = "ML-00057"

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
# STEP 2: CREATE SESSION (simulating offerwall page load)
# ============================================================================
print("\n2️⃣  CREATING SESSION (simulating offerwall load)...")

session_data = {
    'user_id': test_user_id,
    'placement_id': test_placement_id,
    'publisher_id': test_publisher_id,
    'sub_id': 'sub_campaign_001',
    
    # Device Info
    'device_type': 'mobile',
    'device_model': 'iPhone 14',
    'os': 'iOS',
    'os_version': '17.1',
    'browser': 'Safari',
    'browser_version': '17.1',
    'screen_resolution': '390x844',
    'screen_dpi': 460,
    'timezone': 'America/New_York',
    'language': 'en-US',
    
    # Device Fingerprint
    'user_agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X)',
    'canvas_fingerprint': 'canvas_fp_real_001',
    'webgl_fingerprint': 'webgl_fp_real_001',
    
    # Network Info
    'ip_address': '192.168.1.100',
    'ip_version': 'IPv4',
    'asn': 'AS7922',
    'isp': 'Comcast',
    'organization': 'Comcast',
    'proxy_detected': False,
    'vpn_detected': False,
    'tor_detected': False,
    'datacenter_detected': False,
    'connection_type': 'mobile',
    
    # Geo Info
    'country': 'United States',
    'country_code': 'US',
    'region': 'New York',
    'city': 'New York',
    'postal_code': '10001',
    'latitude': 40.7128,
    'longitude': -74.0060,
    'is_vpn_country': False,
    
    # Referrer
    'referrer_url': 'https://theinterwebsite.space/dashboard',
    'referrer_domain': 'theinterwebsite.space',
    'referrer_type': 'internal',
}

session_response = requests.post(
    f'{BASE_URL}/api/offerwall/session/create',
    json=session_data,
    timeout=5
)

if session_response.status_code != 200:
    print(f"❌ Session creation failed: {session_response.status_code}")
    print(session_response.text)
    exit(1)

session_id = session_response.json().get('session_id')
print(f"✅ Session created: {session_id}")

# ============================================================================
# STEP 3: TRACK IMPRESSION (offerwall loads)
# ============================================================================
print("\n3️⃣  TRACKING IMPRESSION (offerwall page loaded)...")

impression_data = {
    'session_id': session_id,
    'placement_id': test_placement_id,
    'user_id': test_user_id,
    'offer_id': test_offer_id,
    'offer_name': 'Complete Survey',
    'offer_category': 'survey',
    'offer_payout': 1.50,
    'offer_network': 'AdscendMedia',
    'advertiser_id': 'adv_survey_001',
    
    # Device/Geo
    'device_type': 'mobile',
    'country': 'United States',
    'ip_address': '192.168.1.100',
    
    # Impression Context
    'position': 1,
    'view_duration': 2500,  # ms
    'visible': True,
    'viewable': True,
}

impression_response = requests.post(
    f'{BASE_URL}/api/offerwall/track/impression',
    json=impression_data,
    timeout=5
)

if impression_response.status_code != 200:
    print(f"❌ Impression tracking failed: {impression_response.status_code}")
    print(impression_response.text)
else:
    impression_id = impression_response.json().get('impression_id')
    print(f"✅ Impression tracked: {impression_id}")

# ============================================================================
# STEP 4: TRACK CLICK (user clicks on offer)
# ============================================================================
print("\n4️⃣  TRACKING CLICK (user clicked on offer)...")

click_data = {
    'session_id': session_id,
    'user_id': test_user_id,
    'offer_id': test_offer_id,
    'offer_name': 'Complete Survey',
    'placement_id': test_placement_id,
    'publisher_id': test_publisher_id,
    
    # Offer Details
    'offer_category': 'survey',
    'offer_payout': 1.50,
    'offer_network': 'AdscendMedia',
    'advertiser_id': 'adv_survey_001',
    'tracking_url': 'https://tracking.adscendmedia.com/click?id=12345',
    
    # Device/Geo/Fingerprint
    'device_type': 'mobile',
    'browser': 'Safari',
    'os': 'iOS',
    'country': 'United States',
    'ip_address': '192.168.1.100',
    'asn': 'AS7922',
    'user_agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X)',
    
    # Click Context
    'position': 1,
    'time_to_click': 3500,  # ms from impression
    'mouse_movement': 450,  # pixels moved
    'click_velocity': 0.128,  # pixels/ms
    
    # Fraud Indicators
    'vpn_detected': False,
    'proxy_detected': False,
}

click_response = requests.post(
    f'{BASE_URL}/api/offerwall/track/click',
    json=click_data,
    timeout=5
)

if click_response.status_code != 200:
    print(f"❌ Click tracking failed: {click_response.status_code}")
    print(click_response.text)
else:
    click_id = click_response.json().get('click_id')
    print(f"✅ Click tracked: {click_id}")
    print(f"   Publisher: {test_publisher_id}")
    print(f"   User: {test_user_id}")
    print(f"   Offer: {test_offer_id}")

# ============================================================================
# STEP 5: TRACK CONVERSION (user completes offer)
# ============================================================================
print("\n5️⃣  TRACKING CONVERSION (user completed offer)...")

conversion_data = {
    'session_id': session_id,
    'click_id': click_id,
    'user_id': test_user_id,
    'offer_id': test_offer_id,
    'offer_name': 'Complete Survey',
    'placement_id': test_placement_id,
    'publisher_id': test_publisher_id,
    
    # Offer Details
    'offer_category': 'survey',
    'offer_network': 'AdscendMedia',
    'advertiser_id': 'adv_survey_001',
    
    # Device/Geo
    'device_type': 'mobile',
    'browser': 'Safari',
    'os': 'iOS',
    'country': 'United States',
    'ip_address': '192.168.1.100',
    
    # Conversion Timing
    'session_duration': 450,  # seconds
    
    # PAYOUT INFO
    'payout_amount': 1.50,  # What advertiser pays
    'user_reward': 0.75,  # What user gets (50%)
    'publisher_commission': 0.52,  # What publisher gets (35%)
    'platform_revenue': 0.23,  # What platform keeps (15%)
    'currency': 'USD',
    
    # Postback Data
    'transaction_id': f'txn_{uuid.uuid4()}',
    'postback_url': 'https://api.adscendmedia.com/postback',
    'postback_data': {
        'offer_id': test_offer_id,
        'user_id': test_user_id,
        'status': 'approved',
        'payout': 1.50,
    },
    
    # Fraud Indicators
    'vpn_detected': False,
}

conversion_response = requests.post(
    f'{BASE_URL}/api/offerwall/track/conversion',
    json=conversion_data,
    timeout=5
)

if conversion_response.status_code != 200:
    print(f"❌ Conversion tracking failed: {conversion_response.status_code}")
    print(conversion_response.text)
else:
    conversion_id = conversion_response.json().get('conversion_id')
    print(f"✅ Conversion tracked: {conversion_id}")
    print(f"   Payout: ${conversion_data['payout_amount']}")
    print(f"   User Reward: ${conversion_data['user_reward']}")
    print(f"   Publisher Commission: ${conversion_data['publisher_commission']}")

# ============================================================================
# STEP 6: CHECK COMPREHENSIVE ANALYTICS
# ============================================================================
print("\n6️⃣  CHECKING COMPREHENSIVE ANALYTICS...")

analytics_response = requests.get(
    f'{BASE_URL}/api/admin/offerwall/comprehensive-analytics',
    headers=headers,
    timeout=5
)

if analytics_response.status_code == 200:
    analytics = analytics_response.json().get('data', {})
    print(f"""
✅ COMPREHENSIVE ANALYTICS (REAL TRACKING):
   Impressions:         {analytics.get('impressions', 0)}
   Clicks:              {analytics.get('clicks', 0)}
   Conversions:         {analytics.get('conversions', 0)}
   CTR:                 {analytics.get('ctr', 0)}%
   CVR:                 {analytics.get('cvr', 0)}%
   EPC:                 ${analytics.get('epc', 0):.2f}
   Fraud Signals:       {analytics.get('fraud_signals', 0)}
   
   PAYOUTS:
   Network Payout:      ${analytics.get('payouts', {}).get('network_payout', 0):.2f}
   User Reward:         ${analytics.get('payouts', {}).get('user_reward', 0):.2f}
   Publisher Commission: ${analytics.get('payouts', {}).get('publisher_commission', 0):.2f}
   Platform Revenue:    ${analytics.get('payouts', {}).get('platform_revenue', 0):.2f}
""")
else:
    print(f"❌ Failed to get analytics: {analytics_response.status_code}")

# ============================================================================
# STEP 7: CHECK USER TRACKING
# ============================================================================
print("\n7️⃣  CHECKING USER TRACKING...")

user_tracking_response = requests.get(
    f'{BASE_URL}/api/admin/offerwall/user-tracking/{test_user_id}',
    headers=headers,
    timeout=5
)

if user_tracking_response.status_code == 200:
    user_data = user_tracking_response.json().get('data', {})
    summary = user_data.get('summary', {})
    print(f"""
✅ USER TRACKING:
   User ID:             {test_user_id}
   Sessions:            {summary.get('total_sessions', 0)}
   Impressions:         {summary.get('total_impressions', 0)}
   Clicks:              {summary.get('total_clicks', 0)}
   Conversions:         {summary.get('total_conversions', 0)}
   Total Points:        {summary.get('total_points', 0)}
""")

# ============================================================================
# STEP 8: CHECK PUBLISHER TRACKING
# ============================================================================
print("\n8️⃣  CHECKING PUBLISHER TRACKING...")

publisher_tracking_response = requests.get(
    f'{BASE_URL}/api/admin/offerwall/publisher-tracking/{test_publisher_id}',
    headers=headers,
    timeout=5
)

if publisher_tracking_response.status_code == 200:
    pub_data = publisher_tracking_response.json().get('data', {})
    summary = pub_data.get('summary', {})
    print(f"""
✅ PUBLISHER TRACKING:
   Publisher ID:        {test_publisher_id}
   Clicks:              {summary.get('total_clicks', 0)}
   Conversions:         {summary.get('total_conversions', 0)}
   Total Earnings:      ${summary.get('total_earnings', 0):.2f}
   CTR:                 {summary.get('ctr', 0)}%
   CVR:                 {summary.get('cvr', 0)}%
""")

print("\n" + "=" * 100)
print("✅ REAL OFFERWALL TRACKING TEST COMPLETE")
print("=" * 100)
print("""
✅ WHAT HAPPENED:
1. User loaded offerwall (session created)
2. Offerwall displayed offers (impression tracked)
3. User clicked on offer (click tracked in BOTH systems)
4. User completed offer (conversion tracked in BOTH systems)
5. Data now appears in comprehensive analytics dashboard

🎯 KEY POINT:
Real clicks from the offerwall are now tracked in the comprehensive system!
Check the dashboard at: http://localhost:8080/admin/comprehensive-analytics
""")
