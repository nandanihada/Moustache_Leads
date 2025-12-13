"""
Migration Script: Add Promo Code Enhancements
Adds active_hours, auto_deactivate_on_max_uses, and offer_applications fields
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import db_instance
from datetime import datetime
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def migrate_promo_codes():
    """Add new fields to existing promo codes"""
    try:
        promo_codes_collection = db_instance.get_collection('promo_codes')
        
        # Add new fields to all existing promo codes
        result = promo_codes_collection.update_many(
            {},
            {
                '$set': {
                    'active_hours': {
                        'enabled': False,
                        'start_time': '00:00',
                        'end_time': '23:59',
                        'timezone': 'UTC'
                    },
                    'auto_deactivate_on_max_uses': True
                }
            }
        )
        
        logger.info(f"✅ Updated {result.modified_count} promo codes with new fields")
        return result.modified_count
        
    except Exception as e:
        logger.error(f"❌ Error migrating promo codes: {str(e)}")
        return 0


def migrate_user_promo_codes():
    """Add offer_applications array to existing user_promo_codes"""
    try:
        user_promo_collection = db_instance.get_collection('user_promo_codes')
        
        # Add offer_applications array to all existing user promo codes
        result = user_promo_collection.update_many(
            {},
            {
                '$set': {
                    'offer_applications': []
                }
            }
        )
        
        logger.info(f"✅ Updated {result.modified_count} user promo codes with offer_applications field")
        return result.modified_count
        
    except Exception as e:
        logger.error(f"❌ Error migrating user promo codes: {str(e)}")
        return 0


def run_migration():
    """Run all migrations"""
    logger.info("🚀 Starting promo code enhancement migration...")
    
    # Check database connection
    if not db_instance.is_connected():
        logger.error("❌ Database not connected")
        return False
    
    logger.info("📊 Database connected successfully")
    
    # Run migrations
    promo_count = migrate_promo_codes()
    user_promo_count = migrate_user_promo_codes()
    
    logger.info(f"""
    ✅ Migration Complete!
    
    Summary:
    - Promo codes updated: {promo_count}
    - User promo codes updated: {user_promo_count}
    
    New fields added:
    - promo_codes.active_hours (time-based validity)
    - promo_codes.auto_deactivate_on_max_uses (auto-deactivation)
    - user_promo_codes.offer_applications (offer tracking)
    """)
    
    return True


if __name__ == "__main__":
    success = run_migration()
    if success:
        logger.info("✅ Migration completed successfully!")
    else:
        logger.error("❌ Migration failed!")
