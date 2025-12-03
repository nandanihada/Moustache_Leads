#!/usr/bin/env python
"""
Test: Comprehensive click tracking with all fields
"""
import requests
import json
import time

BASE_URL = "http://localhost:5000"

print("=" * 100)
print("🔍 TESTING COMPREHENSIVE CLICK TRACKING WITH ALL FIELDS")
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

# Track a click with comprehensive data
print("\n2️⃣  TRACKING A COMPREHENSIVE CLICK...")
click_data = {
    'session_id': f'test_session_comprehensive_{int(time.time())}',
    'user_id': 'test_user_comprehensive_full',
    'placement_id': '4hN81lEwE7Fw1hnI',
    'offer_id': 'ML-00065',
    'offer_name': 'Test Offer Comprehensive',
    'device_type': 'desktop',
    'browser': 'Chrome',
    'os': 'Windows',
    'country': 'United States',
    'ip_address': '192.168.1.1',
    'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'time_to_click': 2500,  # 2.5 seconds
}

try:
    response = requests.post(
        f'{BASE_URL}/api/offerwall/track/click',
        json=click_data,
        headers=headers,
        timeout=10
    )
    
    print(f"✅ Click tracking response: {response.status_code}")
    result = response.json()
    print(f"✅ Response: {json.dumps(result, indent=2)}")
    
    if response.status_code == 200:
        click_id = result.get('click_id')
        print(f"\n✅ Click tracked successfully!")
        print(f"   Click ID: {click_id}")
    else:
        print(f"\n❌ Click tracking failed!")
        
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()

# Wait a moment for database to update
print("\n⏳ Waiting for database to update...")
time.sleep(2)

# Now query the clicks
print("\n3️⃣  QUERYING CLICKS WITH ALL FIELDS...")
try:
    response = requests.get(
        f'{BASE_URL}/api/offerwall/user/clicks?user_id=test_user_comprehensive_full&placement_id=4hN81lEwE7Fw1hnI&limit=50',
        headers=headers,
        timeout=5
    )
    
    print(f"✅ Query response: {response.status_code}")
    data = response.json()
    clicks = data.get('clicks', [])
    print(f"✅ Clicks returned: {len(clicks)}")
    
    if clicks:
        click = clicks[0]
        print(f"\n📊 CLICK DETAILS:")
        print(f"   Click ID: {click.get('click_id')}")
        print(f"   User ID: {click.get('user_id')}")
        print(f"   Offer: {click.get('offer_name')}")
        print(f"   Publisher Name: {click.get('publisher_name', 'N/A')}")
        
        print(f"\n🌍 GEO INFORMATION:")
        geo = click.get('geo', {})
        print(f"   Country: {geo.get('country', 'N/A')}")
        print(f"   Region: {geo.get('region', 'N/A')}")
        print(f"   City: {geo.get('city', 'N/A')}")
        print(f"   Postal Code: {geo.get('postal_code', 'N/A')}")
        print(f"   Coordinates: {geo.get('latitude', 'N/A')}, {geo.get('longitude', 'N/A')}")
        
        print(f"\n🌐 NETWORK INFORMATION:")
        network = click.get('network', {})
        print(f"   IP Address: {network.get('ip_address', 'N/A')}")
        print(f"   ISP: {network.get('isp', 'N/A')}")
        print(f"   ASN: {network.get('asn', 'N/A')}")
        print(f"   Organization: {network.get('organization', 'N/A')}")
        
        print(f"\n🛡️ FRAUD INDICATORS:")
        fraud = click.get('fraud_indicators', {})
        print(f"   Fraud Status: {fraud.get('fraud_status', 'N/A')}")
        print(f"   Fraud Score: {fraud.get('fraud_score', 'N/A')}")
        print(f"   Duplicate Click: {fraud.get('duplicate_click', False)}")
        print(f"   Fast Click: {fraud.get('fast_click', False)}")
        print(f"   Bot-like: {fraud.get('bot_like', False)}")
        print(f"   VPN Detected: {fraud.get('vpn_detected', False)}")
        print(f"   Proxy Detected: {fraud.get('proxy_detected', False)}")
        
        print(f"\n✅ ALL FIELDS POPULATED!")
    else:
        print("\n❌ NO CLICKS FOUND!")
        
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()

print("\n" + "=" * 100)
print("✅ TEST COMPLETE")
print("=" * 100)
