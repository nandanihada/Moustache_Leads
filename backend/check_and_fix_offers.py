"""
Check database for offers and find the correct one to map VBFS6 to
"""
import sys
sys.path.append('.')

from database import db_instance

if not db_instance.is_connected():
    db_instance.connect()

print("="*80)
print("CHECKING OFFERS IN DATABASE")
print("="*80)

# 1. List all offers
offers = db_instance.get_collection('offers')
if offers is not None:
    all_offers = list(offers.find().limit(20))
    
    print(f"\n📋 Found {len(all_offers)} offers:")
    for offer in all_offers:
        print(f"\n  Offer ID: {offer.get('offer_id')}")
        print(f"  Name: {offer.get('offer_name', offer.get('name'))}")
        print(f"  External ID: {offer.get('external_offer_id')}")
    
    # 2. Find "My first offer"
    my_first_offer = offers.find_one({'$or': [
        {'offer_name': {'$regex': 'first', '$options': 'i'}},
        {'name': {'$regex': 'first', '$options': 'i'}}
    ]})
    
    if my_first_offer:
        offer_id = my_first_offer.get('offer_id')
        print(f"\n✅ Found 'My first offer':")
        print(f"   Offer ID: {offer_id}")
        print(f"   Name: {my_first_offer.get('offer_name', my_first_offer.get('name'))}")
        
        # Update the mapping
        result = offers.update_one(
            {'offer_id': offer_id},
            {'$set': {'external_offer_id': 'VBFS6'}}
        )
        
        if result.modified_count > 0:
            print(f"\n✅ FIXED: Updated mapping VBFS6 → {offer_id}")
        else:
            print(f"\n✅ Mapping already exists: VBFS6 → {offer_id}")
        
        # Remove old incorrect mapping
        offers.update_one(
            {'offer_id': 'ML-00057'},
            {'$unset': {'external_offer_id': ''}}
        )
        print(f"✅ Removed incorrect mapping from ML-00057")
    else:
        print(f"\n⚠️ 'My first offer' not found in database")

print("="*80)
