"""
Payout Calculation Logger Service
Logs all percentage-based payout calculations for auditing and debugging
"""

from database import db_instance
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

class PayoutCalculationLogger:
    """Service to log payout calculations"""
    
    def __init__(self):
        self.collection_name = 'payout_calculations'
    
    def log_calculation(self, calculation_data):
        """
        Log a payout calculation
        
        Args:
            calculation_data: dict with keys:
                - offer_id: Offer ID
                - upward_payout: Amount received from upstream
                - revenue_share_percent: Percentage to share
                - downward_payout: Calculated amount to send downstream
                - is_percentage: Boolean indicating if percentage-based
                - calculation_method: Description of calculation
                - click_id: Associated click ID (optional)
                - user_id: User who completed the offer (optional)
                - publisher_id: Publisher receiving the payout (optional)
                - rounding_applied: Boolean if rounding was applied
                - original_amount: Amount before rounding (optional)
        
        Returns:
            str: Log ID if successful, None if failed
        """
        try:
            if not db_instance.is_connected():
                logger.error("Database not connected")
                return None
            
            collection = db_instance.get_collection(self.collection_name)
            if collection is None:
                logger.error(f"Could not access {self.collection_name} collection")
                return None
            
            # Prepare log document
            log_doc = {
                'timestamp': datetime.utcnow(),
                'offer_id': calculation_data.get('offer_id'),
                'upward_payout': float(calculation_data.get('upward_payout', 0)),
                'revenue_share_percent': float(calculation_data.get('revenue_share_percent', 0)),
                'downward_payout': float(calculation_data.get('downward_payout', 0)),
                'is_percentage': calculation_data.get('is_percentage', False),
                'calculation_method': calculation_data.get('calculation_method', 'Unknown'),
                'click_id': calculation_data.get('click_id'),
                'user_id': calculation_data.get('user_id'),
                'publisher_id': calculation_data.get('publisher_id'),
                'rounding_applied': calculation_data.get('rounding_applied', True),
                'original_amount': calculation_data.get('original_amount'),
                'metadata': calculation_data.get('metadata', {})
            }
            
            # Insert log
            result = collection.insert_one(log_doc)
            
            logger.info(f"✅ Logged payout calculation: {result.inserted_id}")
            logger.debug(f"   Offer: {log_doc['offer_id']}")
            logger.debug(f"   Upward: ${log_doc['upward_payout']:.2f}")
            logger.debug(f"   Method: {log_doc['calculation_method']}")
            logger.debug(f"   Downward: ${log_doc['downward_payout']:.2f}")
            
            return str(result.inserted_id)
            
        except Exception as e:
            logger.error(f"❌ Error logging payout calculation: {e}", exc_info=True)
            return None
    
    def get_calculations(self, filters=None, limit=100, skip=0):
        """
        Get payout calculation logs
        
        Args:
            filters: dict of filters (offer_id, publisher_id, etc.)
            limit: Maximum number of records to return
            skip: Number of records to skip
        
        Returns:
            list: List of calculation logs
        """
        try:
            if not db_instance.is_connected():
                return []
            
            collection = db_instance.get_collection(self.collection_name)
            if collection is None:
                return []
            
            query = filters or {}
            
            logs = list(collection.find(query)
                       .sort('timestamp', -1)
                       .skip(skip)
                       .limit(limit))
            
            # Convert ObjectId to string
            for log in logs:
                log['_id'] = str(log['_id'])
            
            return logs
            
        except Exception as e:
            logger.error(f"❌ Error getting payout calculations: {e}")
            return []
    
    def get_statistics(self, offer_id=None):
        """
        Get statistics for payout calculations
        
        Args:
            offer_id: Optional offer ID to filter by
        
        Returns:
            dict: Statistics including total calculations, total upward, total downward, etc.
        """
        try:
            if not db_instance.is_connected():
                return {}
            
            collection = db_instance.get_collection(self.collection_name)
            if collection is None:
                return {}
            
            match_stage = {}
            if offer_id:
                match_stage = {'offer_id': offer_id}
            
            pipeline = [
                {'$match': match_stage},
                {'$group': {
                    '_id': None,
                    'total_calculations': {'$sum': 1},
                    'total_upward': {'$sum': '$upward_payout'},
                    'total_downward': {'$sum': '$downward_payout'},
                    'avg_revenue_share': {'$avg': '$revenue_share_percent'},
                    'percentage_based_count': {
                        '$sum': {'$cond': ['$is_percentage', 1, 0]}
                    },
                    'fixed_based_count': {
                        '$sum': {'$cond': ['$is_percentage', 0, 1]}
                    }
                }}
            ]
            
            result = list(collection.aggregate(pipeline))
            
            if result:
                stats = result[0]
                stats.pop('_id', None)
                return stats
            
            return {
                'total_calculations': 0,
                'total_upward': 0,
                'total_downward': 0,
                'avg_revenue_share': 0,
                'percentage_based_count': 0,
                'fixed_based_count': 0
            }
            
        except Exception as e:
            logger.error(f"❌ Error getting payout statistics: {e}")
            return {}


# Global instance
payout_logger = PayoutCalculationLogger()
