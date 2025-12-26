#!/usr/bin/env python3

from database import db_instance

def fix_offers():
    """Fix offer approval status"""
    
    try:
        offers_collection = db_instance.get_collection('offers')
        
        # Update all offers to active status
        result = offers_collection.update_many(
            {},
            {
                '$set': {
                    'approval_status': 'active'
                }
            }
        )
        
        print(f"✅ Updated {result.modified_count} offers to 'active' status")
        
        # Verify
        offers = list(offers_collection.find({}).limit(4))
        for offer in offers:
            print(f"   - {offer.get('name')}: {offer.get('approval_status')}")
        
    except Exception as e:
        print(f"❌ Error: {str(e)}")

if __name__ == "__main__":
    fix_offers()
