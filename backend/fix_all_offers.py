"""
Comprehensive fix for all offer visibility issues
Run this to fix all offers in the database
"""

from database import db_instance
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def fix_all_offers():
    """Fix all offer issues"""
    try:
        offers_collection = db_instance.get_collection('offers')
        
        if offers_collection is None:
            logger.error("❌ Could not connect to database")
            return
        
        logger.info("\n" + "="*70)
        logger.info("🔧 COMPREHENSIVE OFFER FIX")
        logger.info("="*70 + "\n")
        
        # 1. Count total offers
        total = offers_collection.count_documents({})
        logger.info(f"📊 Total offers in database: {total}\n")
        
        # 2. Fix status capitalization
        logger.info("🔧 Fixing status capitalization...")
        status_fixes = {
            'Active': 'active',
            'Pending': 'pending',
            'Inactive': 'inactive',
            'Paused': 'paused',
            'Hidden': 'hidden'
        }
        
        total_status_fixed = 0
        for old_status, new_status in status_fixes.items():
            result = offers_collection.update_many(
                {'status': old_status},
                {'$set': {'status': new_status}}
            )
            if result.modified_count > 0:
                logger.info(f"   ✅ Fixed {result.modified_count} offers: {old_status} → {new_status}")
                total_status_fixed += result.modified_count
        
        if total_status_fixed == 0:
            logger.info("   ✅ No status capitalization issues found")
        else:
            logger.info(f"   ✅ Total status fixes: {total_status_fixed}\n")
        
        # 3. Fix missing is_active field
        logger.info("🔧 Fixing missing is_active field...")
        result = offers_collection.update_many(
            {'is_active': {'$exists': False}},
            {'$set': {'is_active': True}}
        )
        if result.modified_count > 0:
            logger.info(f"   ✅ Added is_active=True to {result.modified_count} offers\n")
        else:
            logger.info("   ✅ All offers have is_active field\n")
        
        # 4. Fix offers with is_active=False (set to True if status is active)
        logger.info("🔧 Fixing is_active=False for active offers...")
        result = offers_collection.update_many(
            {'is_active': False, 'status': 'active'},
            {'$set': {'is_active': True}}
        )
        if result.modified_count > 0:
            logger.info(f"   ✅ Fixed {result.modified_count} active offers with is_active=False\n")
        else:
            logger.info("   ✅ No active offers with is_active=False\n")
        
        # 5. Show current status
        logger.info("="*70)
        logger.info("📊 CURRENT STATUS")
        logger.info("="*70 + "\n")
        
        # Count by status
        logger.info("Status Distribution:")
        pipeline = [
            {'$group': {'_id': '$status', 'count': {'$sum': 1}}},
            {'$sort': {'count': -1}}
        ]
        status_counts = list(offers_collection.aggregate(pipeline))
        for item in status_counts:
            logger.info(f"   {item['_id']}: {item['count']} offers")
        
        # Count by is_active
        logger.info("\nis_active Distribution:")
        active_true = offers_collection.count_documents({'is_active': True})
        active_false = offers_collection.count_documents({'is_active': False})
        logger.info(f"   True: {active_true} offers")
        logger.info(f"   False: {active_false} offers")
        
        # Count visible offers
        visible = offers_collection.count_documents({
            'is_active': True,
            'status': 'active'
        })
        logger.info(f"\n✅ VISIBLE OFFERS (is_active=True AND status='active'): {visible}")
        
        # Show sample offers
        logger.info(f"\n📋 Sample Offers (first 10):")
        sample = list(offers_collection.find({}).limit(10))
        for offer in sample:
            logger.info(f"   {offer.get('offer_id')}: status={offer.get('status')}, is_active={offer.get('is_active')}, name={offer.get('name', 'N/A')[:40]}")
        
        logger.info("\n" + "="*70)
        logger.info("✅ FIX COMPLETE!")
        logger.info("="*70)
        logger.info(f"\n🎯 Result: {visible} offers should now be visible")
        logger.info("   - Admin panel: All {visible} offers")
        logger.info("   - Offerwall: All {visible} offers")
        logger.info("   - User dashboard: All {visible} offers\n")
        
    except Exception as e:
        logger.error(f"❌ Error fixing offers: {str(e)}", exc_info=True)

if __name__ == '__main__':
    fix_all_offers()
