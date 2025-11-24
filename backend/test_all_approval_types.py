#!/usr/bin/env python3
"""
Comprehensive test for all approval workflow types
"""

import requests
import json
from database import db_instance

BASE_URL = 'http://127.0.0.1:5000'

print("=" * 80)
print("COMPREHENSIVE TEST: ALL APPROVAL WORKFLOW TYPES")
print("=" * 80)

# Login as admin
admin_login = requests.post(f'{BASE_URL}/api/auth/login',
    json={'username': 'admin', 'password': 'admin123'}
)
admin_token = admin_login.json().get('token')
admin_headers = {'Authorization': f'Bearer {admin_token}'}

# Login as publisher
pub_login = requests.post(f'{BASE_URL}/api/auth/login',
    json={'username': 'testuser2', 'password': 'password123'}
)
pub_token = pub_login.json().get('token')
pub_headers = {'Authorization': f'Bearer {pub_token}'}

offers_collection = db_instance.get_collection('offers')

# Test 1: AUTO_APPROVE (default)
print("\n" + "=" * 80)
print("TEST 1: AUTO_APPROVE (Immediate Access)")
print("=" * 80)

offer1 = {
    'campaign_id': 'AUTO-APPROVE-001',
    'name': 'Auto Approve Test',
    'status': 'active',
    'payout': 5.00,
    'currency': 'USD',
    'network': 'TestNetwork',
    'target_url': 'https://example.com/auto',
    'approval_type': 'auto_approve',
    'require_approval': False,
    'affiliates': 'all'
}

resp = requests.post(f'{BASE_URL}/api/admin/offers', json=offer1, headers=admin_headers)
if resp.status_code in [200, 201]:
    offer_id = resp.json().get('offer', {}).get('offer_id')
    print(f"✅ Offer created: {offer_id}")
    
    # Check offer settings
    offer = offers_collection.find_one({'offer_id': offer_id})
    print(f"  - affiliates: {offer.get('affiliates')}")
    print(f"  - approval_type: {offer.get('approval_settings', {}).get('type')}")
    
    # Publisher should have immediate access
    resp = requests.get(f'{BASE_URL}/api/publisher/offers/available', headers=pub_headers)
    pub_offer = next((o for o in resp.json().get('offers', []) if o.get('offer_id') == offer_id), None)
    if pub_offer and pub_offer.get('has_access'):
        print("  ✅ Publisher has IMMEDIATE access")
    else:
        print("  ❌ Publisher should have immediate access!")
else:
    print(f"❌ Failed to create offer: {resp.status_code}")

# Test 2: MANUAL APPROVAL
print("\n" + "=" * 80)
print("TEST 2: MANUAL APPROVAL (Requires Admin Approval)")
print("=" * 80)

offer2 = {
    'campaign_id': 'MANUAL-APPROVE-001',
    'name': 'Manual Approve Test',
    'status': 'active',
    'payout': 6.00,
    'currency': 'USD',
    'network': 'TestNetwork',
    'target_url': 'https://example.com/manual',
    'approval_type': 'manual',
    'require_approval': True,
    'approval_message': 'Manual approval required',
    'affiliates': 'all'
}

resp = requests.post(f'{BASE_URL}/api/admin/offers', json=offer2, headers=admin_headers)
if resp.status_code in [200, 201]:
    offer_id = resp.json().get('offer', {}).get('offer_id')
    print(f"✅ Offer created: {offer_id}")
    
    # Check offer settings
    offer = offers_collection.find_one({'offer_id': offer_id})
    print(f"  - affiliates: {offer.get('affiliates')}")
    print(f"  - approval_type: {offer.get('approval_settings', {}).get('type')}")
    print(f"  - require_approval: {offer.get('approval_settings', {}).get('require_approval')}")
    
    if offer.get('affiliates') == 'request':
        print("  ✅ Affiliates correctly set to 'request'")
    else:
        print(f"  ❌ Affiliates should be 'request', got '{offer.get('affiliates')}'")
    
    # Publisher should NOT have access
    resp = requests.get(f'{BASE_URL}/api/publisher/offers/available', headers=pub_headers)
    pub_offer = next((o for o in resp.json().get('offers', []) if o.get('offer_id') == offer_id), None)
    if pub_offer and not pub_offer.get('has_access'):
        print("  ✅ Publisher does NOT have access (as expected)")
    else:
        print("  ❌ Publisher should NOT have access!")
