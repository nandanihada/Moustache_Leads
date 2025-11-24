#!/usr/bin/env python3

import requests
import json
from database import db_instance

BASE_URL = 'http://127.0.0.1:5000'

print("=" * 80)
print("END-TO-END TEST: APPROVAL WORKFLOW WITH NEW OFFER")
print("=" * 80)

# Step 1: Admin creates offer with manual approval
print("\n1️⃣  ADMIN: Creating offer with MANUAL approval required...")
admin_login = requests.post(f'{BASE_URL}/api/auth/login',
    json={'username': 'admin', 'password': 'admin123'}
)
admin_token = admin_login.json().get('token')
admin_headers = {'Authorization': f'Bearer {admin_token}'}

new_offer = {
    'campaign_id': 'E2E-TEST-001',
    'name': 'E2E Test - Manual Approval Required',
    'description': 'End-to-end test for approval workflow',
    'status': 'active',  # Must be 'active' to show in publisher offers
    'payout': 7.50,
    'currency': 'USD',
    'network': 'TestNetwork',
    'target_url': 'https://example.com/offer',
    'countries': ['US'],
    'approval_type': 'manual',
    'require_approval': True,
    'approval_message': 'This offer requires manual approval',
    'max_inactive_days': 30,
    'affiliates': 'all'
}

resp = requests.post(
    f'{BASE_URL}/api/admin/offers',
    json=new_offer,
    headers=admin_headers
)

if resp.status_code not in [200, 201]:
    print(f"❌ Failed to create offer: {resp.status_code}")
    print(resp.text)
    exit(1)

created_offer = resp.json().get('offer')
offer_id = created_offer.get('offer_id')
print(f"✅ Offer created: {offer_id}")

# Step 2: Publisher logs in and tries to view the offer
print("\n2️⃣  PUBLISHER: Logging in as testuser2...")
pub_login = requests.post(f'{BASE_URL}/api/auth/login',
    json={'username': 'testuser2', 'password': 'password123'}
)
pub_token = pub_login.json().get('token')
pub_headers = {'Authorization': f'Bearer {pub_token}'}
print("✅ Logged in")

# Step 3: Publisher views available offers
print("\n3️⃣  PUBLISHER: Checking available offers...")
resp = requests.get(
    f'{BASE_URL}/api/publisher/offers/available',
    headers=pub_headers
)

if resp.status_code == 200:
    offers = resp.json().get('offers', [])
    test_offer = next((o for o in offers if o.get('offer_id') == offer_id), None)
    
    if test_offer:
        print(f"✅ Offer found in available offers")
        print(f"  - name: {test_offer.get('name')}")
        print(f"  - has_access: {test_offer.get('has_access')}")
        print(f"  - is_preview: {test_offer.get('is_preview')}")
        print(f"  - requires_approval: {test_offer.get('requires_approval')}")
        
        # Verify publisher doesn't have access
        if test_offer.get('has_access') == False:
            print("  ✅ CORRECT: Publisher does NOT have access")
        else:
            print("  ❌ ERROR: Publisher should NOT have access yet!")
        
        # Verify it requires approval
        if test_offer.get('requires_approval') == True:
            print("  ✅ CORRECT: Offer requires approval")
        else:
            print("  ❌ ERROR: Offer should require approval!")
    else:
        print(f"❌ Offer {offer_id} not found in available offers")
else:
    print(f"❌ Failed to get offers: {resp.status_code}")
    print(resp.text)

# Step 4: Publisher requests access
print("\n4️⃣  PUBLISHER: Requesting access to offer...")
resp = requests.post(
    f'{BASE_URL}/api/publisher/offers/{offer_id}/request-access',
    json={'message': 'Please grant me access to this offer'},
    headers=pub_headers
)

if resp.status_code == 200:
    print("✅ Access request submitted")
    response_data = resp.json()
    request_data = response_data.get('request', {})
    request_id = request_data.get('request_id')
    print(f"  - Request ID: {request_id}")
else:
    print(f"❌ Failed to request access: {resp.status_code}")
    print(resp.text)

# Step 5: Admin approves the request
print("\n5️⃣  ADMIN: Approving access request...")
resp = requests.post(
    f'{BASE_URL}/api/admin/offer-access-requests/{request_id}/approve',
    json={'notes': 'Approved for testing'},
    headers=admin_headers
)

if resp.status_code == 200:
    print("✅ Request approved")
else:
    print(f"❌ Failed to approve request: {resp.status_code}")
    print(resp.text)

# Step 6: Publisher checks if they now have access
print("\n6️⃣  PUBLISHER: Checking access after approval...")
resp = requests.get(
    f'{BASE_URL}/api/publisher/offers/available',
    headers=pub_headers
)

if resp.status_code == 200:
    offers = resp.json().get('offers', [])
    test_offer = next((o for o in offers if o.get('offer_id') == offer_id), None)
    
    if test_offer:
        print(f"✅ Offer found")
        print(f"  - has_access: {test_offer.get('has_access')}")
        target_url = test_offer.get('target_url') or test_offer.get('masked_url')
        print(f"  - target_url: {target_url[:50]}..." if target_url else "  - target_url: NOT PROVIDED")
        
        if test_offer.get('has_access') == True:
            print("  ✅ CORRECT: Publisher NOW has access!")
        else:
            print("  ❌ ERROR: Publisher should have access after approval!")
        
        if target_url:
            print("  ✅ CORRECT: Tracking URL is now visible")
        else:
            print("  ❌ ERROR: Tracking URL should be visible!")
    else:
        print(f"❌ Offer {offer_id} not found")
else:
    print(f"❌ Failed to get offers: {resp.status_code}")
    print(resp.text)

print("\n" + "=" * 80)
print("✅ END-TO-END TEST COMPLETE!")
print("=" * 80)
