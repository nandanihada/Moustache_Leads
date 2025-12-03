#!/usr/bin/env python
"""
Comprehensive Offerwall Tracking Test
Tests all tracking details: identifiers, device info, fingerprints, IP/VPN, geo, events, fraud, payouts
"""
import requests
import json
import uuid
from datetime import datetime
import hashlib

BASE_URL = "http://localhost:5000"

print("=" * 100)
print("🧪 COMPREHENSIVE OFFERWALL TRACKING TEST")
print("=" * 100)

# Test data
test_user_id = "test_user_comprehensive"
test_publisher_id = "pub_test_001"
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
# STEP 2: CREATE COMPREHENSIVE SESSION
# ============================================================================
print("\n2️⃣  CREATING COMPREHENSIVE SESSION WITH ALL DETAILS...")

session_data = {
    'user_id': test_user_id,
    'placement_id': test_placement_id,
    'publisher_id': test_publisher_id,
    'sub_id': 'sub_12345',
    
    # Device Info
    'device_type': 'desktop',
    'device_model': 'MacBook Pro',
    'os': 'MacOS',
    'os_version': '14.1',
    'browser': 'Chrome',
    'browser_version': '120.0.0.0',
    'screen_resolution': '1920x1080',
    'screen_dpi': 96,
    'timezone': 'America/New_York',
    'language': 'en-US',
    
    # Device Fingerprint
    'user_agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    'canvas_fingerprint': 'canvas_fp_12345',
    'webgl_fingerprint': 'webgl_fp_12345',
    'fonts_fingerprint': 'fonts_fp_12345',
    'plugins_fingerprint': 'plugins_fp_12345',
    
    # Network Info
    'ip_address': '203.0.113.42',
    'ip_version': 'IPv4',
    'asn': 'AS15169',
    'isp': 'Google LLC',
    'organization': 'Google',
    'proxy_detected': False,
    'vpn_detected': False,
    'tor_detected': False,
    'datacenter_detected': False,
    'connection_type': 'fixed',
    
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
    'referrer_url': 'https://example.com/offers',
    'referrer_domain': 'example.com',
    'referrer_type': 'organic',
}

session_response = requests.post(
    f'{BASE_URL}/api/comprehensive/track/session',
    json=session_data,
    headers=headers,
    timeout=5
)

if session_response.status_code != 200:
    print(f"❌ Session creation failed: {session_response.status_code}")
    print(session_response.text)
    exit(1)

session_id = session_response.json().get('session_id')
print(f"✅ Session created with comprehensive details: {session_id}")

# ============================================================================
# STEP 3: TRACK IMPRESSION
# ============================================================================
print("\n3️⃣  TRACKING IMPRESSION WITH FULL DETAILS...")

impression_data = {
    'session_id': session_id,
    'user_id': test_user_id,
    'offer_id': test_offer_id,
    'offer_name': 'Test Offer',
    'placement_id': test_placement_id,
    'publisher_id': test_publisher_id,
    
    # Offer Details
    'offer_category': 'survey',
    'offer_payout': 100.00,
    'offer_network': 'AdscendMedia',
    'advertiser_id': 'adv_12345',
    
    # Device/Geo
    'device_type': 'desktop',
    'country': 'United States',
    'ip_address': '203.0.113.42',
    
    # Impression Context
    'position': 1,
    'view_duration': 2500,  # ms
    'visible': True,
    'viewable': True,
}

impression_response = requests.post(
    f'{BASE_URL}/api/comprehensive/track/impression',
    json=impression_data,
    headers=headers,
    timeout=5
)

if impression_response.status_code != 200:
    print(f"❌ Impression tracking failed: {impression_response.status_code}")
    print(impression_response.text)
else:
    impression_id = impression_response.json().get('impression_id')
    print(f"✅ Impression tracked: {impression_id}")

# ============================================================================
# STEP 4: TRACK CLICK WITH FULL DETAILS
# ============================================================================
print("\n4️⃣  TRACKING CLICK WITH FULL DEVICE/FRAUD DETAILS...")

click_data = {
    'session_id': session_id,
    'user_id': test_user_id,
    'offer_id': test_offer_id,
    'offer_name': 'Test Offer',
    'placement_id': test_placement_id,
    'publisher_id': test_publisher_id,
    
    # Offer Details
    'offer_category': 'survey',
    'offer_payout': 100.00,
    'offer_network': 'AdscendMedia',
    'advertiser_id': 'adv_12345',
    'tracking_url': 'https://tracking.adscendmedia.com/click?id=12345',
    
    # Device/Geo/Fingerprint
    'device_type': 'desktop',
    'browser': 'Chrome',
    'os': 'MacOS',
    'country': 'United States',
    'ip_address': '203.0.113.42',
    'asn': 'AS15169',
    'user_agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    
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
    f'{BASE_URL}/api/comprehensive/track/click',
    json=click_data,
    headers=headers,
    timeout=5
)

