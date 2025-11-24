#!/usr/bin/env python3
"""
Test the exact user scenario: Create offer with auto-approve in 60 minutes
and check if publisher sees full access
"""

import requests
from database import db_instance

BASE_URL = 'http://127.0.0.1:5000'

print("=" * 80)
print("USER SCENARIO TEST: Auto-approve in 60 minutes")
print("=" * 80)

# Admin login
admin_login = requests.post(f'{BASE_URL}/api/auth/login',
    json={'username': 'admin', 'password': 'admin123'}
)
admin_token = admin_login.json().get('token')
admin_headers = {'Authorization': f'Bearer {admin_token}'}

# Publisher login
pub_login = requests.post(f'{BASE_URL}/api/auth/login',
    json={'username': 'testuser2', 'password': 'password123'}
)
pub_token = pub_login.json().get('token')
pub_headers = {'Authorization': f'Bearer {pub_token}'}

# Step 1: Admin creates offer with "auto approve in 60 minutes"
print("\n1️⃣  ADMIN: Creating offer with auto-approve in 60 minutes...")
offer = {
    'campaign_id': 'USER-SCENARIO-001',
    'name': 'User Scenario Test - Auto Approve 60 Min',
    'status': 'active',
    'payout': 10.00,
    'currency': 'USD',
    'network': 'TestNetwork',
    'target_url': 'https://example.com/user-scenario',
    'approval_type': 'time_based',  # This is "auto approve in X minutes"
    'auto_approve_delay': 60,  # 60 minutes
    'approval_message': 'This offer will be auto-approved in 60 minutes',
    'affiliates': 'all'  # Should be converted to 'request'
}

resp = requests.post(f'{BASE_URL}/api/admin/offers', json=offer, headers=admin_headers)
if resp.status_code not in [200, 201]:
    print(f"❌ Failed to create offer: {resp.status_code}")
    print(resp.text)
    exit(1)

offer_id = resp.json().get('offer', {}).get('offer_id')
print(f"✅ Offer created: {offer_id}")

# Step 2: Check database
offers_collection = db_instance.get_collection('offers')
db_offer = offers_collection.find_one({'offer_id': offer_id})

print(f"\n2️⃣  DATABASE CHECK:")
print(f"  - affiliates: {db_offer.get('affiliates')}")
print(f"  - approval_type: {db_offer.get('approval_settings', {}).get('type')}")
print(f"  - auto_approve_delay: {db_offer.get('approval_settings', {}).get('auto_approve_delay')} minutes")

if db_offer.get('affiliates') != 'request':
    print(f"  ❌ ERROR: affiliates should be 'request', got '{db_offer.get('affiliates')}'")
else:
    print(f"  ✅ Affiliates correctly set to 'request'")

# Step 3: Publisher views the offer
print(f"\n3️⃣  PUBLISHER: Checking available offers...")
resp = requests.get(f'{BASE_URL}/api/publisher/offers/available', headers=pub_headers)
offers = resp.json().get('offers', [])
pub_offer = next((o for o in offers if o.get('offer_id') == offer_id), None)

if not pub_offer:
    print(f"❌ Offer not found in publisher's available offers")
    exit(1)

print(f"  - name: {pub_offer.get('name')}")
print(f"  - has_access: {pub_offer.get('has_access')}")
print(f"  - is_preview: {pub_offer.get('is_preview')}")
print(f"  - requires_approval: {pub_offer.get('requires_approval')}")
print(f"  - approval_type: {pub_offer.get('approval_type')}")

# Check if tracking URL is visible
has_tracking_url = 'target_url' in pub_offer or 'masked_url' in pub_offer
print(f"  - has_tracking_url: {has_tracking_url}")

# Verify correctness
print(f"\n4️⃣  VERIFICATION:")
if pub_offer.get('has_access') == False:
    print(f"  ✅ CORRECT: Publisher does NOT have access")
else:
    print(f"  ❌ ERROR: Publisher should NOT have access!")

if pub_offer.get('is_preview') == True:
    print(f"  ✅ CORRECT: Offer shows as preview (blurred)")
else:
    print(f"  ❌ ERROR: Offer should show as preview!")

if pub_offer.get('requires_approval') == True:
    print(f"  ✅ CORRECT: Offer requires approval")
else:
    print(f"  ❌ ERROR: Offer should require approval!")

if not has_tracking_url:
    print(f"  ✅ CORRECT: Tracking URL is NOT visible")
else:
    print(f"  ❌ ERROR: Tracking URL should NOT be visible!")

print(f"\n" + "=" * 80)
if (pub_offer.get('has_access') == False and 
    pub_offer.get('is_preview') == True and 
    pub_offer.get('requires_approval') == True and 
    not has_tracking_url):
    print("✅ ALL CHECKS PASSED - System is working correctly!")
else:
    print("❌ SOME CHECKS FAILED - There's an issue!")
print("=" * 80)
