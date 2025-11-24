#!/usr/bin/env python3

from database import db_instance
import logging

def debug_offers():
    """Debug offers in the database"""
    
    try:
        # Connect to database
        offers_collection = db_instance.get_collection('offers')
        
        if offers_collection is None:
            print("❌ Could not connect to offers collection")
            return
        
        # Count total offers
        total_offers = offers_collection.count_documents({})
        print(f"📊 Total offers in database: {total_offers}")
        
        # Count active offers
        active_offers = offers_collection.count_documents({'status': 'active'})
        print(f"✅ Active offers: {active_offers}")
        
        # Count by status
        statuses = offers_collection.distinct('status')
        print(f"📋 Available statuses: {statuses}")
        
        for status in statuses:
            count = offers_collection.count_documents({'status': status})
            print(f"   - {status}: {count}")
        
        # Show sample offers
        print(f"\n📝 Sample offers:")
        sample_offers = list(offers_collection.find({}).limit(3))
        
        for i, offer in enumerate(sample_offers, 1):
            print(f"   {i}. ID: {offer.get('offer_id', 'N/A')}")
            print(f"      Name: {offer.get('name', 'N/A')}")
            print(f"      Status: {offer.get('status', 'N/A')}")
            print(f"      Payout: ${offer.get('payout', 0)}")
            print(f"      Affiliates: {offer.get('affiliates', 'N/A')}")
            
            # Check approval fields
            approval_status = offer.get('approval_status', 'N/A')
            approval_settings = offer.get('approval_settings', {})
            print(f"      Approval Status: {approval_status}")
            print(f"      Approval Settings: {approval_settings}")
            print()
        
        # Check for approval workflow fields
        offers_with_approval = offers_collection.count_documents({'approval_status': {'$exists': True}})
        print(f"🔒 Offers with approval workflow: {offers_with_approval}")
        
        # Check affiliate access settings
        all_affiliate_offers = offers_collection.count_documents({'affiliates': 'all'})
        selected_affiliate_offers = offers_collection.count_documents({'affiliates': 'selected'})
        print(f"👥 Offers for all affiliates: {all_affiliate_offers}")
        print(f"👤 Offers for selected affiliates: {selected_affiliate_offers}")
        
    except Exception as e:
        print(f"❌ Error debugging offers: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    debug_offers()
