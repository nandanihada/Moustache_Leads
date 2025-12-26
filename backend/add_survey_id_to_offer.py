"""
Add survey_id to existing offer for testing
"""
import sys
sys.path.append('.')

from database import db_instance

if not db_instance.is_connected():
    db_instance.connect()

print("="*80)
print("ADDING SURVEY_ID TO OFFER")
print("="*80)

# Find "My first offer"
offers = db_instance.get_collection('offers')
if offers is not None:
    # Update the offer to add survey_id
    result = offers.update_one(
        {'$or': [
            {'offer_name': {'$regex': 'first', '$options': 'i'}},
            {'name': {'$regex': 'first', '$options': 'i'}}
        ]},
        {'$set': {'survey_id': 'VBFS6'}}
    )
    
    if result.modified_count > 0:
        print(f"✅ Added survey_id='VBFS6' to 'My first offer'")
        
        # Show the updated offer
        offer = offers.find_one({'survey_id': 'VBFS6'})
        if offer:
            print(f"\n📋 Updated Offer:")
            print(f"   Offer ID: {offer.get('offer_id')}")
            print(f"   Name: {offer.get('offer_name', offer.get('name'))}")
            print(f"   Survey ID: {offer.get('survey_id')}")
            print(f"   Payout: {offer.get('payout')}")
    else:
        print(f"⚠️ Offer already has survey_id or not found")
        
        # Check if it already exists
        offer = offers.find_one({'survey_id': 'VBFS6'})
        if offer:
            print(f"\n✅ Offer with survey_id='VBFS6' already exists:")
            print(f"   Offer ID: {offer.get('offer_id')}")
            print(f"   Name: {offer.get('offer_name', offer.get('name'))}")

print("="*80)