else:
    print(f"❌ Failed to create offer: {resp.status_code}")

# Test 3: TIME-BASED APPROVAL
print("\n" + "=" * 80)
print("TEST 3: TIME-BASED APPROVAL (Auto-approve after delay)")
print("=" * 80)

offer3 = {
    'campaign_id': 'TIME-BASED-001',
    'name': 'Time-based Approve Test',
    'status': 'active',
    'payout': 7.00,
    'currency': 'USD',
    'network': 'TestNetwork',
    'target_url': 'https://example.com/timebased',
    'approval_type': 'time_based',
    'auto_approve_delay': 60,
    'approval_message': 'Will be auto-approved in 60 minutes',
    'affiliates': 'all'
}

resp = requests.post(f'{BASE_URL}/api/admin/offers', json=offer3, headers=admin_headers)
if resp.status_code in [200, 201]:
    offer_id = resp.json().get('offer', {}).get('offer_id')
    print(f"✅ Offer created: {offer_id}")
    
    # Check offer settings
    offer = offers_collection.find_one({'offer_id': offer_id})
    print(f"  - affiliates: {offer.get('affiliates')}")
    print(f"  - approval_type: {offer.get('approval_settings', {}).get('type')}")
    print(f"  - auto_approve_delay: {offer.get('approval_settings', {}).get('auto_approve_delay')} minutes")
    
    if offer.get('affiliates') == 'request':
        print("  ✅ Affiliates correctly set to 'request'")
    else:
        print(f"  ❌ Affiliates should be 'request', got '{offer.get('affiliates')}'")
    
    # Publisher should NOT have immediate access
    resp = requests.get(f'{BASE_URL}/api/publisher/offers/available', headers=pub_headers)
    pub_offer = next((o for o in resp.json().get('offers', []) if o.get('offer_id') == offer_id), None)
    if pub_offer and not pub_offer.get('has_access'):
        print("  ✅ Publisher does NOT have immediate access (will be auto-approved later)")
    else:
        print("  ❌ Publisher should NOT have immediate access!")
else:
    print(f"❌ Failed to create offer: {resp.status_code}")

# Test 4: REQUIRE_APPROVAL OVERRIDE
print("\n" + "=" * 80)
print("TEST 4: REQUIRE_APPROVAL OVERRIDE (Force manual even if auto_approve)")
print("=" * 80)

offer4 = {
    'campaign_id': 'OVERRIDE-001',
    'name': 'Override Test',
    'status': 'active',
    'payout': 8.00,
    'currency': 'USD',
    'network': 'TestNetwork',
    'target_url': 'https://example.com/override',
    'approval_type': 'auto_approve',
    'require_approval': True,  # Override to require manual approval
    'approval_message': 'Override: manual approval required',
    'affiliates': 'all'
}

resp = requests.post(f'{BASE_URL}/api/admin/offers', json=offer4, headers=admin_headers)
if resp.status_code in [200, 201]:
    offer_id = resp.json().get('offer', {}).get('offer_id')
    print(f"✅ Offer created: {offer_id}")
    
    # Check offer settings
    offer = offers_collection.find_one({'offer_id': offer_id})
    print(f"  - affiliates: {offer.get('affiliates')}")
    print(f"  - approval_type: {offer.get('approval_settings', {}).get('type')}")
    print(f"  - require_approval: {offer.get('approval_settings', {}).get('require_approval')}")
    
    if offer.get('affiliates') == 'request':
        print("  ✅ Affiliates correctly set to 'request' (due to require_approval override)")
    else:
        print(f"  ❌ Affiliates should be 'request', got '{offer.get('affiliates')}'")
    
    # Publisher should NOT have access
    resp = requests.get(f'{BASE_URL}/api/publisher/offers/available', headers=pub_headers)
    pub_offer = next((o for o in resp.json().get('offers', []) if o.get('offer_id') == offer_id), None)
    if pub_offer and not pub_offer.get('has_access'):
        print("  ✅ Publisher does NOT have access (override working)")
    else:
        print("  ❌ Publisher should NOT have access!")
else:
    print(f"❌ Failed to create offer: {resp.status_code}")

print("\n" + "=" * 80)
print("✅ ALL TESTS COMPLETE!")
print("=" * 80)
