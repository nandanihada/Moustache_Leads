"""
Utility to add default placeholder images to offers that don't have images
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import db_instance
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Default images by category (using Unsplash placeholder images)
DEFAULT_IMAGES = {
    'survey': 'https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?w=800&h=600&fit=crop',
    'app': 'https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=800&h=600&fit=crop',
    'game': 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=800&h=600&fit=crop',
    'video': 'https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?w=800&h=600&fit=crop',
    'shopping': 'https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=800&h=600&fit=crop',
    'signup': 'https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?w=800&h=600&fit=crop',
    'general': 'https://images.unsplash.com/photo-1557683316-973673baf926?w=800&h=600&fit=crop',
    'finance': 'https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?w=800&h=600&fit=crop',
    'health': 'https://images.unsplash.com/photo-1505751172876-fa1923c5c528?w=800&h=600&fit=crop',
    'education': 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=800&h=600&fit=crop',
    'travel': 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=800&h=600&fit=crop',
    'food': 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&h=600&fit=crop',
}

def add_default_images():
    """Add default images to offers that don't have images"""
    try:
        offers_collection = db_instance.get_collection('offers')
        
        if offers_collection is None:
            logger.error("Failed to get offers collection")
            return
        
        # Find offers without images
        query = {
            '$or': [
                {'image_url': {'$exists': False}},
                {'image_url': ''},
                {'image_url': None}
            ],
            'is_active': True
        }
        
        offers_without_images = list(offers_collection.find(query))
        
        logger.info(f"Found {len(offers_without_images)} offers without images")
        
        updated_count = 0
        
        for offer in offers_without_images:
            category = offer.get('category', 'general').lower()
            
            # Get default image for category
            default_image = DEFAULT_IMAGES.get(category, DEFAULT_IMAGES['general'])
            
            # Update offer with default image
            result = offers_collection.update_one(
                {'_id': offer['_id']},
                {'$set': {'image_url': default_image}}
            )
            
            if result.modified_count > 0:
                updated_count += 1
                logger.info(f"✅ Updated offer {offer.get('offer_id', offer['_id'])} with default image for category: {category}")
        
        logger.info(f"✅ Updated {updated_count} offers with default images")
        
    except Exception as e:
        logger.error(f"Error adding default images: {str(e)}", exc_info=True)

if __name__ == '__main__':
    logger.info("Starting to add default images to offers...")
    add_default_images()
    logger.info("Done!")
