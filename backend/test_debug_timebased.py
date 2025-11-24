#!/usr/bin/env python3

import requests
from database import db_instance

BASE_URL = 'http://127.0.0.1:5000'

# Login as admin
admin_login = requests.post(f'{BASE_URL}/api/auth/login',
    json={'username': 'admin', 'password': 'admin123'}
)
admin_token = admin_login.json().get('token')
admin_headers = {'Authorization': f'Bearer {admin_token}'}

# Create offer with time-based approval
print("Creating offer with time-based approval (60 minutes)...")
offer = {
    'campaign_id': 'DEBUG-TIMEBASED-001',
    'name': 'Debug Time-based Offer',
    'status': 'active',
    'payout': 5.00,
    'currency': 'USD',
    'network': 'TestNetwork',
    'target_url': 'https://example.com/debug',
    'approval_type': 'time_based',
    'auto_approve_delay': 60,
    'approval_message': 'Will be auto-approved in 60 minutes',
    'affiliates': 'all'  # This should be converted to 'request'
}

resp = requests.post(f'{BASE_URL}/api/admin/offers', json=offer, headers=admin_headers)
if resp.status_code in [200, 201]:
    offer_id = resp.json().get('offer', {}).get('offer_id')
    print(f"✅ Offer created: {offer_id}")
    
    # Check in database
    offers_collection = db_instance.get_collection('offers')
    db_offer = offers_collection.find_one({'offer_id': offer_id})
    
    print(f"\nOffer Details in Database:")
    print(f"  - offer_id: {db_offer.get('offer_id')}")
    print(f"  - name: {db_offer.get('name')}")
    print(f"  - affiliates: {db_offer.get('affiliates')}")
    print(f"  - approval_status: {db_offer.get('approval_status')}")
    print(f"  - approval_settings:")
    for key, val in db_offer.get('approval_settings', {}).items():
        print(f"      - {key}: {val}")
    
    # Now check what publisher sees
    print(f"\n" + "=" * 80)
    print("Checking what publisher sees...")
    
    pub_login = requests.post(f'{BASE_URL}/api/auth/login',
        json={'username': 'testuser2', 'password': 'password123'}
    )
    pub_token = pub_login.json().get('token')
    pub_headers = {'Authorization': f'Bearer {pub_token}'}
    
    resp = requests.get(f'{BASE_URL}/api/publisher/offers/available', headers=pub_headers)
    offers = resp.json().get('offers', [])
    pub_offer = next((o for o in offers if o.get('offer_id') == offer_id), None)
    
    if pub_offer:
        print(f"\n✅ Offer found in publisher's available offers")
        print(f"  - name: {pub_offer.get('name')}")
        print(f"  - has_access: {pub_offer.get('has_access')}")
        print(f"  - is_preview: {pub_offer.get('is_preview')}")
        print(f"  - requires_approval: {pub_offer.get('requires_approval')}")
        print(f"  - approval_type: {pub_offer.get('approval_type')}")
        print(f"  - target_url present: {'target_url' in pub_offer}")
        print(f"  - masked_url present: {'masked_url' in pub_offer}")
        
        if pub_offer.get('has_access'):
            print(f"\n❌ ERROR: Publisher should NOT have access yet!")
            print(f"   The offer requires time-based approval, so publisher should see preview only")
        else:
            print(f"\n✅ CORRECT: Publisher does NOT have access")
    else:
        print(f"❌ Offer not found in publisher's available offers")
else:
    print(f"❌ Failed to create offer: {resp.status_code}")
    print(resp.text)
