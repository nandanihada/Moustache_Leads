#!/usr/bin/env python3
"""
Check tracking URLs in database for port :5000
"""

from database import db_instance
import logging

logging.basicConfig(level=logging.INFO, format='%(message)s')
logger = logging.getLogger(__name__)

def check_tracking_urls():
    """Check tracking URLs for incorrect port"""
    
    try:
        offers_collection = db_instance.get_collection('offers')
        
        if offers_collection is None:
            print("❌ Could not access offers collection")
            return
        
        # Find offers with masked_url containing :5000
        query = {'masked_url': {'$regex': ':5000'}}
        
        offers_with_port = list(offers_collection.find(query))
        print(f"\n🔍 Found {len(offers_with_port)} offers with :5000 in masked_url\n")
        
        if len(offers_with_port) == 0:
            print("✅ No offers have :5000 in their URLs!")
            print("✅ All tracking URLs are correct!")
            return
        
        # Show all offers with the issue
        print("📋 Offers with :5000 in masked_url:\n")
        for i, offer in enumerate(offers_with_port, 1):
            print(f"{i}. Offer ID: {offer.get('offer_id', 'Unknown')}")
            print(f"   Name: {offer.get('name', 'Unknown')}")
            print(f"   Current URL: {offer.get('masked_url', 'N/A')}")
            print(f"   Fixed URL:   {offer.get('masked_url', '').replace(':5000', '')}")
            print()
        
        print(f"\n⚠️  Total: {len(offers_with_port)} offers need fixing")
        print("\nTo fix these, run: python fix_tracking_urls.py")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    print("="*80)
    print("🔍 Tracking URL Checker")
    print("="*80)
    check_tracking_urls()
