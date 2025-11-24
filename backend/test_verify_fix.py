#!/usr/bin/env python3
"""
Verify the fix is working by creating a new offer with approval settings
"""

import requests
from database import db_instance

BASE_URL = 'http://127.0.0.1:5000'

print("=" * 80)
print("VERIFICATION TEST: Create New Offer with Approval Settings")
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

# Create offer with time-based approval
print("\n1️⃣  Creating offer with TIME-BASED approval (60 minutes)...")
offer = {
    'campaign_id': 'VERIFY-FIX-001',
    'name': 'Verification Test - Time-based Approval',
    'status': 'active',
    'payout': 12.50,
    'currency': 'USD',
    'network': 'TestNetwork',
    'target_url': 'https://example.com/verify',
    'approval_type': 'time_based',
    'auto_approve_delay': 60,
    'approval_message': 'This offer will auto-approve in 60 minutes',
    'affiliates': 'all'
}

resp = requests.post(f'{BASE_URL}/api/admin/offers', json=offer, headers=admin_headers)
if resp.status_code not in [200, 201]:
    print(f"❌ Failed to create offer: {resp.status_code}")
    print(resp.text)
    exit(1)

offer_id = resp.json().get('offer', {}).get('offer_id')
print(f"✅ Offer created: {offer_id}")

# Check database
offers_collection = db_instance.get_collection('offers')
db_offer = offers_collection.find_one({'offer_id': offer_id})

print(f"\n2️⃣  DATABASE VERIFICATION:")
print(f"  - affiliates: {db_offer.get('affiliates')}")
print(f"  - approval_type: {db_offer.get('approval_settings', {}).get('type')}")
print(f"  - auto_approve_delay: {db_offer.get('approval_settings', {}).get('auto_approve_delay')} minutes")

# Check what publisher sees
print(f"\n3️⃣  PUBLISHER VIEW:")
resp = requests.get(f'{BASE_URL}/api/publisher/offers/available', headers=pub_headers)
offers = resp.json().get('offers', [])
pub_offer = next((o for o in offers if o.get('offer_id') == offer_id), None)

if pub_offer:
    print(f"  - has_access: {pub_offer.get('has_access')}")
    print(f"  - is_preview: {pub_offer.get('is_preview')}")
    print(f"  - requires_approval: {pub_offer.get('requires_approval')}")
    print(f"  - approval_type: {pub_offer.get('approval_type')}")
    has_url = 'target_url' in pub_offer or 'masked_url' in pub_offer
    print(f"  - has_tracking_url: {has_url}")
else:
    print(f"  ❌ Offer not found!")
    exit(1)

# Verify correctness
print(f"\n4️⃣  FINAL VERIFICATION:")
all_correct = True

if db_offer.get('affiliates') == 'request':
    print(f"  ✅ Database: affiliates = 'request'")
else:
    print(f"  ❌ Database: affiliates = '{db_offer.get('affiliates')}' (should be 'request')")
    all_correct = False

if pub_offer.get('has_access') == False:
    print(f"  ✅ Publisher: has_access = False")
else:
    print(f"  ❌ Publisher: has_access = True (should be False)")
    all_correct = False

if pub_offer.get('is_preview') == True:
    print(f"  ✅ Publisher: is_preview = True (blurred)")
else:
    print(f"  ❌ Publisher: is_preview = False (should be True)")
    all_correct = False

if not ('target_url' in pub_offer or 'masked_url' in pub_offer):
    print(f"  ✅ Publisher: tracking URL is NOT visible")
else:
    print(f"  ❌ Publisher: tracking URL IS visible (should not be)")
    all_correct = False

print(f"\n{'=' * 80}")
if all_correct:
    print("✅ FIX VERIFIED - Everything is working correctly!")
    print("\nThe offers you see with 'Full Access' were likely created BEFORE the fix.")
    print("Create NEW offers with approval settings and they will work correctly.")
else:
    print("❌ ISSUE STILL EXISTS - Please check the logs")
print(f"{'=' * 80}\n")
