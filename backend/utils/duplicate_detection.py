"""
Duplicate Detection Utility
Checks if an offer already exists in the database
"""

import logging
from typing import Optional, Tuple
from difflib import SequenceMatcher

logger = logging.getLogger(__name__)


class DuplicateDetector:
    """Detects duplicate offers in the database"""
    
    def __init__(self, db_instance):
        """
        Initialize with database instance
        
        Args:
            db_instance: Database instance (MongoDB connection)
        """
        self.db_instance = db_instance
        self.similarity_threshold = 0.85  # 85% similarity for fuzzy matching
    
    def check_duplicate(self, offer_data: dict, strategy: str = 'skip') -> Tuple[bool, Optional[str], Optional[dict]]:
        """
        Check if offer is a duplicate
        
        Args:
            offer_data: Offer data to check
            strategy: What to do with duplicates ('skip', 'update', 'create_new')
            
        Returns:
            Tuple of (is_duplicate, duplicate_offer_id, existing_offer)
        """
        try:
            # Strategy 1: Check by campaign_id (fastest and most accurate)
            campaign_id = offer_data.get('campaign_id')
            if campaign_id:
                existing = self._check_by_campaign_id(campaign_id)
                if existing:
                    logger.info(f"Duplicate found by campaign_id: {campaign_id}")
                    return True, existing['offer_id'], existing
            
            # Strategy 2: Check by name + network (fuzzy match)
            name = offer_data.get('name')
            network = offer_data.get('network')
            if name and network:
                existing = self._check_by_name_network(name, network)
                if existing:
                    logger.info(f"Duplicate found by name+network: {name}")
                    return True, existing['offer_id'], existing
            
            # Strategy 3: Check by target URL
            target_url = offer_data.get('target_url')
            if target_url:
                existing = self._check_by_url(target_url)
                if existing:
                    logger.info(f"Duplicate found by URL: {target_url}")
                    return True, existing['offer_id'], existing
            
            # No duplicate found
            return False, None, None
            
        except Exception as e:
            logger.error(f"Error checking duplicate: {str(e)}", exc_info=True)
            return False, None, None
    
    def _check_by_campaign_id(self, campaign_id: str) -> Optional[dict]:
        """Check for duplicate by campaign_id"""
        try:
            offers_collection = self.db_instance.get_collection('offers')
            return offers_collection.find_one({'campaign_id': campaign_id})
        except Exception as e:
            logger.error(f"Error checking by campaign_id: {str(e)}")
            return None
    
    def _check_by_name_network(self, name: str, network: str) -> Optional[dict]:
        """Check for duplicate by name and network (fuzzy match)"""
        try:
            offers_collection = self.db_instance.get_collection('offers')
            
            # First try exact match
            exact_match = offers_collection.find_one({
                'name': name,
                'network': network
            })
            if exact_match:
                return exact_match
            
            # Try fuzzy match - get all offers from same network
            similar_offers = offers_collection.find({'network': network})
            
            for offer in similar_offers:
                similarity = self._calculate_similarity(name, offer.get('name', ''))
                if similarity >= self.similarity_threshold:
                    logger.info(f"Fuzzy match found: {similarity:.2%} similarity")
                    return offer
            
            return None
            
        except Exception as e:
            logger.error(f"Error checking by name+network: {str(e)}")
            return None
    
    def _check_by_url(self, target_url: str) -> Optional[dict]:
        """Check for duplicate by target URL"""
        try:
            offers_collection = self.db_instance.get_collection('offers')
            
            # Clean URL for comparison (remove query params)
            clean_url = target_url.split('?')[0]
            
            # Try exact match
            return offers_collection.find_one({'target_url': {'$regex': f'^{clean_url}'}})
            
        except Exception as e:
            logger.error(f"Error checking by URL: {str(e)}")
            return None
    
    def _calculate_similarity(self, str1: str, str2: str) -> float:
        """Calculate similarity between two strings"""
        return SequenceMatcher(None, str1.lower(), str2.lower()).ratio()
    
    def handle_duplicate(self, offer_data: dict, existing_offer: dict, strategy: str = 'skip') -> Tuple[str, Optional[str]]:
        """
        Handle duplicate offer based on strategy
        
        Args:
            offer_data: New offer data
            existing_offer: Existing offer in database
            strategy: 'skip', 'update', or 'create_new'
            
        Returns:
            Tuple of (action_taken, offer_id)
        """
        try:
            if strategy == 'skip':
                return 'skipped', existing_offer['offer_id']
            
            elif strategy == 'update':
                # Update existing offer with new data
                offer_id = existing_offer['offer_id']
                offers_collection = self.db_instance.get_collection('offers')
                offers_collection.update_one(
                    {'offer_id': offer_id},
                    {'$set': offer_data}
                )
                logger.info(f"Updated existing offer: {offer_id}")
                return 'updated', offer_id
            
            elif strategy == 'create_new':
                # Create new offer with modified name
                offer_data['name'] = f"{offer_data['name']} (2)"
                # Will be created by the caller
                return 'create_new', None
            
            else:
                logger.warning(f"Unknown strategy: {strategy}, defaulting to skip")
                return 'skipped', existing_offer['offer_id']
                
        except Exception as e:
            logger.error(f"Error handling duplicate: {str(e)}", exc_info=True)
            return 'error', None


def create_duplicate_detector(db_instance):
    """Factory function to create DuplicateDetector instance"""
    return DuplicateDetector(db_instance)
