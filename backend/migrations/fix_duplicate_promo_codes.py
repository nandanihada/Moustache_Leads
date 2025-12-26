"""
Fix Duplicate Promo Code Applications
Adds unique index to prevent same user from applying same code multiple times
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import db_instance
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def create_unique_index():
    """Create unique index on user_promo_codes to prevent duplicates"""
    try:
        user_promo_collection = db_instance.get_collection('user_promo_codes')
        
        # First, drop the index if it exists
        try:
            user_promo_collection.drop_index('unique_user_promo_code_active')
            logger.info("🗑️ Dropped existing index")
        except:
            pass  # Index doesn't exist, that's fine
        
        # Create unique compound index on user_id + promo_code_id where is_active = True
        # Using partial filter expression to only enforce uniqueness for active codes
        result = user_promo_collection.create_index(
            [
                ('user_id', 1),
                ('promo_code_id', 1)
            ],
            unique=True,
            partialFilterExpression={'is_active': True},
            name='unique_user_promo_code_active'
        )
        
        logger.info(f"✅ Created unique index: {result}")
        return True
        
    except Exception as e:
        logger.error(f"❌ Error creating index: {str(e)}")
        # Print more details
        import traceback
        logger.error(traceback.format_exc())
        return False


def remove_duplicate_entries():
    """Remove duplicate promo code applications for same user"""
    try:
        user_promo_collection = db_instance.get_collection('user_promo_codes')
        
        # Find all duplicates
        pipeline = [
            {
                '$match': {
                    'is_active': True
                }
            },
            {
                '$group': {
                    '_id': {
                        'user_id': '$user_id',
                        'promo_code_id': '$promo_code_id'
                    },
                    'count': {'$sum': 1},
                    'docs': {'$push': '$$ROOT'}
                }
            },
            {
                '$match': {
                    'count': {'$gt': 1}
                }
            }
        ]
        
        duplicates = list(user_promo_collection.aggregate(pipeline))
        
        if not duplicates:
            logger.info("✅ No duplicates found")
            return True
        
        logger.info(f"⚠️ Found {len(duplicates)} duplicate groups")
        
        removed_count = 0
        for dup_group in duplicates:
            docs = dup_group['docs']
            # Keep the first one, remove the rest
            docs_to_remove = docs[1:]  # All except first
            
            for doc in docs_to_remove:
                user_promo_collection.delete_one({'_id': doc['_id']})
                removed_count += 1
                logger.info(f"🗑️ Removed duplicate: User {doc['user_id']}, Code {doc['code']}")
        
        logger.info(f"✅ Removed {removed_count} duplicate entries")
        return True
        
    except Exception as e:
        logger.error(f"❌ Error removing duplicates: {str(e)}")
        return False


def run_fix():
    """Run all fixes"""
    logger.info("🚀 Starting duplicate promo code fix...")
    
    # Check database connection
    if not db_instance.is_connected():
        logger.error("❌ Database not connected")
        return False
    
    logger.info("📊 Database connected successfully")
    
    # Step 1: Remove existing duplicates
    logger.info("\n📋 Step 1: Removing duplicate entries...")
    if not remove_duplicate_entries():
        logger.error("❌ Failed to remove duplicates")
        return False
    
    # Step 2: Create unique index
    logger.info("\n📋 Step 2: Creating unique index...")
    if not create_unique_index():
        logger.error("❌ Failed to create index")
        return False
    
    logger.info(f"""
    ✅ Fix Complete!
    
    Summary:
    - Removed duplicate promo code applications
    - Created unique index to prevent future duplicates
    
    Now users cannot apply the same promo code multiple times!
    """)
    
    return True


if __name__ == "__main__":
    success = run_fix()
    if success:
        logger.info("✅ Fix completed successfully!")
    else:
        logger.error("❌ Fix failed!")
