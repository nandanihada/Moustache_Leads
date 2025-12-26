#!/usr/bin/env python3

from database import db_instance

def check_offers():
    """Check current offer access settings"""
    
    try:
        offers_collection = db_instance.get_collection('offers')
        
        offers = list(offers_collection.find({}).limit(5))
        
        print("📋 Current Offer Access Settings:\n")
        
        for offer in offers:
            print(f"Offer: {offer.get('name')} (ID: {offer.get('offer_id')})")
            print(f"  - affiliates: {offer.get('affiliates', 'NOT SET (defaults to all)')}")
            print(f"  - approval_status: {offer.get('approval_status', 'NOT SET')}")
            print(f"  - approval_settings: {offer.get('approval_settings', {})}")
            print()
        
        # Update offers to require approval
        print("🔧 Updating offers to require approval workflow...\n")
        
        result = offers_collection.update_many(
            {},
            {
                '$set': {
                    'affiliates': 'request',  # Require access request
                    'approval_status': 'active',
                    'approval_settings': {
                        'type': 'manual',  # Require manual approval
                        'require_approval': True,
                        'approval_message': 'Please request access to this offer',
                        'max_inactive_days': 30
                    }
                }
            }
        )
        
        print(f"✅ Updated {result.modified_count} offers")
        print(f"   - Set affiliates to 'request' (requires access request)")
        print(f"   - Set approval_status to 'active'")
        print(f"   - Set approval_settings with manual approval type")
        
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    check_offers()
