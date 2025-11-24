#!/usr/bin/env python3

import requests
import json
from database import db_instance

BASE_URL = 'http://127.0.0.1:5000'

print("=" * 80)
print("TEST: NEW OFFER WITH APPROVAL WORKFLOW SETTINGS")
print("=" * 80)

# Login as admin
print("\n1️⃣  Logging in as admin...")
login = requests.post(f'{BASE_URL}/api/auth/login',
    json={'username': 'admin', 'password': 'admin123'}
)
token = login.json().get('token')
headers = {'Authorization': f'Bearer {token}'}
print("✅ Logged in")

# Create a new offer with approval workflow settings
print("\n2️⃣  Creating new offer with MANUAL approval workflow...")
new_offer = {
    'campaign_id': 'TEST-MANUAL-001',
    'name': 'Test Offer - Manual Approval',
    'description': 'Testing manual approval workflow',
    'payout': 5.50,
    'currency': 'USD',
    'network': 'TestNetwork',
    'target_url': 'https://example.com/offer',
    'countries': ['US', 'CA'],
    'approval_type': 'manual',
    'require_approval': True,
    'approval_message': 'This offer requires manual approval from our team',
    'max_inactive_days': 30,
    'affiliates': 'all'  # Should be auto-converted to 'request'
}

resp = requests.post(
    f'{BASE_URL}/api/admin/offers',
    json=new_offer,
    headers=headers
)

if resp.status_code == 200:
    created_offer = resp.json().get('offer')
    offer_id = created_offer.get('offer_id')
    print(f"✅ Offer created: {offer_id}")
    
    # Check the offer in database
    print("\n3️⃣  Checking offer settings in database...")
    offers_collection = db_instance.get_collection('offers')
    offer = offers_collection.find_one({'offer_id': offer_id})
    
    if offer:
        print(f"\nOffer Details:")
        print(f"  - name: {offer.get('name')}")
        print(f"  - affiliates: {offer.get('affiliates')}")
        print(f"  - approval_status: {offer.get('approval_status')}")
        print(f"  - approval_settings: {json.dumps(offer.get('approval_settings', {}), indent=4)}")
        
        # Verify settings
        if offer.get('affiliates') == 'request':
            print("\n  ✅ affiliates correctly set to 'request'")
        else:
            print(f"\n  ❌ ERROR: affiliates is '{offer.get('affiliates')}', should be 'request'")
        
        if offer.get('approval_settings', {}).get('type') == 'manual':
            print("  ✅ approval type correctly set to 'manual'")
        else:
            print(f"  ❌ ERROR: approval type is '{offer.get('approval_settings', {}).get('type')}'")
        
        if offer.get('approval_settings', {}).get('require_approval') == True:
            print("  ✅ require_approval correctly set to True")
        else:
            print("  ❌ ERROR: require_approval should be True")
    else:
        print("❌ ERROR: Offer not found in database!")
else:
    print(f"❌ ERROR: Failed to create offer: {resp.status_code}")
    print(resp.text)

# Test with TIME-BASED approval
print("\n" + "=" * 80)
print("4️⃣  Creating new offer with TIME-BASED approval workflow...")
new_offer2 = {
    'campaign_id': 'TEST-TIMEBASED-001',
    'name': 'Test Offer - Time-based Approval',
    'description': 'Testing time-based approval workflow',
    'payout': 3.25,
    'currency': 'USD',
    'network': 'TestNetwork',
    'target_url': 'https://example.com/offer2',
    'countries': ['US'],
    'approval_type': 'time_based',
    'auto_approve_delay': 60,  # 60 minutes
    'approval_message': 'Your request will be auto-approved in 60 minutes',
    'max_inactive_days': 30,
    'affiliates': 'all'  # Should be auto-converted to 'request'
}

resp = requests.post(
    f'{BASE_URL}/api/admin/offers',
    json=new_offer2,
    headers=headers
)

if resp.status_code == 200:
    created_offer = resp.json().get('offer')
    offer_id = created_offer.get('offer_id')
    print(f"✅ Offer created: {offer_id}")
    
    # Check the offer in database
    print("\n5️⃣  Checking offer settings in database...")
    offer = offers_collection.find_one({'offer_id': offer_id})
    
    if offer:
        print(f"\nOffer Details:")
        print(f"  - name: {offer.get('name')}")
        print(f"  - affiliates: {offer.get('affiliates')}")
        print(f"  - approval_settings: {json.dumps(offer.get('approval_settings', {}), indent=4)}")
        
        # Verify settings
        if offer.get('affiliates') == 'request':
            print("\n  ✅ affiliates correctly set to 'request'")
        else:
            print(f"\n  ❌ ERROR: affiliates is '{offer.get('affiliates')}', should be 'request'")
        
        if offer.get('approval_settings', {}).get('type') == 'time_based':
            print("  ✅ approval type correctly set to 'time_based'")
        else:
            print(f"  ❌ ERROR: approval type is '{offer.get('approval_settings', {}).get('type')}'")
        
        if offer.get('approval_settings', {}).get('auto_approve_delay') == 60:
            print("  ✅ auto_approve_delay correctly set to 60 minutes")
        else:
            print(f"  ❌ ERROR: auto_approve_delay is {offer.get('approval_settings', {}).get('auto_approve_delay')}")
    else:
        print("❌ ERROR: Offer not found in database!")
else:
    print(f"❌ ERROR: Failed to create offer: {resp.status_code}")
    print(resp.text)

print("\n" + "=" * 80)
print("✅ TEST COMPLETE!")
print("=" * 80)