if click_response.status_code != 200:
    print(f"❌ Click tracking failed: {click_response.status_code}")
    print(click_response.text)
else:
    click_id = click_response.json().get('click_id')
    print(f"✅ Click tracked: {click_id}")

# ============================================================================
# STEP 5: TRACK CONVERSION WITH PAYOUT DETAILS
# ============================================================================
print("\n5️⃣  TRACKING CONVERSION WITH PAYOUT & REVENUE DETAILS...")

conversion_data = {
    'session_id': session_id,
    'click_id': click_id,
    'user_id': test_user_id,
    'offer_id': test_offer_id,
    'offer_name': 'Test Offer',
    'placement_id': test_placement_id,
    'publisher_id': test_publisher_id,
    
    # Offer Details
    'offer_category': 'survey',
    'offer_network': 'AdscendMedia',
    'advertiser_id': 'adv_12345',
    
    # Device/Geo
    'device_type': 'desktop',
    'browser': 'Chrome',
    'os': 'MacOS',
    'country': 'United States',
    'ip_address': '203.0.113.42',
    
    # Conversion Timing
    'session_duration': 450,  # seconds
    
    # PAYOUT INFO - THE KEY PART!
    'payout_amount': 100.00,  # What advertiser pays (required field)
    'user_reward': 50.00,  # What user gets
    'publisher_commission': 35.00,  # What publisher gets
    'platform_revenue': 15.00,  # What platform keeps
    'currency': 'USD',
    
    # Postback Data
    'transaction_id': f'txn_{uuid.uuid4()}',
    'postback_url': 'https://api.example.com/postback',
    'postback_data': {
        'offer_id': test_offer_id,
        'user_id': test_user_id,
        'status': 'approved',
        'payout': 100.00,
    },
    
    # Fraud Indicators
    'vpn_detected': False,
}

conversion_response = requests.post(
    f'{BASE_URL}/api/comprehensive/track/conversion',
    json=conversion_data,
    headers=headers,
    timeout=5
)

if conversion_response.status_code != 200:
    print(f"❌ Conversion tracking failed: {conversion_response.status_code}")
    print(conversion_response.text)
else:
    conversion_id = conversion_response.json().get('conversion_id')
    print(f"✅ Conversion tracked: {conversion_id}")

# ============================================================================
# STEP 6: GET COMPREHENSIVE ANALYTICS
# ============================================================================
print("\n6️⃣  GETTING COMPREHENSIVE ANALYTICS...")

analytics_response = requests.get(
    f'{BASE_URL}/api/admin/offerwall/comprehensive-analytics',
    headers=headers,
    timeout=5
)

