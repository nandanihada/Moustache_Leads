"""
Page Visits Model
Tracks user page visits and navigation patterns
"""

from database import db_instance
from datetime import datetime, timedelta
from bson import ObjectId
import logging

logger = logging.getLogger(__name__)

class PageVisit:
    def __init__(self):
        self.db = db_instance.get_db()
        self.collection = self.db['page_visits'] if self.db is not None else None
        
    def track_visit(self, visit_data):
        """Track a page visit"""
        try:
            if self.collection is None:
                logger.error("Database not connected")
                return None
            
            # Add timestamp
            visit_data['timestamp'] = datetime.utcnow()
            visit_data['created_at'] = datetime.utcnow()
            
            # Insert the visit
            result = self.collection.insert_one(visit_data)
            
            return str(result.inserted_id)
            
        except Exception as e:
            logger.error(f"Error tracking page visit: {str(e)}", exc_info=True)
            return None
    
    def get_session_visits(self, session_id, limit=10):
        """Get last N page visits for a session"""
        try:
            if self.collection is None:
                return []
            
            visits = list(self.collection.find({'session_id': session_id})
                         .sort('timestamp', -1)
                         .limit(limit))
            
            for visit in visits:
                visit['_id'] = str(visit['_id'])
                # Calculate time ago
                if 'timestamp' in visit:
                    time_diff = datetime.utcnow() - visit['timestamp']
                    visit['time_ago'] = self._format_time_ago(time_diff)
            
            return visits
            
        except Exception as e:
            logger.error(f"Error getting session visits: {str(e)}", exc_info=True)
            return []
    
    def get_user_visits(self, user_id, limit=50):
        """Get page visits for a user"""
        try:
            if self.collection is None:
                return []
            
            visits = list(self.collection.find({'user_id': user_id})
                         .sort('timestamp', -1)
                         .limit(limit))
            
            for visit in visits:
                visit['_id'] = str(visit['_id'])
                if 'timestamp' in visit:
                    time_diff = datetime.utcnow() - visit['timestamp']
                    visit['time_ago'] = self._format_time_ago(time_diff)
            
            return visits
            
        except Exception as e:
            logger.error(f"Error getting user visits: {str(e)}", exc_info=True)
            return []
    
    def update_time_spent(self, visit_id, time_spent):
        """Update time spent on a page"""
        try:
            if self.collection is None:
                return False
            
            result = self.collection.update_one(
                {'_id': ObjectId(visit_id)},
                {'$set': {'time_spent': time_spent}}
            )
            
            return result.modified_count > 0
            
        except Exception as e:
            logger.error(f"Error updating time spent: {str(e)}", exc_info=True)
            return False
    
    def get_popular_pages(self, start_date=None, end_date=None, limit=10):
        """Get most visited pages"""
        try:
            if self.collection is None:
                return []
            
            # Default to last 7 days
            if not start_date:
                start_date = datetime.utcnow() - timedelta(days=7)
            if not end_date:
                end_date = datetime.utcnow()
            
            pipeline = [
                {
                    '$match': {
                        'timestamp': {'$gte': start_date, '$lte': end_date}
                    }
                },
                {
                    '$group': {
                        '_id': '$page_url',
                        'count': {'$sum': 1},
                        'unique_users': {'$addToSet': '$user_id'}
                    }
                },
                {
                    '$project': {
                        'page_url': '$_id',
                        'count': 1,
                        'unique_users': {'$size': '$unique_users'}
                    }
                },
                {'$sort': {'count': -1}},
                {'$limit': limit}
            ]
            
            pages = list(self.collection.aggregate(pipeline))
            
            return pages
            
        except Exception as e:
            logger.error(f"Error getting popular pages: {str(e)}", exc_info=True)
            return []
    
    def get_user_journey(self, session_id):
        """Get complete user journey for a session"""
        try:
            if self.collection is None:
                return []
            
            visits = list(self.collection.find({'session_id': session_id})
                         .sort('timestamp', 1))
            
            journey = []
            for i, visit in enumerate(visits):
                visit['_id'] = str(visit['_id'])
                visit['step'] = i + 1
                
                # Calculate time on page
                if i < len(visits) - 1:
                    next_visit = visits[i + 1]
                    time_diff = (next_visit['timestamp'] - visit['timestamp']).total_seconds()
                    visit['time_on_page'] = time_diff
                
                journey.append(visit)
            
            return journey
            
        except Exception as e:
            logger.error(f"Error getting user journey: {str(e)}", exc_info=True)
            return []
    
    def detect_device_change(self, session_id):
        """Detect if device changed during session"""
        try:
            if self.collection is None:
                return False
            
            visits = list(self.collection.find({'session_id': session_id}))
            
            if len(visits) < 2:
                return False
            
            # Check for device changes
            devices = set()
            for visit in visits:
                device = visit.get('device', {})
                device_signature = f"{device.get('type')}_{device.get('os')}_{device.get('browser')}"
                devices.add(device_signature)
            
            return len(devices) > 1
            
        except Exception as e:
            logger.error(f"Error detecting device change: {str(e)}", exc_info=True)
            return False
    
    def get_referrer_stats(self, start_date=None, end_date=None):
        """Get referrer statistics"""
        try:
            if self.collection is None:
                return []
            
            # Default to last 7 days
            if not start_date:
                start_date = datetime.utcnow() - timedelta(days=7)
            if not end_date:
                end_date = datetime.utcnow()
            
            pipeline = [
                {
                    '$match': {
                        'timestamp': {'$gte': start_date, '$lte': end_date},
                        'referrer': {'$exists': True, '$ne': ''}
                    }
                },
                {
                    '$group': {
                        '_id': '$referrer',
                        'count': {'$sum': 1}
                    }
                },
                {'$sort': {'count': -1}},
                {'$limit': 20}
            ]
            
            referrers = list(self.collection.aggregate(pipeline))
            
            return referrers
            
        except Exception as e:
            logger.error(f"Error getting referrer stats: {str(e)}", exc_info=True)
            return []
    
    def get_utm_stats(self, start_date=None, end_date=None):
        """Get UTM parameter statistics"""
        try:
            if self.collection is None:
                return {}
            
            # Default to last 7 days
            if not start_date:
                start_date = datetime.utcnow() - timedelta(days=7)
            if not end_date:
                end_date = datetime.utcnow()
            
            query = {
                'timestamp': {'$gte': start_date, '$lte': end_date}
            }
            
            # UTM Source
            utm_sources = list(self.collection.aggregate([
                {'$match': {**query, 'utm_source': {'$exists': True, '$ne': ''}}},
                {'$group': {'_id': '$utm_source', 'count': {'$sum': 1}}},
                {'$sort': {'count': -1}}
            ]))
            
            # UTM Medium
            utm_mediums = list(self.collection.aggregate([
                {'$match': {**query, 'utm_medium': {'$exists': True, '$ne': ''}}},
                {'$group': {'_id': '$utm_medium', 'count': {'$sum': 1}}},
                {'$sort': {'count': -1}}
            ]))
            
            # UTM Campaign
            utm_campaigns = list(self.collection.aggregate([
                {'$match': {**query, 'utm_campaign': {'$exists': True, '$ne': ''}}},
                {'$group': {'_id': '$utm_campaign', 'count': {'$sum': 1}}},
                {'$sort': {'count': -1}}
            ]))
            
            return {
                'sources': utm_sources,
                'mediums': utm_mediums,
                'campaigns': utm_campaigns
            }
            
        except Exception as e:
            logger.error(f"Error getting UTM stats: {str(e)}", exc_info=True)
            return {}
    
    def _format_time_ago(self, time_diff):
        """Format time difference as human-readable string"""
        seconds = time_diff.total_seconds()
        
        if seconds < 60:
            return f"{int(seconds)} sec ago"
        elif seconds < 3600:
            return f"{int(seconds / 60)} min ago"
        elif seconds < 86400:
            return f"{int(seconds / 3600)} hr ago"
        else:
            return f"{int(seconds / 86400)} days ago"
    
    def cleanup_old_visits(self, days=90):
        """Clean up page visits older than N days"""
        try:
            if self.collection is None:
                return 0
            
            cutoff_date = datetime.utcnow() - timedelta(days=days)
            
            result = self.collection.delete_many({
                'timestamp': {'$lt': cutoff_date}
            })
            
            logger.info(f"Cleaned up {result.deleted_count} old page visits")
            return result.deleted_count
            
        except Exception as e:
            logger.error(f"Error cleaning up old visits: {str(e)}", exc_info=True)
            return 0
