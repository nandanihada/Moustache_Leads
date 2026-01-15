"""
Verify Postback URLs
====================

This script checks if all postback URLs have been updated to use the subdomain.
"""

from database import db_instance
import logging

logging.basicConfig(level=logging.INFO, format='%(message)s')
logger = logging.getLogger(__name__)

def main():
    logger.info("=" * 80)
    logger.info("VERIFYING POSTBACK URLs")
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
        
        # Count partners with new subdomain URLs
        new_count = partners_collection.count_documents({
            'postback_receiver_url': {'$regex': '^https://postback.moustacheleads.com/postback/'}
        })
        
        # Count partners with old backend URLs
        old_count = partners_collection.count_documents({
            'postback_receiver_url': {'$regex': '^https://moustacheleads-backend.onrender.com/postback/'}
        })
        
        # Count total partners
        total_count = partners_collection.count_documents({})
        
        logger.info(f"\n📊 STATISTICS:")
        logger.info(f"   Total Partners: {total_count}")
        logger.info(f"   ✅ Using Subdomain: {new_count}")
        logger.info(f"   ❌ Using Old URL: {old_count}")
        
        if old_count == 0:
            logger.info("\n✅ SUCCESS! All postback URLs are using the subdomain!")
        else:
            logger.warning(f"\n⚠️ WARNING: {old_count} partners still have old URLs")
            
            # Show partners with old URLs
            logger.info("\n📋 Partners with old URLs:")
            old_partners = partners_collection.find({
                'postback_receiver_url': {'$regex': '^https://moustacheleads-backend.onrender.com/postback/'}
            })
            
            for i, partner in enumerate(old_partners, 1):
                logger.info(f"\n{i}. {partner.get('partner_name')}")
                logger.info(f"   URL: {partner.get('postback_receiver_url')}")
        
        # Show sample of new URLs
        if new_count > 0:
            logger.info("\n📋 Sample of updated URLs:")
            new_partners = partners_collection.find({
                'postback_receiver_url': {'$regex': '^https://postback.moustacheleads.com/postback/'}
            }).limit(5)
            
            for i, partner in enumerate(new_partners, 1):
                logger.info(f"\n{i}. {partner.get('partner_name')}")
                logger.info(f"   ✓ {partner.get('postback_receiver_url')}")
        
        logger.info("\n" + "=" * 80)
        
    except Exception as e:
        logger.error(f"\n❌ Error: {str(e)}", exc_info=True)

if __name__ == '__main__':
    main()
