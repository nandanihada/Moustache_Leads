"""
Migration Script: Update Postback URLs to Use Subdomain
========================================================

This script updates all existing postback receiver URLs in the database
to use the new subdomain: postback.moustacheleads.com

Run this script ONCE after deploying the subdomain changes.

Usage:
    python migrations/update_postback_urls_to_subdomain.py
"""

import sys
import os
from datetime import datetime, timezone

# Add parent directory to path to import database
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from database import db_instance
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def update_postback_urls():
    """Update all postback receiver URLs to use the new subdomain"""
    
    try:
        # Connect to database
        if not db_instance.is_connected():
            logger.info("Connecting to database...")
            db_instance.connect()
        
        partners_collection = db_instance.get_collection('partners')
        
        if partners_collection is None:
            logger.error("❌ Could not access partners collection")
            return False
        
        # Find all partners with old postback URLs
        old_backend_url = "https://moustacheleads-backend.onrender.com/postback/"
        new_subdomain_url = "https://postback.moustacheleads.com/postback/"
        
        # Count partners with old URLs
        partners_with_old_urls = partners_collection.count_documents({
            'postback_receiver_url': {'$regex': '^https://moustacheleads-backend.onrender.com/postback/'}
        })
        
        logger.info(f"📊 Found {partners_with_old_urls} partners with old postback URLs")
        
        if partners_with_old_urls == 0:
            logger.info("✅ No partners need updating. All URLs are already using the subdomain.")
            return True
        
        # Update all partners
        result = partners_collection.update_many(
            {
                'postback_receiver_url': {'$regex': '^https://moustacheleads-backend.onrender.com/postback/'}
            },
            [
                {
                    '$set': {
                        'postback_receiver_url': {
                            '$replaceOne': {
                                'input': '$postback_receiver_url',
                                'find': old_backend_url,
                                'replacement': new_subdomain_url
                            }
                        },
                        'updated_at': datetime.now(timezone.utc),
                        'migration_updated': True,
                        'migration_date': datetime.now(timezone.utc)
                    }
                }
            ]
        )
        
        logger.info(f"✅ Updated {result.modified_count} partner postback URLs")
        
        # Verify the update
        remaining_old_urls = partners_collection.count_documents({
            'postback_receiver_url': {'$regex': '^https://moustacheleads-backend.onrender.com/postback/'}
        })
        
        if remaining_old_urls > 0:
            logger.warning(f"⚠️ {remaining_old_urls} partners still have old URLs. Manual review needed.")
            
            # Show the partners that still have old URLs
            old_partners = partners_collection.find({
                'postback_receiver_url': {'$regex': '^https://moustacheleads-backend.onrender.com/postback/'}
            })
            
            logger.info("Partners with old URLs:")
            for partner in old_partners:
                logger.info(f"  - {partner.get('partner_name')}: {partner.get('postback_receiver_url')}")
        else:
            logger.info("✅ All postback URLs successfully updated to use subdomain!")
        
        # Show sample of updated URLs
        logger.info("\n📋 Sample of updated URLs:")
        updated_partners = partners_collection.find({
            'migration_updated': True
        }).limit(5)
        
        for partner in updated_partners:
            logger.info(f"  ✓ {partner.get('partner_name')}: {partner.get('postback_receiver_url')}")
        
        return True
        
    except Exception as e:
        logger.error(f"❌ Error updating postback URLs: {str(e)}", exc_info=True)
        return False

