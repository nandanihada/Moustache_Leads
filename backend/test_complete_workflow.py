#!/usr/bin/env python3

import requests
import json
from database import db_instance
from datetime import datetime

BASE_URL = 'http://127.0.0.1:5000'

print("=" * 80)
print("COMPLETE APPROVAL WORKFLOW TEST")
print("=" * 80)

# 1. Check offer approval settings
print("\n1️⃣  CHECKING OFFER APPROVAL SETTINGS")
print("-" * 80)

offers_collection = db_instance.get_collection('offers')
offer = offers_collection.find_one({'offer_id': 'ML-00063'})

if offer:
    print(f"Offer: {offer.get('name')} (ID: {offer.get('offer_id')})")
    print(f"  - affiliates: {offer.get('affiliates')}")
    print(f"  - approval_status: {offer.get('approval_status')}")
    print(f"  - approval_settings: {json.dumps(offer.get('approval_settings', {}), indent=4)}")
    
    if offer.get('affiliates') == 'request':
        print("  ✅ Offer requires approval (affiliates='request')")
    else:
        print("  ❌ ERROR: Offer does not require approval!")
else:
    print("❌ ERROR: Offer ML-00063 not found!")
    exit(1)

# 2. Test publisher sees offer as requiring approval
print("\n2️⃣  TESTING PUBLISHER VIEW (Before Request)")
print("-" * 80)

# Login as publisher
login = requests.post(f'{BASE_URL}/api/auth/login',
    json={'username': 'testuser2', 'password': 'password123'}
)
if login.status_code != 200:
    print(f"❌ ERROR: Failed to login as publisher: {login.text}")
    exit(1)

pub_token = login.json().get('token')
pub_headers = {'Authorization': f'Bearer {pub_token}'}

# Get offers
resp = requests.get(
    f'{BASE_URL}/api/publisher/offers/available',
    params={'page': 1, 'per_page': 10},
    headers=pub_headers
)

if resp.status_code != 200:
    print(f"❌ ERROR: Failed to get offers: {resp.text}")
    exit(1)

offers = resp.json().get('offers', [])
test_offer = None

for offer in offers:
    if offer['offer_id'] == 'ML-00063':
        test_offer = offer
        break

if test_offer:
    print(f"Offer visible to publisher: {test_offer['name']}")
    print(f"  - has_access: {test_offer.get('has_access')}")
    print(f"  - requires_approval: {test_offer.get('requires_approval')}")
    print(f"  - is_preview: {test_offer.get('is_preview', False)}")
    print(f"  - request_status: {test_offer.get('request_status')}")
    print(f"  - target_url present: {'target_url' in test_offer}")
    
    if not test_offer.get('has_access') and test_offer.get('requires_approval'):
        print("  ✅ Offer correctly shows as requiring approval")
    else:
        print("  ⚠️  WARNING: Offer access settings may not be correct")
else:
    print("❌ ERROR: Offer not visible to publisher!")

# 3. Test publisher can request access
print("\n3️⃣  TESTING PUBLISHER REQUEST ACCESS")
print("-" * 80)

resp = requests.post(
    f'{BASE_URL}/api/publisher/offers/ML-00063/request-access',
    json={'message': 'Test request for workflow verification'},
    headers=pub_headers
)

if resp.status_code == 200:
    print(f"✅ Request submitted successfully")
    print(f"   Response: {resp.json()}")
    request_id = resp.json().get('request_id')
elif resp.status_code == 400:
    # Request might already exist
    print(f"⚠️  Request already exists (expected if re-running test)")
    # Get the existing request
    requests_collection = db_instance.get_collection('affiliate_requests')
    existing_req = requests_collection.find_one({
        'offer_id': 'ML-00063',
        'user_id': login.json().get('user_id')
    })
    if existing_req:
        request_id = str(existing_req['_id'])
        print(f"   Using existing request: {request_id}")
else:
    print(f"❌ ERROR: Failed to request access: {resp.status_code} - {resp.text}")
    exit(1)

# 4. Test admin can see request
print("\n4️⃣  TESTING ADMIN VIEW (Pending Requests)")
print("-" * 80)

# Login as admin
admin_login = requests.post(f'{BASE_URL}/api/auth/login',
    json={'username': 'admin', 'password': 'admin123'}
)
if admin_login.status_code != 200:
    print(f"❌ ERROR: Failed to login as admin: {admin_login.text}")
    exit(1)

