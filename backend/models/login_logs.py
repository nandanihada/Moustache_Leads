"""
Login Logs Model
Tracks all login attempts (successful and failed) with comprehensive details
"""

from database import db_instance
from datetime import datetime, timedelta
from bson import ObjectId
import logging

logger = logging.getLogger(__name__)

class LoginLog:
    def __init__(self):
        self.db = db_instance.get_db()
        self.collection = self.db['login_logs'] if self.db is not None else None
        
    def create_log(self, log_data):
        """Create a new login log entry"""
        try:
            if self.collection is None:
                logger.error("Database not connected")
                return None
            
            # Ensure required fields
            required_fields = ['user_id', 'email', 'ip_address', 'status']
            for field in required_fields:
                if field not in log_data:
                    logger.error(f"Missing required field: {field}")
                    return None
            
            # Add timestamps
            log_data['created_at'] = datetime.utcnow()
            if 'login_time' not in log_data:
                log_data['login_time'] = datetime.utcnow()
            
            # Insert the log
            result = self.collection.insert_one(log_data)
            logger.info(f"Created login log for user {log_data['email']}: {result.inserted_id}")
            
            return str(result.inserted_id)
            
        except Exception as e:
            logger.error(f"Error creating login log: {str(e)}", exc_info=True)
            return None
    
    def update_logout(self, session_id, logout_time=None):
        """Update logout time for a session"""
        try:
            if self.collection is None:
                return False
            
            if logout_time is None:
                logout_time = datetime.utcnow()
            
            result = self.collection.update_one(
                {'session_id': session_id, 'logout_time': None},
                {'$set': {'logout_time': logout_time}}
            )
            
            return result.modified_count > 0
            
        except Exception as e:
            logger.error(f"Error updating logout time: {str(e)}", exc_info=True)
            return False
    
    def get_logs(self, filters=None, page=1, limit=100, sort_by='login_time', sort_order=-1):
        """Get login logs with filters and pagination"""
        try:
            if self.collection is None:
                return {'logs': [], 'total': 0, 'page': page, 'limit': limit}
            
            # Build query
            query = {}
            if filters:
                if 'user_id' in filters:
                    query['user_id'] = filters['user_id']
                if 'email' in filters:
                    query['email'] = {'$regex': filters['email'], '$options': 'i'}
                if 'status' in filters:
                    query['status'] = filters['status']
                if 'login_method' in filters:
                    query['login_method'] = filters['login_method']
                if 'start_date' in filters and 'end_date' in filters:
                    query['login_time'] = {
                        '$gte': filters['start_date'],
                        '$lte': filters['end_date']
                    }
                if 'ip_address' in filters:
                    query['ip_address'] = filters['ip_address']
            
            # Get total count
            total = self.collection.count_documents(query)
            
            # Get paginated results
            skip = (page - 1) * limit
            logs = list(self.collection.find(query)
                       .sort(sort_by, sort_order)
                       .skip(skip)
                       .limit(limit))
            
            # Convert ObjectId to string
            for log in logs:
                log['_id'] = str(log['_id'])
            
            return {
                'logs': logs,
                'total': total,
                'page': page,
                'limit': limit,
                'pages': (total + limit - 1) // limit
            }
            
        except Exception as e:
            logger.error(f"Error getting login logs: {str(e)}", exc_info=True)
            return {'logs': [], 'total': 0, 'page': page, 'limit': limit}
    
    def get_log_by_id(self, log_id):
        """Get a specific login log by ID"""
        try:
            if self.collection is None:
                return None
            
            log = self.collection.find_one({'_id': ObjectId(log_id)})
            if log:
                log['_id'] = str(log['_id'])
            return log
            
        except Exception as e:
            logger.error(f"Error getting login log: {str(e)}", exc_info=True)
            return None
    
    def get_user_login_history(self, user_id, limit=50):
        """Get login history for a specific user"""
        try:
            if self.collection is None:
                return []
            
            logs = list(self.collection.find({'user_id': user_id})
                       .sort('login_time', -1)
                       .limit(limit))
            
            for log in logs:
                log['_id'] = str(log['_id'])
            
            return logs
            
        except Exception as e:
            logger.error(f"Error getting user login history: {str(e)}", exc_info=True)
            return []
    
    def get_failed_login_attempts(self, user_id=None, hours=24):
        """Get failed login attempts in the last N hours"""
        try:
            if self.collection is None:
                return []
            
            since = datetime.utcnow() - timedelta(hours=hours)
            query = {
                'status': 'failed',
                'login_time': {'$gte': since}
            }
            
            if user_id:
                query['user_id'] = user_id
            
            attempts = list(self.collection.find(query)
                          .sort('login_time', -1))
            
            for attempt in attempts:
                attempt['_id'] = str(attempt['_id'])
            
            return attempts
            
        except Exception as e:
            logger.error(f"Error getting failed login attempts: {str(e)}", exc_info=True)
            return []
    
    def get_stats(self, start_date=None, end_date=None):
        """Get login statistics"""
        try:
            if self.collection is None:
                return {}
            
            # Default to last 30 days
            if not start_date:
                start_date = datetime.utcnow() - timedelta(days=30)
            if not end_date:
                end_date = datetime.utcnow()
            
            query = {
                'login_time': {'$gte': start_date, '$lte': end_date}
            }
            
            # Total logins
            total_logins = self.collection.count_documents(query)
            
            # Successful logins
            successful_logins = self.collection.count_documents({
                **query,
                'status': 'success'
            })
            
            # Failed logins
            failed_logins = self.collection.count_documents({
                **query,
                'status': 'failed'
            })
            
            # Unique users
            unique_users = len(self.collection.distinct('user_id', query))
            
            # Login methods breakdown
            login_methods = list(self.collection.aggregate([
                {'$match': query},
                {'$group': {
                    '_id': '$login_method',
                    'count': {'$sum': 1}
                }}
            ]))
            
            # Top locations
            top_locations = list(self.collection.aggregate([
                {'$match': query},
                {'$group': {
                    '_id': '$location.country',
                    'count': {'$sum': 1}
                }},
                {'$sort': {'count': -1}},
                {'$limit': 10}
            ]))
            
            # Top devices
            top_devices = list(self.collection.aggregate([
                {'$match': query},
                {'$group': {
                    '_id': '$device.type',
                    'count': {'$sum': 1}
                }},
                {'$sort': {'count': -1}}
            ]))
            
            return {
                'total_logins': total_logins,
                'successful_logins': successful_logins,
                'failed_logins': failed_logins,
                'success_rate': (successful_logins / total_logins * 100) if total_logins > 0 else 0,
                'unique_users': unique_users,
                'login_methods': login_methods,
                'top_locations': top_locations,
                'top_devices': top_devices,
                'date_range': {
                    'start': start_date.isoformat(),
                    'end': end_date.isoformat()
                }
            }
            
        except Exception as e:
            logger.error(f"Error getting login stats: {str(e)}", exc_info=True)
            return {}
    
    def check_suspicious_activity(self, user_id, hours=1):
        """Check for suspicious login activity"""
        try:
            if self.collection is None:
                return False
            
            since = datetime.utcnow() - timedelta(hours=hours)
            
            # Check for multiple failed attempts
            failed_attempts = self.collection.count_documents({
                'user_id': user_id,
                'status': 'failed',
                'login_time': {'$gte': since}
            })
            
            if failed_attempts >= 5:
                return True
            
            # Check for logins from different IPs
            recent_logins = list(self.collection.find({
                'user_id': user_id,
                'login_time': {'$gte': since}
            }))
            
            unique_ips = set(log.get('ip_address') for log in recent_logins)
            if len(unique_ips) >= 3:
                return True
            
            # Check for logins from different countries
            unique_countries = set(
                log.get('location', {}).get('country') 
                for log in recent_logins 
                if log.get('location', {}).get('country')
            )
            if len(unique_countries) >= 2:
                return True
            
            return False
            
        except Exception as e:
            logger.error(f"Error checking suspicious activity: {str(e)}", exc_info=True)
            return False
    
    def calculate_device_fingerprint(self, device_info):
        """
        Calculate device fingerprint from device information
        
        Args:
            device_info: Dict with device type, os, browser, etc.
        
        Returns:
            str: Device fingerprint hash
        """
        try:
            import hashlib
            
            # Create fingerprint from device characteristics
            fingerprint_data = f"{device_info.get('type', '')}|" \
                             f"{device_info.get('os', '')}|" \
                             f"{device_info.get('browser', '')}|" \
                             f"{device_info.get('version', '')}"
            
            # Create hash
            fingerprint = hashlib.md5(fingerprint_data.encode()).hexdigest()
            
            return fingerprint
            
        except Exception as e:
            logger.error(f"Error calculating device fingerprint: {e}")
            return "unknown"
    
    def check_device_change(self, user_id, device_fingerprint):
        """
        Check if user is logging in from a different device
        
        Args:
            user_id: User ID
            device_fingerprint: Current device fingerprint
        
        Returns:
            bool: True if device changed, False otherwise
        """
        try:
            if self.collection is None:
                return False
            
            # Get most recent successful login
            recent_login = self.collection.find_one(
                {
                    'user_id': user_id,
                    'status': 'success',
                    'device_fingerprint': {'$exists': True}
                },
                sort=[('login_time', -1)]
            )
            
            if not recent_login:
                # First login or no previous fingerprint
                return False
            
            previous_fingerprint = recent_login.get('device_fingerprint')
            
            # Compare fingerprints
            if previous_fingerprint and previous_fingerprint != device_fingerprint:
                logger.info(f"🔄 Device change detected for user {user_id}")
                return True
            
            return False
            
        except Exception as e:
            logger.error(f"Error checking device change: {e}", exc_info=True)
            return False
    
    def calculate_session_frequency(self, user_id):
        """
        Calculate login frequency for fraud detection
        
        Args:
            user_id: User ID
        
        Returns:
            dict: {
                'logins_last_hour': int,
                'logins_last_day': int,
                'risk_level': str  # 'low', 'medium', 'high'
            }
        """
        try:
            if self.collection is None:
                return {
                    'logins_last_hour': 0,
                    'logins_last_day': 0,
                    'risk_level': 'low'
                }
            
            now = datetime.utcnow()
            one_hour_ago = now - timedelta(hours=1)
            one_day_ago = now - timedelta(days=1)
            
            # Count logins in last hour
            logins_last_hour = self.collection.count_documents({
                'user_id': user_id,
                'login_time': {'$gte': one_hour_ago},
                'status': 'success'
            })
            
            # Count logins in last day
            logins_last_day = self.collection.count_documents({
                'user_id': user_id,
                'login_time': {'$gte': one_day_ago},
                'status': 'success'
            })
            
            # Determine risk level based on thresholds
            # Thresholds: 3+ logins/hour = low, 5+ = medium, 10+ = high
            if logins_last_hour >= 10:
                risk_level = 'high'
            elif logins_last_hour >= 5:
                risk_level = 'medium'
            elif logins_last_hour >= 3:
                risk_level = 'low'
            else:
                risk_level = 'low'
            
            logger.info(f"📊 Session frequency for user {user_id}: {logins_last_hour}/hour, risk={risk_level}")
            
            return {
                'logins_last_hour': logins_last_hour,
                'logins_last_day': logins_last_day,
                'risk_level': risk_level
            }
            
        except Exception as e:
            logger.error(f"Error calculating session frequency: {e}", exc_info=True)
            return {
                'logins_last_hour': 0,
                'logins_last_day': 0,
                'risk_level': 'low'
            }
