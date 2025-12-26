#!/usr/bin/env python3
"""
Fix tracking URLs in database that have incorrect port :5000
This script finds and fixes offers with masked_url containing :5000
"""

from database import db_instance
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def fix_tracking_urls():
    """Find and fix tracking URLs with incorrect port"""
    
    try:
        offers_collection = db_instance.get_collection('offers')
        
        if offers_collection is None:
            logger.error("❌ Could not access offers collection")
            return
        
        # Find offers with masked_url containing :5000
        query = {
            'masked_url': {'$regex': ':5000'}
        }
        
        offers_with_port = list(offers_collection.find(query))
        logger.info(f"🔍 Found {len(offers_with_port)} offers with :5000 in masked_url")
        
        if len(offers_with_port) == 0:
            logger.info("✅ No offers need fixing!")
            return
        
        # Show examples
        logger.info("\n📋 Examples of URLs that will be fixed:")
        for i, offer in enumerate(offers_with_port[:5]):
            logger.info(f"\n  Offer {i+1}: {offer.get('offer_id', 'Unknown')}")
            logger.info(f"    Name: {offer.get('name', 'Unknown')}")
            logger.info(f"    Current: {offer.get('masked_url', 'N/A')}")
            
            # Show what it will become
            fixed_url = offer.get('masked_url', '').replace(':5000', '')
            logger.info(f"    Fixed:   {fixed_url}")
        
        # Ask for confirmation
        print("\n" + "="*80)
        response = input(f"\n⚠️  Fix {len(offers_with_port)} offers? (yes/no): ")
        
        if response.lower() != 'yes':
            logger.info("❌ Cancelled by user")
            return
        
        # Fix the URLs
        fixed_count = 0
        for offer in offers_with_port:
            old_url = offer.get('masked_url', '')
            new_url = old_url.replace(':5000', '')
            
            result = offers_collection.update_one(
                {'_id': offer['_id']},
                {'$set': {'masked_url': new_url}}
            )
            
            if result.modified_count > 0:
                fixed_count += 1
                logger.info(f"✅ Fixed: {offer.get('offer_id', 'Unknown')}")
        
        logger.info(f"\n🎉 Successfully fixed {fixed_count} offers!")
        
        # Verify
        remaining = offers_collection.count_documents(query)
        if remaining == 0:
            logger.info("✅ All tracking URLs are now correct!")
        else:
            logger.warning(f"⚠️  {remaining} offers still have :5000 in URL")
        
    except Exception as e:
        logger.error(f"❌ Error fixing tracking URLs: {e}", exc_info=True)

if __name__ == '__main__':
    print("="*80)
    print("🔧 Tracking URL Fixer")
    print("="*80)
    print("\nThis script will:")
    print("  1. Find all offers with ':5000' in masked_url")
    print("  2. Show you examples")
    print("  3. Ask for confirmation")
    print("  4. Remove ':5000' from all masked_urls")
    print("\n" + "="*80 + "\n")
    
    fix_tracking_urls()
