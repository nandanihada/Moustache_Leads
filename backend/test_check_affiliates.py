#!/usr/bin/env python3

from database import db_instance

offers_collection = db_instance.get_collection('offers')

# Check the two test offers we just created
offers = offers_collection.find({'offer_id': {'$in': ['ML-00068', 'ML-00069']}})

for offer in offers:
    print(f"\nOffer: {offer.get('name')} (ID: {offer.get('offer_id')})")
    print(f"  - affiliates: {offer.get('affiliates')}")
    print(f"  - approval_type: {offer.get('approval_settings', {}).get('type')}")
    print(f"  - require_approval: {offer.get('approval_settings', {}).get('require_approval')}")
    
    if offer.get('affiliates') == 'request':
        print("  ✅ CORRECT: affiliates set to 'request'")
    else:
        print(f"  ❌ ERROR: affiliates is '{offer.get('affiliates')}'")
