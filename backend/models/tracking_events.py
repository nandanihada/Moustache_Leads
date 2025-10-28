"""
Tracking Events Model for Real-time Event Logging
Handles logging of all tracking events (clicks, completions, postbacks)
"""

from datetime import datetime
from bson import ObjectId
from database import db_instance
import logging
import uuid
from typing import Dict, List, Optional, Any

logger = logging.getLogger(__name__)

class TrackingEvents:
    def __init__(self):
        self.tracking_events_collection = db_instance.get_collection('tracking_events')
        self.offers_collection = db_instance.get_collection('offers')
        self.users_collection = db_instance.get_collection('users')
    
    def _check_db_connection(self):
        """Check if database is connected and usable"""
        if self.tracking_events_collection is None or not db_instance.is_connected():
            return False
        
        try:
            self.tracking_events_collection.find_one({}, {'_id': 1})
            return True
        except Exception:
            return False
    
    def log_event(self, event_type: str, offer_id: str, user_id: str = None, 
                  partner_id: str = None, metadata: Dict = None) -> Optional[str]:
        """
        Log a tracking event
        
        Args:
            event_type: 'click', 'completion', 'postback_sent', 'postback_failed'
            offer_id: Offer ID
            user_id: User/Affiliate ID (optional)
            partner_id: Partner ID (optional)
            metadata: Additional event data
        
        Returns:
            Event ID if successful, None if failed
        """
        if not self._check_db_connection():
            logger.warning("Database connection not available for event logging")
            return None
        
        try:
            event_doc = {
                'event_id': str(uuid.uuid4()),
                'event_type': event_type,
                'offer_id': offer_id,
                'user_id': user_id,
                'partner_id': partner_id,
                'metadata': metadata or {},
                'timestamp': datetime.utcnow(),
                'created_at': datetime.utcnow()
            }
            
            # Enrich with offer and user names for easier querying
            if offer_id:
                offer = self.offers_collection.find_one({'offer_id': offer_id})
                if offer:
                    event_doc['offer_name'] = offer.get('name', '')
                    event_doc['network'] = offer.get('network', '')
            
            if user_id:
                try:
                    user = self.users_collection.find_one({'_id': ObjectId(user_id)})
                    if user:
                        event_doc['username'] = user.get('username', '')
                        event_doc['user_role'] = user.get('role', '')
                except:
                    # Handle case where user_id might not be ObjectId format
                    user = self.users_collection.find_one({'user_id': user_id})
                    if user:
                        event_doc['username'] = user.get('username', '')
                        event_doc['user_role'] = user.get('role', '')
            
            result = self.tracking_events_collection.insert_one(event_doc)
            event_doc['_id'] = str(result.inserted_id)
            
            logger.info(f"Logged tracking event: {event_type} for offer {offer_id}")
            return event_doc['event_id']
            
        except Exception as e:
            logger.error(f"Error logging tracking event: {str(e)}")
            return None
    
    def log_click_event(self, offer_id: str, user_id: str, click_id: str, 
                       ip_address: str = None, user_agent: str = None, 
                       country: str = None, referer: str = None) -> Optional[str]:
        """Log a click event with detailed metadata"""
        metadata = {
            'click_id': click_id,
            'ip_address': ip_address,
            'user_agent': user_agent,
            'country': country,
            'referer': referer
        }
        return self.log_event('click', offer_id, user_id, metadata=metadata)
    
    def log_completion_event(self, offer_id: str, user_id: str, conversion_id: str,
                           payout: float, partner_id: str = None, 
                           external_transaction_id: str = None) -> Optional[str]:
        """Log an offer completion event"""
        metadata = {
            'conversion_id': conversion_id,
            'payout': payout,
            'external_transaction_id': external_transaction_id
        }
        return self.log_event('completion', offer_id, user_id, partner_id, metadata)
    
    def log_postback_event(self, event_type: str, offer_id: str, partner_id: str,
                          postback_url: str, response_code: int = None,
                          response_body: str = None, conversion_id: str = None) -> Optional[str]:
        """Log a postback event (sent or failed)"""
        metadata = {
            'postback_url': postback_url,
            'response_code': response_code,
            'response_body': response_body[:500] if response_body else None,  # Limit response body
            'conversion_id': conversion_id
        }
        return self.log_event(event_type, offer_id, partner_id=partner_id, metadata=metadata)
    
    def get_recent_events(self, limit: int = 100, event_type: str = None,
                         offer_id: str = None, user_id: str = None) -> List[Dict]:
        """
        Get recent tracking events with optional filtering
        
        Args:
            limit: Maximum number of events to return
            event_type: Filter by event type
            offer_id: Filter by offer ID
            user_id: Filter by user ID
        
        Returns:
            List of tracking events
        """
        if not self._check_db_connection():
            return []
        
        try:
            # Build filter
            filter_query = {}
            if event_type:
                filter_query['event_type'] = event_type
            if offer_id:
                filter_query['offer_id'] = offer_id
            if user_id:
                filter_query['user_id'] = user_id
            
            events = list(self.tracking_events_collection.find(
                filter_query,
                {
                    'event_id': 1, 'event_type': 1, 'offer_id': 1, 'offer_name': 1,
                    'user_id': 1, 'username': 1, 'partner_id': 1, 'metadata': 1,
                    'timestamp': 1, 'network': 1
                }
            ).sort('timestamp', -1).limit(limit))
            
            # Convert ObjectId to string
            for event in events:
                event['_id'] = str(event['_id'])
            
            return events
            
        except Exception as e:
            logger.error(f"Error getting recent events: {str(e)}")
            return []
    
    def get_events_by_offer(self, offer_id: str, limit: int = 50) -> List[Dict]:
        """Get all events for a specific offer"""
        return self.get_recent_events(limit=limit, offer_id=offer_id)
    
    def get_events_by_user(self, user_id: str, limit: int = 50) -> List[Dict]:
        """Get all events for a specific user"""
        return self.get_recent_events(limit=limit, user_id=user_id)
    
    def get_event_stats(self, hours: int = 24) -> Dict[str, Any]:
        """Get event statistics for the last N hours"""
        if not self._check_db_connection():
            return {}
        
        try:
            from datetime import timedelta
            
            start_time = datetime.utcnow() - timedelta(hours=hours)
            
            # Aggregate events by type
            pipeline = [
                {'$match': {'timestamp': {'$gte': start_time}}},
                {'$group': {
                    '_id': '$event_type',
                    'count': {'$sum': 1}
                }}
            ]
            
            event_counts = list(self.tracking_events_collection.aggregate(pipeline))
            
            # Convert to dictionary
            stats = {}
            for item in event_counts:
                stats[item['_id']] = item['count']
            
            # Add totals
            stats['total_events'] = sum(stats.values())
            stats['time_period_hours'] = hours
            
            return stats
            
        except Exception as e:
            logger.error(f"Error getting event stats: {str(e)}")
            return {}
    
    def cleanup_old_events(self, days_to_keep: int = 90) -> int:
        """
        Clean up old tracking events to manage database size
        
        Args:
            days_to_keep: Number of days to keep events
        
        Returns:
            Number of events deleted
        """
        if not self._check_db_connection():
            return 0
        
        try:
            from datetime import timedelta
            
            cutoff_date = datetime.utcnow() - timedelta(days=days_to_keep)
            
            result = self.tracking_events_collection.delete_many({
                'timestamp': {'$lt': cutoff_date}
            })
            
            deleted_count = result.deleted_count
            logger.info(f"Cleaned up {deleted_count} old tracking events")
            
            return deleted_count
            
        except Exception as e:
            logger.error(f"Error cleaning up old events: {str(e)}")
            return 0
