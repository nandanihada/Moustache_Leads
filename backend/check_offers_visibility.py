"""
Check why only 6 offers are visible
"""

from database import db_instance
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def check_offers():
    """Check offer visibility issues"""
    try:
        offers_collection = db_instance.get_collection('offers')
        
        if offers_collection is None:
            logger.error("❌ Could not connect to database")
            return
        
        # Total offers
        total = offers_collection.count_documents({})
        logger.info(f"\n{'='*60}")
        logger.info(f"📊 TOTAL OFFERS IN DATABASE: {total}")
        logger.info(f"{'='*60}\n")
        
        # Check is_active field
        with_is_active_true = offers_collection.count_documents({'is_active': True})
        with_is_active_false = offers_collection.count_documents({'is_active': False})
        without_is_active = offers_collection.count_documents({'is_active': {'$exists': False}})
        
        logger.info("📋 is_active Field Status:")
        logger.info(f"   ✅ is_active: True  → {with_is_active_true} offers")
        logger.info(f"   ❌ is_active: False → {with_is_active_false} offers")
        logger.info(f"   ⚠️  Missing field    → {without_is_active} offers\n")
        
        # Check status field
        logger.info("📋 Status Field Distribution:")
        pipeline = [
            {'$group': {'_id': '$status', 'count': {'$sum': 1}}},
            {'$sort': {'count': -1}}
        ]
        status_counts = list(offers_collection.aggregate(pipeline))
        for item in status_counts:
            logger.info(f"   {item['_id']}: {item['count']} offers")
        
        # Check offers that should be visible (is_active: True AND status: active)
        visible_offers = offers_collection.count_documents({
            'is_active': True,
            'status': 'active'
        })
        logger.info(f"\n✅ OFFERS THAT SHOULD BE VISIBLE: {visible_offers}")
        
        # Check offers with capital Active
        capital_active = offers_collection.count_documents({
            'is_active': True,
            'status': 'Active'
        })
        if capital_active > 0:
            logger.info(f"\n⚠️  WARNING: {capital_active} offers have status='Active' (capital A)")
            logger.info("   These won't show because tracking checks for lowercase 'active'")
            logger.info("   Run fix_offer_status.py to fix this!")
        
        # Check offers without is_active field
        if without_is_active > 0:
            logger.info(f"\n⚠️  WARNING: {without_is_active} offers missing 'is_active' field")
            logger.info("   These won't show in admin panel or offerwall")
            logger.info("   Fixing now...")
            
            result = offers_collection.update_many(
                {'is_active': {'$exists': False}},
                {'$set': {'is_active': True}}
            )
            logger.info(f"   ✅ Fixed {result.modified_count} offers")
        
        # Sample some offers
        logger.info(f"\n📋 Sample Offers (first 10):")
        sample_offers = list(offers_collection.find({}).limit(10))
        for offer in sample_offers:
            logger.info(f"   {offer.get('offer_id')}: status={offer.get('status')}, is_active={offer.get('is_active')}, name={offer.get('name', 'N/A')[:30]}")
        
        logger.info(f"\n{'='*60}")
        logger.info("✅ ANALYSIS COMPLETE")
        logger.info(f"{'='*60}\n")
        
    except Exception as e:
        logger.error(f"❌ Error checking offers: {str(e)}", exc_info=True)

if __name__ == '__main__':
    check_offers()