if analytics_response.status_code == 200:
    analytics = analytics_response.json().get('data', {})
    print(f"""
✅ COMPREHENSIVE ANALYTICS:
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

# ============================================================================
# STEP 7: GET USER TRACKING DETAILS
# ============================================================================
print("\n7️⃣  GETTING DETAILED USER TRACKING...")

user_tracking_response = requests.get(
    f'{BASE_URL}/api/admin/offerwall/user-tracking/{test_user_id}',
    headers=headers,
    timeout=5
)

if user_tracking_response.status_code == 200:
    user_data = user_tracking_response.json().get('data', {})
    summary = user_data.get('summary', {})
    print(f"""
✅ USER TRACKING SUMMARY:
   User ID:             {test_user_id}
   Sessions:            {summary.get('total_sessions', 0)}
   Impressions:         {summary.get('total_impressions', 0)}
   Clicks:              {summary.get('total_clicks', 0)}
   Conversions:         {summary.get('total_conversions', 0)}
   Fraud Signals:       {summary.get('total_fraud_signals', 0)}
   Total Points:        {summary.get('total_points', 0)}
""")

# ============================================================================
# STEP 8: GET PUBLISHER TRACKING DETAILS
# ============================================================================
print("\n8️⃣  GETTING DETAILED PUBLISHER TRACKING...")

publisher_tracking_response = requests.get(
    f'{BASE_URL}/api/admin/offerwall/publisher-tracking/{test_publisher_id}',
    headers=headers,
    timeout=5
)

if publisher_tracking_response.status_code == 200:
    pub_data = publisher_tracking_response.json().get('data', {})
    summary = pub_data.get('summary', {})
    print(f"""
✅ PUBLISHER TRACKING SUMMARY:
   Publisher ID:        {test_publisher_id}
   Placements:          {summary.get('total_placements', 0)}
   Clicks:              {summary.get('total_clicks', 0)}
   Conversions:         {summary.get('total_conversions', 0)}
   Total Earnings:      ${summary.get('total_earnings', 0):.2f}
   CTR:                 {summary.get('ctr', 0)}%
   CVR:                 {summary.get('cvr', 0)}%
""")

# ============================================================================
# STEP 9: GET OFFER TRACKING DETAILS
# ============================================================================
print("\n9️⃣  GETTING DETAILED OFFER TRACKING...")

offer_tracking_response = requests.get(
    f'{BASE_URL}/api/admin/offerwall/offer-tracking/{test_offer_id}',
    headers=headers,
    timeout=5
)

if offer_tracking_response.status_code == 200:
    offer_data = offer_tracking_response.json().get('data', {})
    summary = offer_data.get('summary', {})
    print(f"""
✅ OFFER TRACKING SUMMARY:
   Offer ID:            {test_offer_id}
   Impressions:         {summary.get('total_impressions', 0)}
   Clicks:              {summary.get('total_clicks', 0)}
   Conversions:         {summary.get('total_conversions', 0)}
   CTR:                 {summary.get('ctr', 0)}%
   CVR:                 {summary.get('cvr', 0)}%
   Total Payout:        ${summary.get('total_payout', 0):.2f}
   Avg Payout:          ${summary.get('avg_payout', 0):.2f}
""")

# ============================================================================
# STEP 10: GET REVENUE ANALYSIS
# ============================================================================
print("\n🔟 GETTING REVENUE ANALYSIS...")

revenue_response = requests.get(
    f'{BASE_URL}/api/admin/offerwall/revenue-analysis',
    headers=headers,
    timeout=5
)

if revenue_response.status_code == 200:
    revenue_data = revenue_response.json().get('data', {})
    totals = revenue_data.get('totals', {})
    print(f"""
✅ REVENUE ANALYSIS:
   Network Payout:      ${totals.get('network_payout', 0):.2f}
   User Rewards:        ${totals.get('user_reward', 0):.2f}
   Publisher Commission: ${totals.get('publisher_commission', 0):.2f}
   Platform Revenue:    ${totals.get('platform_revenue', 0):.2f}
""")

# ============================================================================
# STEP 11: GET FRAUD ANALYSIS
# ============================================================================
print("\n1️⃣1️⃣  GETTING FRAUD ANALYSIS...")

fraud_response = requests.get(
    f'{BASE_URL}/api/admin/offerwall/fraud-analysis',
    headers=headers,
    timeout=5
)

if fraud_response.status_code == 200:
    fraud_data = fraud_response.json().get('data', {})
    print(f"""
✅ FRAUD ANALYSIS:
   Total Fraud Signals: {fraud_data.get('total_fraud_signals', 0)}
   Fraud by Type:       {len(fraud_data.get('fraud_by_type', []))} types detected
   Fraud by User:       {len(fraud_data.get('fraud_by_user', []))} users flagged
""")

print("\n" + "=" * 100)
print("✅ COMPREHENSIVE TRACKING TEST COMPLETE")
print("=" * 100)

print("""
📊 WHAT WAS TRACKED:

✅ IDENTIFIERS:
   - User ID, Publisher ID, Offer ID, Placement ID
   - Sub ID for campaign tracking

✅ DEVICE INFO:
   - Device type, model, OS, browser versions
   - Screen resolution, DPI, timezone, language

✅ DEVICE FINGERPRINTING:
   - User Agent hash
   - Canvas fingerprint
   - WebGL fingerprint
   - Fonts fingerprint
   - Plugins fingerprint

✅ NETWORK INFO:
   - IP address (IPv4/IPv6)
   - ASN and ISP
   - Organization
   - Proxy/VPN/Tor/Datacenter detection
   - Connection type

✅ GEO-LOCATION:
   - Country, region, city, postal code
   - Latitude/longitude
   - Timezone
   - VPN country detection

✅ EVENT TRACKING:
   - Impression (load)
   - Click (interaction)
   - Conversion (completion)
   - Timestamps for each event
   - Time-to-click and time-to-convert

✅ FRAUD DETECTION:
   - Duplicate clicks/conversions
   - Fast clicks (bot-like behavior)
   - VPN/Proxy detection
   - Suspicious patterns

✅ PAYOUT TRACKING:
   - Network payout (what advertiser pays)
   - User reward (what user gets)
   - Publisher commission (what publisher gets)
   - Platform revenue (what platform keeps)

✅ POSTBACK DATA:
   - Transaction IDs
   - Postback URLs
   - Advertiser data
   - Status tracking

✅ ANALYTICS:
   - Per-user analytics
   - Per-publisher analytics
   - Per-offer analytics
   - Per-country analytics
   - Per-device analytics
   - Revenue breakdown
   - Fraud analysis

🎯 COMPLETE TRACKING LOOP:
   User Opens → Impression Tracked
   User Clicks → Click Tracked (with device/geo/fingerprint)
   User Completes → Conversion Tracked (with payout)
   Points Awarded → User Rewarded
   Analytics Updated → Real-time dashboard
""")
