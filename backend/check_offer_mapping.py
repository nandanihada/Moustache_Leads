"""
Check if offer mapping exists
"""
import sys
sys.path.append('.')

from database import db_instance

if not db_instance.is_connected():
    db_instance.connect()

print("="*80)
print("CHECKING OFFER MAPPING")
print("="*80)

# Check if offer exists
offers = db_instance.get_collection('offers')
if offers is not None:
    offer = offers.find_one({'offer_id': 'ML-00057'})
    
    if offer:
        print(f"\n✅ Found offer ML-00057:")
        print(f"   Name: {offer.get('offer_name')}")
        print(f"   External ID: {offer.get('external_offer_id')}")
        print(f"   Payout: {offer.get('payout')}")
        
        if not offer.get('external_offer_id'):
            print(f"\n⚠️ No external_offer_id set! Adding it now...")
            offers.update_one(
                {'offer_id': 'ML-00057'},
                {'$set': {'external_offer_id': 'VBFS6'}}
            )
            print(f"✅ Added external_offer_id: VBFS6")
    else:
        print(f"\n❌ Offer ML-00057 NOT FOUND!")
        print(f"   The offer doesn't exist in the database.")
        print(f"   You need to create it first in the admin panel.")

print("="*80)
