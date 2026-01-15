"""
Quick Script to Update Postback URLs
=====================================

This script updates all postback URLs in the database to use the new subdomain.

Run this from the backend directory:
    python update_postback_urls.py
"""

from database import db_instance
from datetime import datetime, timezone
import logging

logging.basicConfig(level=logging.INFO, format='%(message)s')
logger = logging.getLogger(__name__)

def main():
    logger.info("=" * 80)
    logger.info("UPDATING POSTBACK URLs TO USE SUBDOMAIN")
    logger.info("=" * 80)
    
    try:
        # Connect to database
        if not db_instance.is_connected():
            logger.info("📡 Connecting to database...")
            db_instance.connect()
        
        partners_collection = db_instance.get_collection('partners')
        
        if partners_collection is None:
            logger.error("❌ Could not access partners collection")
            return
        
        # Count partners with old URLs
        old_url_pattern = "https://moustacheleads-backend.onrender.com/postback/"
        new_url_pattern = "https://postback.moustacheleads.com/postback/"
        
        old_count = partners_collection.count_documents({
            'postback_receiver_url': {'$regex': '^https://moustacheleads-backend.onrender.com/postback/'}
        })
        
        logger.info(f"\n📊 Found {old_count} partners with old postback URLs")
        
        if old_count == 0:
            logger.info("✅ All postback URLs are already using the subdomain!")
            return
        
        # Show what will be updated
        logger.info("\n📋 Partners that will be updated:")
        partners = list(partners_collection.find({
            'postback_receiver_url': {'$regex': '^https://moustacheleads-backend.onrender.com/postback/'}
        }))
        
        for i, partner in enumerate(partners, 1):
            old_url = partner.get('postback_receiver_url', '')
            new_url = old_url.replace(old_url_pattern, new_url_pattern)
            logger.info(f"\n{i}. {partner.get('partner_name')}")
            logger.info(f"   OLD: {old_url}")
            logger.info(f"   NEW: {new_url}")
        
        # Confirm update
        logger.info("\n" + "=" * 80)
        response = input("Do you want to update these URLs? (yes/no): ")
        
        if response.lower() != 'yes':
            logger.info("❌ Update cancelled")
            return
        
        # Update all partners
        logger.info("\n🔄 Updating URLs...")
        
        updated_count = 0
        for partner in partners:
            old_url = partner.get('postback_receiver_url', '')
            new_url = old_url.replace(old_url_pattern, new_url_pattern)
            
            result = partners_collection.update_one(
                {'_id': partner['_id']},
                {
                    '$set': {
                        'postback_receiver_url': new_url,
                        'updated_at': datetime.now(timezone.utc),
                        'url_migration_date': datetime.now(timezone.utc)
                    }
                }
            )
            
            if result.modified_count > 0:
                updated_count += 1
                logger.info(f"✅ Updated: {partner.get('partner_name')}")
        
        logger.info("\n" + "=" * 80)
        logger.info(f"✅ Successfully updated {updated_count} postback URLs!")
        logger.info("=" * 80)
        
        # Verify
        remaining = partners_collection.count_documents({
            'postback_receiver_url': {'$regex': '^https://moustacheleads-backend.onrender.com/postback/'}
        })
        
        if remaining > 0:
            logger.warning(f"\n⚠️ Warning: {remaining} partners still have old URLs")
        else:
            logger.info("\n✅ All postback URLs now use: postback.moustacheleads.com")
        
    except Exception as e:
        logger.error(f"\n❌ Error: {str(e)}", exc_info=True)

if __name__ == '__main__':
    main()
