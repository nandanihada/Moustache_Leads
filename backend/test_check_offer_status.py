#!/usr/bin/env python3

from database import db_instance

offers_collection = db_instance.get_collection('offers')

# Check the test offer
offer = offers_collection.find_one({'offer_id': 'ML-00071'})

if offer:
    print(f"Offer: {offer.get('name')} (ID: {offer.get('offer_id')})")
    print(f"  - status: {offer.get('status')}")
    print(f"  - is_active: {offer.get('is_active')}")
    print(f"  - approval_status: {offer.get('approval_status')}")
    print(f"  - affiliates: {offer.get('affiliates')}")
else:
    print("Offer not found")
