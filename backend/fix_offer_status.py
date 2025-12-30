"""
Fix offer status capitalization in database
Run this script to fix existing offers with capital letter status
"""

from database import db_instance
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def fix_offer_status():
    """Fix status capitalization for all offers"""
    try:
        offers_collection = db_instance.get_collection('offers')
        
        if offers_collection is None:
            logger.error("❌ Could not connect to database")
            return
        
        # Count offers before fix
        total_offers = offers_collection.count_documents({})
        logger.info(f"📊 Total offers in database: {total_offers}")
        
        # Fix Active -> active
        result1 = offers_collection.update_many(
            {'status': 'Active'},
            {'$set': {'status': 'active'}}
        )
        logger.info(f"✅ Fixed {result1.modified_count} offers: Active -> active")
        
        # Fix Pending -> pending
        result2 = offers_collection.update_many(
            {'status': 'Pending'},
            {'$set': {'status': 'pending'}}
        )
        logger.info(f"✅ Fixed {result2.modified_count} offers: Pending -> pending")
        
        # Fix Inactive -> inactive
        result3 = offers_collection.update_many(
            {'status': 'Inactive'},
            {'$set': {'status': 'inactive'}}
        )
        logger.info(f"✅ Fixed {result3.modified_count} offers: Inactive -> inactive")
        
        # Fix Paused -> paused
        result4 = offers_collection.update_many(
            {'status': 'Paused'},
            {'$set': {'status': 'paused'}}
        )
        logger.info(f"✅ Fixed {result4.modified_count} offers: Paused -> paused")
        
        # Fix Hidden -> hidden
        result5 = offers_collection.update_many(
            {'status': 'Hidden'},
            {'$set': {'status': 'hidden'}}
        )
        logger.info(f"✅ Fixed {result5.modified_count} offers: Hidden -> hidden")
        
        total_fixed = (result1.modified_count + result2.modified_count + 
                      result3.modified_count + result4.modified_count + 
                      result5.modified_count)
        
        logger.info(f"\n{'='*60}")
        logger.info(f"✅ COMPLETE: Fixed {total_fixed} offers total")
        logger.info(f"{'='*60}\n")
        
        # Show current status distribution
        logger.info("📊 Current status distribution:")
        pipeline = [
            {'$group': {'_id': '$status', 'count': {'$sum': 1}}},
            {'$sort': {'count': -1}}
        ]
        status_counts = list(offers_collection.aggregate(pipeline))
        for item in status_counts:
            logger.info(f"   {item['_id']}: {item['count']} offers")
        
    except Exception as e:
        logger.error(f"❌ Error fixing offer status: {str(e)}", exc_info=True)

if __name__ == '__main__':
    print("\n" + "="*60)
    print("🔧 FIXING OFFER STATUS CAPITALIZATION")
    print("="*60 + "\n")
    
    fix_offer_status()
    
    print("\n" + "="*60)
    print("✅ DONE! You can now test your tracking links")
    print("="*60 + "\n")
