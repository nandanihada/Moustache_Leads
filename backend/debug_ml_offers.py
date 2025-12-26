#!/usr/bin/env python3
"""
Check offers that might match 'ml' or 'ml656'
"""

from database import db_instance

print("\n" + "="*80)
print("🔍 CHECKING OFFERS MATCHING 'ml'")
print("="*80)

offers = db_instance.get_collection('offers')

# Search for offers with 'ml' in offer_id
search_patterns = ['ml', 'ml656', 'ML', 'ML656']

for pattern in search_patterns:
    print(f"\n📋 Searching for: {pattern}")
    results = list(offers.find({
        'offer_id': {'$regex': pattern, '$options': 'i'}
    }).limit(10))
    
    if results:
        print(f"   Found {len(results)} offers:")
        for offer in results:
            payout = offer.get('payout', 0)
            has_bonus = bool(offer.get('promo_code_id'))
            bonus_str = f" + {offer.get('bonus_amount')}% bonus" if has_bonus else ""
            print(f"   - {offer.get('offer_id')}: {offer.get('name')}")
            print(f"     Payout: {payout}{bonus_str}")
            print(f"     Status: {offer.get('status')}")
    else:
        print(f"   No offers found")

# Also check recent postbacks
print("\n" + "="*80)
print("📥 Recent Received Postbacks:")
print("="*80)

received = db_instance.get_collection('received_postbacks')
recent = list(received.find().sort('timestamp', -1).limit(3))

for i, pb in enumerate(recent, 1):
    params = pb.get('query_params', {})
    print(f"\n{i}. Time: {pb.get('timestamp')}")
    print(f"   Offer ID: {params.get('offer_id', 'N/A')}")
    print(f"   Click ID: {params.get('click_id', 'N/A')}")
    print(f"   User ID: {params.get('user_id', 'N/A')}")

print("\n" + "="*80)
