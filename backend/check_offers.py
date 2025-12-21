"""
Check current offer state
"""
import sys
sys.path.append('.')

from database import db_instance

if not db_instance.is_connected():
    db_instance.connect()

print("="*80)
print("CHECKING OFFERS")
print("="*80)

offers = db_instance.get_collection('offers')
if offers is not None:
    # Find all offers with name containing "first"
    all_offers = list(offers.find({'$or': [
        {'offer_name': {'$regex': 'first', '$options': 'i'}},
        {'name': {'$regex': 'first', '$options': 'i'}}
    ]}))
    
    print(f"\nFound {len(all_offers)} offer(s):")
    for offer in all_offers:
        print(f"\n  Offer ID: {offer.get('offer_id')}")
        print(f"  Name: {offer.get('offer_name', offer.get('name'))}")
        print(f"  Survey ID: {offer.get('survey_id', 'NOT SET')}")
        print(f"  Payout: {offer.get('payout')}")

print("="*80)
