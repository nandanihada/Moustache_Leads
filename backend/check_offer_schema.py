#!/usr/bin/env python3
"""
Check actual offer schema in MongoDB
"""

from database import db_instance
from bson import ObjectId

def check_offer_schema():
    """Check what fields are actually in offers collection"""
    
    try:
        offers_collection = db_instance.get_collection('offers')
        
        if offers_collection is None:
            print("❌ Could not connect to offers collection")
            return
        
        # Get first offer
        offer = offers_collection.find_one({'is_active': True})
        
        if not offer:
            print("❌ No offers found in database")
            return
        
        print("=" * 80)
        print("OFFER DOCUMENT STRUCTURE")
        print("=" * 80)
        
        # Print all fields
        print("\nAll fields in offer:")
        for key in sorted(offer.keys()):
            value = offer[key]
            if isinstance(value, ObjectId):
                print(f"  {key}: ObjectId({str(value)[:20]}...)")
            elif isinstance(value, dict):
                print(f"  {key}: {type(value).__name__} with {len(value)} keys")
            elif isinstance(value, list):
                print(f"  {key}: list with {len(value)} items")
            elif isinstance(value, str) and len(str(value)) > 50:
                print(f"  {key}: str ({len(str(value))} chars)")
            else:
                print(f"  {key}: {value}")
        
        print("\n" + "=" * 80)
        print("PROMO CODE FIELDS CHECK")
        print("=" * 80)
        
        # Check promo code fields specifically
        promo_fields = ['promo_code_id', 'promo_code', 'bonus_amount', 'bonus_type', 
                       'promo_code_assigned_at', 'promo_code_assigned_by']
        
        for field in promo_fields:
            if field in offer:
                value = offer[field]
                print(f"✅ {field}: {value}")
            else:
                print(f"❌ {field}: NOT FOUND")
        
        print("\n" + "=" * 80)
        print("OFFER DETAILS")
        print("=" * 80)
        print(f"Offer ID: {offer.get('offer_id')}")
        print(f"Offer Name: {offer.get('name')}")
        print(f"Created At: {offer.get('created_at')}")
        print(f"Updated At: {offer.get('updated_at')}")
        
        # Count total offers
        total = offers_collection.count_documents({'is_active': True})
        print(f"\nTotal active offers: {total}")
        
        # Check if any offers have promo codes
        offers_with_promo = offers_collection.count_documents({
            'is_active': True,
            'promo_code': {'$exists': True, '$ne': None}
        })
        print(f"Offers with promo codes: {offers_with_promo}")
        
        if offers_with_promo > 0:
            print("\nOffers with promo codes:")
            for offer_with_promo in offers_collection.find({
                'is_active': True,
                'promo_code': {'$exists': True, '$ne': None}
            }).limit(5):
                print(f"  - {offer_with_promo.get('offer_id')}: {offer_with_promo.get('name')} → {offer_with_promo.get('promo_code')}")
        
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    check_offer_schema()