def rollback_postback_urls():
    """Rollback postback URLs to old backend URL (in case of issues)"""
    
    try:
        if not db_instance.is_connected():
            logger.info("Connecting to database...")
            db_instance.connect()
        
        partners_collection = db_instance.get_collection('partners')
        
        if partners_collection is None:
            logger.error("❌ Could not access partners collection")
            return False
        
        old_backend_url = "https://moustacheleads-backend.onrender.com/postback/"
        new_subdomain_url = "https://postback.moustacheleads.com/postback/"
        
        # Count partners with new URLs
        partners_with_new_urls = partners_collection.count_documents({
            'postback_receiver_url': {'$regex': '^https://postback.moustacheleads.com/postback/'}
        })
        
        logger.info(f"📊 Found {partners_with_new_urls} partners with new subdomain URLs")
        
        if partners_with_new_urls == 0:
            logger.info("✅ No partners need rollback.")
            return True
        
        # Rollback all partners
        result = partners_collection.update_many(
            {
                'postback_receiver_url': {'$regex': '^https://postback.moustacheleads.com/postback/'}
            },
            [
                {
                    '$set': {
                        'postback_receiver_url': {
                            '$replaceOne': {
                                'input': '$postback_receiver_url',
                                'find': new_subdomain_url,
                                'replacement': old_backend_url
                            }
                        },
                        'updated_at': datetime.now(timezone.utc),
                        'migration_updated': False,
                        'rollback_date': datetime.now(timezone.utc)
                    }
                }
            ]
        )
        
        logger.info(f"✅ Rolled back {result.modified_count} partner postback URLs")
        return True
        
    except Exception as e:
        logger.error(f"❌ Error rolling back postback URLs: {str(e)}", exc_info=True)
        return False

if __name__ == '__main__':
    import argparse
    
    parser = argparse.ArgumentParser(description='Update postback URLs to use subdomain')
    parser.add_argument('--rollback', action='store_true', help='Rollback to old backend URLs')
    parser.add_argument('--dry-run', action='store_true', help='Show what would be updated without making changes')
    
    args = parser.parse_args()
    
    logger.info("=" * 80)
    logger.info("POSTBACK URL MIGRATION SCRIPT")
    logger.info("=" * 80)
    
    if args.dry_run:
        logger.info("🔍 DRY RUN MODE - No changes will be made")
        
        if not db_instance.is_connected():
            db_instance.connect()
        
        partners_collection = db_instance.get_collection('partners')
        
        old_count = partners_collection.count_documents({
            'postback_receiver_url': {'$regex': '^https://moustacheleads-backend.onrender.com/postback/'}
        })
        
        new_count = partners_collection.count_documents({
            'postback_receiver_url': {'$regex': '^https://postback.moustacheleads.com/postback/'}
        })
        
        logger.info(f"📊 Partners with old backend URLs: {old_count}")
        logger.info(f"📊 Partners with new subdomain URLs: {new_count}")
        
        if old_count > 0:
            logger.info("\nPartners that would be updated:")
            partners = partners_collection.find({
                'postback_receiver_url': {'$regex': '^https://moustacheleads-backend.onrender.com/postback/'}
            })
            
            for partner in partners:
                old_url = partner.get('postback_receiver_url', '')
                new_url = old_url.replace(
                    'https://moustacheleads-backend.onrender.com/postback/',
                    'https://postback.moustacheleads.com/postback/'
                )
                logger.info(f"  {partner.get('partner_name')}:")
                logger.info(f"    OLD: {old_url}")
                logger.info(f"    NEW: {new_url}")
        
    elif args.rollback:
        logger.info("⏪ ROLLBACK MODE - Reverting to old backend URLs")
        confirm = input("Are you sure you want to rollback? (yes/no): ")
        
        if confirm.lower() == 'yes':
            success = rollback_postback_urls()
            if success:
                logger.info("✅ Rollback completed successfully!")
            else:
                logger.error("❌ Rollback failed!")
                sys.exit(1)
        else:
            logger.info("❌ Rollback cancelled")
    else:
        logger.info("🚀 UPDATE MODE - Updating to new subdomain URLs")
        confirm = input("Are you sure you want to update all postback URLs? (yes/no): ")
        
        if confirm.lower() == 'yes':
            success = update_postback_urls()
            if success:
                logger.info("\n" + "=" * 80)
                logger.info("✅ MIGRATION COMPLETED SUCCESSFULLY!")
                logger.info("=" * 80)
                logger.info("\nNext steps:")
                logger.info("1. Verify the URLs in your admin dashboard")
                logger.info("2. Test a postback URL to ensure it works")
                logger.info("3. Notify partners of the new URLs (if needed)")
            else:
                logger.error("\n" + "=" * 80)
                logger.error("❌ MIGRATION FAILED!")
                logger.error("=" * 80)
                sys.exit(1)
        else:
            logger.info("❌ Migration cancelled")
    
    logger.info("\n" + "=" * 80)
