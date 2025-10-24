from datetime import datetime
from bson import ObjectId
from database import db_instance
import logging

logger = logging.getLogger(__name__)


class Tracking:
    def __init__(self):
        self.impressions_collection = db_instance.get_collection('impressions')
        self.clicks_collection = db_instance.get_collection('clicks')
    
    def _check_db_connection(self):
        """Check if database is connected and usable"""
        if self.impressions_collection is None or not db_instance.is_connected():
            return False
        
        try:
            self.impressions_collection.find_one({}, {'_id': 1})
            return True
        except Exception:
            return False
    
    def track_impression(self, placement_id, user_id, user_ip=None, user_agent=None):
        """Track offerwall impression"""
        if not self._check_db_connection():
            return False, "Database connection not available"
        
        try:
            impression_doc = {
                'placementId': placement_id,
                'userId': user_id,
                'userIp': user_ip,
                'userAgent': user_agent,
                'timestamp': datetime.utcnow(),
                'createdAt': datetime.utcnow()
            }
            
            result = self.impressions_collection.insert_one(impression_doc)
            return str(result.inserted_id), None
            
        except Exception as e:
            logger.error(f"Error tracking impression: {e}")
            return None, f"Error tracking impression: {str(e)}"
    
    def track_click(self, placement_id, user_id, offer_id, offer_name=None, user_ip=None, user_agent=None):
        """Track offer click"""
        if not self._check_db_connection():
            return False, "Database connection not available"
        
        try:
            click_doc = {
                'placementId': placement_id,
                'userId': user_id,
                'offerId': offer_id,
                'offerName': offer_name,
                'userIp': user_ip,
                'userAgent': user_agent,
                'timestamp': datetime.utcnow(),
                'createdAt': datetime.utcnow()
            }
            
            result = self.clicks_collection.insert_one(click_doc)
            return str(result.inserted_id), None
            
        except Exception as e:
            logger.error(f"Error tracking click: {e}")
            return None, f"Error tracking click: {str(e)}"
    
    def get_placement_stats(self, placement_id, start_date=None, end_date=None):
        """Get impression and click stats for a placement"""
        if not self._check_db_connection():
            return None, "Database connection not available"
        
        try:
            # Build date filter
            date_filter = {'placementId': placement_id}
            if start_date or end_date:
                date_filter['timestamp'] = {}
                if start_date:
                    date_filter['timestamp']['$gte'] = start_date
                if end_date:
                    date_filter['timestamp']['$lte'] = end_date
            
            # Count impressions and clicks
            impressions = self.impressions_collection.count_documents(date_filter)
            clicks = self.clicks_collection.count_documents(date_filter)
            
            # Calculate CTR
            ctr = (clicks / impressions * 100) if impressions > 0 else 0
            
            return {
                'impressions': impressions,
                'clicks': clicks,
                'ctr': round(ctr, 2)
            }, None
            
        except Exception as e:
            logger.error(f"Error getting placement stats: {e}")
            return None, f"Error getting placement stats: {str(e)}"
