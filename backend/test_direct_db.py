#!/usr/bin/env python3

from database import db_instance
from bson import ObjectId

def test_direct():
    """Test direct database access"""
    
    try:
        # Get collections
        offers_collection = db_instance.get_collection('offers')
        users_collection = db_instance.get_collection('users')
        
        # Get testuser2
        user = users_collection.find_one({'username': 'testuser2'})
        if not user:
            print("❌ User not found")
            return
        
        user_id = user.get('_id')
        print(f"✅ Found user: {user.get('username')}")
        print(f"   User ID: {user_id}")
        print(f"   Account Type: {user.get('account_type', 'N/A')}")
        
        # Get offers
        offers = list(offers_collection.find({'status': 'active', 'is_active': True}))
        print(f"\n✅ Found {len(offers)} active offers")
        
        for offer in offers:
            print(f"\n   Offer: {offer.get('name')} (ID: {offer.get('offer_id')})")
            print(f"   - affiliates: {offer.get('affiliates')}")
            print(f"   - approval_status: {offer.get('approval_status')}")
            print(f"   - approval_settings: {offer.get('approval_settings')}")
        
        # Test access control
        print("\n" + "=" * 60)
        print("Testing Access Control Logic")
        print("=" * 60)
        
        from services.access_control_service import AccessControlService
        access_service = AccessControlService()
        
        if offers:
            first_offer = offers[0]
            offer_id = first_offer.get('offer_id')
            
            print(f"\nTesting access for offer: {offer_id}")
            has_access, reason = access_service.check_offer_access(offer_id, user_id)
            
            print(f"Has Access: {has_access}")
            print(f"Reason: {reason}")
            
            # Check approval status
            approval_status = access_service._check_approval_status(offer_id, user_id)
            print(f"Approval Status: {approval_status}")
        
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_direct()
