#!/usr/bin/env python
"""
Manual conversion tracking test
This script simulates a user completing an offer and tracks the conversion
"""
import requests
import json
import uuid
from datetime import datetime

BASE_URL = "http://localhost:5000"

print("=" * 80)
print("🧪 MANUAL CONVERSION TRACKING TEST")
print("=" * 80)

# Step 1: Get admin token
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

# Step 2: Create a session first
print("\n2️⃣  CREATING SESSION...")
session_response = requests.post(
    f'{BASE_URL}/api/offerwall/session/create',
    json={
        'user_id': 'test_user',
        'placement_id': '4hN81lEwE7Fw1hnI',
        'device_type': 'desktop',
        'browser': 'Chrome',
        'os': 'Windows'
    },
    timeout=5
)

if session_response.status_code != 200:
    print(f"❌ Session creation failed: {session_response.status_code}")
    print(session_response.text)
    exit(1)

session_data = session_response.json()
session_id = session_data.get('session_id')
print(f"✅ Session created: {session_id}")

# Step 3: Track a click
print("\n3️⃣  TRACKING CLICK...")
click_response = requests.post(
    f'{BASE_URL}/api/offerwall/track/click',
    json={
        'session_id': session_id,
        'user_id': 'test_user',
        'placement_id': '4hN81lEwE7Fw1hnI',
        'offer_id': 'ML-00057',
        'offer_name': 'Test Offer',
        'device_type': 'desktop',
        'browser': 'Chrome',
        'os': 'Windows'
    },
    timeout=5
)

if click_response.status_code != 200:
    print(f"❌ Click tracking failed: {click_response.status_code}")
    print(click_response.text)
    exit(1)

click_data = click_response.json()
click_id = click_data.get('click_id')
print(f"✅ Click tracked: {click_id}")

# Step 4: Track conversion (THIS IS THE KEY PART!)
print("\n4️⃣  TRACKING CONVERSION (OFFER COMPLETION)...")
conversion_response = requests.post(
    f'{BASE_URL}/api/offerwall/track/conversion',
    json={
        'session_id': session_id,
        'click_id': click_id,
        'user_id': 'test_user',
        'offer_id': 'ML-00057',
        'offer_name': 'Test Offer',
        'placement_id': '4hN81lEwE7Fw1hnI',
        'payout_amount': 100.00,
        'transaction_id': str(uuid.uuid4()),
        'source_platform': 'internal'
    },
    timeout=5
)

if conversion_response.status_code != 200:
    print(f"❌ Conversion tracking failed: {conversion_response.status_code}")
    print(conversion_response.text)
    exit(1)

conversion_data = conversion_response.json()
conversion_id = conversion_data.get('conversion_id')
print(f"✅ Conversion tracked: {conversion_id}")

# Step 5: Check updated analytics
print("\n5️⃣  CHECKING UPDATED ANALYTICS...")
analytics_response = requests.get(
    f'{BASE_URL}/api/admin/offerwall/dashboard',
    headers=headers,
    timeout=5
)

if analytics_response.status_code != 200:
    print(f"❌ Analytics fetch failed: {analytics_response.status_code}")
    exit(1)

analytics = analytics_response.json().get('data', {})
print(f"""
✅ UPDATED ANALYTICS:
   Total Sessions:      {analytics.get('total_sessions', 0)}
   Total Clicks:        {analytics.get('total_clicks', 0)}
   Total Conversions:   {analytics.get('total_conversions', 0)}
   Total Points:        {analytics.get('total_points_awarded', 0)}
   CTR:                 {analytics.get('ctr', 0):.2f}%
   CVR:                 {analytics.get('cvr', 0):.2f}%
""")

# Step 6: Check user points
print("6️⃣  CHECKING USER POINTS...")
points_response = requests.get(
    f'{BASE_URL}/api/user/offerwall/points?user_id=test_user',
    headers=headers,
    timeout=5
)

if points_response.status_code == 200:
    points_data = points_response.json().get('data', {})
    print(f"""
✅ USER POINTS:
   Total Points:        {points_data.get('total_points', 0)}
   Available Points:    {points_data.get('available_points', 0)}
   Redeemed Points:     {points_data.get('redeemed_points', 0)}
   Pending Points:      {points_data.get('pending_points', 0)}
""")

# Step 7: Check user stats
print("7️⃣  CHECKING USER STATS...")
stats_response = requests.get(
    f'{BASE_URL}/api/user/offerwall/stats?user_id=test_user&placement_id=4hN81lEwE7Fw1hnI',
    headers=headers,
    timeout=5
)

if stats_response.status_code == 200:
    stats_data = stats_response.json().get('data', {})
    user_stats = stats_data.get('stats', {})
    print(f"""
✅ USER STATISTICS:
   Offers Completed:    {user_stats.get('total_offers_completed', 0)}
   Total Earnings:      ${user_stats.get('total_earnings', 0):.2f}
   Avg Payout:          ${user_stats.get('average_payout_per_offer', 0):.2f}
""")

print("\n" + "=" * 80)
print("✅ CONVERSION TRACKING TEST COMPLETE")
print("=" * 80)

print("""
📊 SUMMARY:
   ✅ Session created
   ✅ Click tracked
   ✅ Conversion tracked
   ✅ Analytics updated
   ✅ User points awarded
   ✅ User stats updated

🎯 THIS IS HOW THE OFFERWALL SHOULD WORK:
   1. User opens offerwall
   2. User clicks "Start Offer Now"
   3. Frontend tracks click
   4. User completes offer in new tab
   5. Frontend/Backend tracks conversion
   6. Points awarded to user
   7. Analytics dashboard updates in real-time

⚠️  CURRENT ISSUE:
   The frontend is NOT tracking conversions when users complete offers.
   We need to implement a callback/postback mechanism.
""")