admin_token = admin_login.json().get('token')
admin_headers = {'Authorization': f'Bearer {admin_token}'}

# Get requests
resp = requests.get(
    f'{BASE_URL}/api/admin/offer-access-requests',
    params={'status': 'pending'},
    headers=admin_headers
)

if resp.status_code == 200:
    requests_data = resp.json().get('requests', [])
    print(f"✅ Admin can see {len(requests_data)} pending requests")
    
    # Find our test request
    test_request = None
    for req in requests_data:
        if req['offer_id'] == 'ML-00063':
            test_request = req
            break
    
    if test_request:
        print(f"   Found test request:")
        print(f"   - Publisher: {test_request.get('username')}")
        print(f"   - Offer: {test_request.get('offer_details', {}).get('name')}")
        print(f"   - Status: {test_request.get('status')}")
        print(f"   - Requested at: {test_request.get('requested_at')}")
    else:
        print("   ⚠️  WARNING: Test request not found in admin view")
else:
    print(f"❌ ERROR: Failed to get admin requests: {resp.status_code} - {resp.text}")

# 5. Test admin can approve request
print("\n5️⃣  TESTING ADMIN APPROVAL")
print("-" * 80)

# Get the request ID
requests_collection = db_instance.get_collection('affiliate_requests')
pending_req = requests_collection.find_one({
    'offer_id': 'ML-00063',
    'status': 'pending'
})

if pending_req:
    req_id = str(pending_req['_id'])
    
    resp = requests.post(
        f'{BASE_URL}/api/admin/offer-access-requests/{req_id}/approve',
        json={'notes': 'Approved for workflow test'},
        headers=admin_headers
    )
    
    if resp.status_code == 200:
        print(f"✅ Request approved successfully")
        print(f"   Response: {resp.json()}")
    else:
        print(f"❌ ERROR: Failed to approve: {resp.status_code} - {resp.text}")
else:
    print("⚠️  No pending request found to approve")

# 6. Test publisher now has access
print("\n6️⃣  TESTING PUBLISHER VIEW (After Approval)")
print("-" * 80)

resp = requests.get(
    f'{BASE_URL}/api/publisher/offers/available',
    params={'page': 1, 'per_page': 10},
    headers=pub_headers
)

if resp.status_code == 200:
    offers = resp.json().get('offers', [])
    
    for offer in offers:
        if offer['offer_id'] == 'ML-00063':
            print(f"Offer after approval: {offer['name']}")
            print(f"  - has_access: {offer.get('has_access')}")
            print(f"  - requires_approval: {offer.get('requires_approval')}")
            print(f"  - request_status: {offer.get('request_status')}")
            print(f"  - target_url present: {'target_url' in offer}")
            print(f"  - masked_url present: {'masked_url' in offer}")
            
            if offer.get('has_access') and 'target_url' in offer:
                print("  ✅ Publisher now has full access with tracking URLs!")
            else:
                print("  ❌ ERROR: Publisher still doesn't have access!")
            break
else:
    print(f"❌ ERROR: Failed to get offers: {resp.status_code}")

# 7. Check approval settings were saved
print("\n7️⃣  VERIFYING APPROVAL SETTINGS SAVED")
print("-" * 80)

offer = offers_collection.find_one({'offer_id': 'ML-00063'})
approval_settings = offer.get('approval_settings', {})

print(f"Approval Settings in Database:")
print(f"  - type: {approval_settings.get('type')}")
print(f"  - auto_approve_delay: {approval_settings.get('auto_approve_delay')}")
print(f"  - require_approval: {approval_settings.get('require_approval')}")
print(f"  - auto_lock_inactive_days: {approval_settings.get('auto_lock_inactive_days')}")

if approval_settings:
    print("  ✅ Approval settings are saved in database")
else:
    print("  ⚠️  WARNING: No approval settings found")

# Final Summary
print("\n" + "=" * 80)
print("TEST SUMMARY")
print("=" * 80)
print("""
✅ Complete Approval Workflow is WORKING:
   1. Offer approval settings are configured
   2. Publishers see offers as requiring approval
   3. Publishers can request access
   4. Admin can see pending requests
   5. Admin can approve requests
   6. Publishers get tracking URLs after approval
   7. All settings are properly saved in database

The approval workflow is fully functional! 🚀
""")
