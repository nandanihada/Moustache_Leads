"""
Active Sessions Model
Tracks currently active user sessions in real-time
"""

from database import db_instance
from datetime import datetime, timedelta
from bson import ObjectId
import logging

logger = logging.getLogger(__name__)

class ActiveSession:
    def __init__(self):
        self.db = db_instance.get_db()
        self.collection = self.db['active_sessions'] if self.db is not None else None
        
    def create_session(self, session_data):
        """Create a new active session"""
        try:
            if self.collection is None:
                logger.error("Database not connected")
                return None
            
            # Add timestamps
            session_data['login_time'] = datetime.utcnow()
            session_data['last_activity'] = datetime.utcnow()
            session_data['updated_at'] = datetime.utcnow()
            session_data['is_active'] = True
            session_data['idle_time'] = 0
            session_data['activity_level'] = 'active'
            
            # Insert the session
            result = self.collection.insert_one(session_data)
            logger.info(f"Created active session for user {session_data.get('email')}: {result.inserted_id}")
            
            return str(result.inserted_id)
            
        except Exception as e:
            logger.error(f"Error creating active session: {str(e)}", exc_info=True)
            return None
    
    def update_heartbeat(self, session_id, current_page=None, ip_address=None):
        """Update session heartbeat (last activity)"""
        try:
            if self.collection is None:
                return False
            
            update_data = {
                'last_activity': datetime.utcnow(),
                'updated_at': datetime.utcnow(),
                'idle_time': 0,
                'is_active': True
            }
            
            if current_page:
                update_data['current_page'] = current_page
            
            if ip_address:
                update_data['ip_address'] = ip_address
            
            result = self.collection.update_one(
                {'session_id': session_id},
                {'$set': update_data}
            )
            
            return result.modified_count > 0
            
        except Exception as e:
            logger.error(f"Error updating heartbeat: {str(e)}", exc_info=True)
            return False
    
    def end_session(self, session_id):
        """End an active session"""
        try:
            if self.collection is None:
                return False
            
            result = self.collection.update_one(
                {'session_id': session_id},
                {
                    '$set': {
                        'is_active': False,
                        'updated_at': datetime.utcnow()
                    }
                }
            )
            
            return result.modified_count > 0
            
        except Exception as e:
            logger.error(f"Error ending session: {str(e)}", exc_info=True)
            return False
    
    def get_active_sessions(self, include_idle=True):
        """Get all currently active sessions"""
        try:
            if self.collection is None:
                return []
            
            query = {'is_active': True}
            
            sessions = list(self.collection.find(query).sort('last_activity', -1))
            
            # Calculate idle time and activity level for each session
            for session in sessions:
                session['_id'] = str(session['_id'])
                
                # Calculate idle time
                if 'last_activity' in session:
                    idle_seconds = (datetime.utcnow() - session['last_activity']).total_seconds()
                    session['idle_time'] = int(idle_seconds)
                    session['idle_time_formatted'] = self._format_idle_time(idle_seconds)
                    
                    # Update activity level
                    session['activity_level'] = self._calculate_activity_level(session)
            
            # Filter out idle sessions if requested
            if not include_idle:
                sessions = [s for s in sessions if s.get('activity_level') != 'idle']
            
            return sessions
            
        except Exception as e:
            logger.error(f"Error getting active sessions: {str(e)}", exc_info=True)
            return []
    
    def get_session(self, session_id):
        """Get a specific session"""
        try:
            if self.collection is None:
                return None
            
            session = self.collection.find_one({'session_id': session_id})
            
            if session:
                session['_id'] = str(session['_id'])
                
                # Calculate idle time
                if 'last_activity' in session:
                    idle_seconds = (datetime.utcnow() - session['last_activity']).total_seconds()
                    session['idle_time'] = int(idle_seconds)
                    session['idle_time_formatted'] = self._format_idle_time(idle_seconds)
                    session['activity_level'] = self._calculate_activity_level(session)
            
            return session
            
        except Exception as e:
            logger.error(f"Error getting session: {str(e)}", exc_info=True)
            return None
    
    def get_user_sessions(self, user_id):
        """Get all active sessions for a user"""
        try:
            if self.collection is None:
                return []
            
            sessions = list(self.collection.find({
                'user_id': user_id,
                'is_active': True
            }).sort('last_activity', -1))
            
            for session in sessions:
                session['_id'] = str(session['_id'])
                if 'last_activity' in session:
                    idle_seconds = (datetime.utcnow() - session['last_activity']).total_seconds()
                    session['idle_time'] = int(idle_seconds)
                    session['idle_time_formatted'] = self._format_idle_time(idle_seconds)
                    session['activity_level'] = self._calculate_activity_level(session)
            
            return sessions
            
        except Exception as e:
            logger.error(f"Error getting user sessions: {str(e)}", exc_info=True)
            return []
    
    def cleanup_stale_sessions(self, hours=24):
        """Mark sessions as inactive if no activity for N hours"""
        try:
            if self.collection is None:
                return 0
            
            cutoff_time = datetime.utcnow() - timedelta(hours=hours)
            
            result = self.collection.update_many(
                {
                    'is_active': True,
                    'last_activity': {'$lt': cutoff_time}
                },
                {
                    '$set': {
                        'is_active': False,
                        'updated_at': datetime.utcnow()
                    }
                }
            )
            
            logger.info(f"Cleaned up {result.modified_count} stale sessions")
            return result.modified_count
            
        except Exception as e:
            logger.error(f"Error cleaning up stale sessions: {str(e)}", exc_info=True)
            return 0
    
    def get_session_count(self):
        """Get count of active sessions"""
        try:
            if self.collection is None:
                return 0
            
            return self.collection.count_documents({'is_active': True})
            
        except Exception as e:
            logger.error(f"Error getting session count: {str(e)}", exc_info=True)
            return 0
    
    def get_stats(self):
        """Get session statistics"""
        try:
            if self.collection is None:
                return {}
            
            active_sessions = list(self.collection.find({'is_active': True}))
            
            total_active = len(active_sessions)
            
            # Count by activity level
            activity_levels = {
                'active': 0,
                'normal': 0,
                'idle': 0,
                'suspicious': 0
            }
            
            for session in active_sessions:
                level = self._calculate_activity_level(session)
                activity_levels[level] = activity_levels.get(level, 0) + 1
            
            # Unique users
            unique_users = len(set(s.get('user_id') for s in active_sessions))
            
            # Average session duration
            total_duration = 0
            for session in active_sessions:
                if 'login_time' in session:
                    duration = (datetime.utcnow() - session['login_time']).total_seconds()
                    total_duration += duration
            
            avg_duration = total_duration / total_active if total_active > 0 else 0
            
            return {
                'total_active_sessions': total_active,
                'unique_active_users': unique_users,
                'activity_levels': activity_levels,
                'average_session_duration': avg_duration,
                'average_session_duration_formatted': self._format_idle_time(avg_duration)
            }
            
        except Exception as e:
            logger.error(f"Error getting session stats: {str(e)}", exc_info=True)
            return {}
    
    def _calculate_activity_level(self, session):
        """Calculate activity level based on session data"""
        try:
            # Check for suspicious activity flag
            if session.get('is_suspicious', False):
                return 'suspicious'
            
            # Calculate idle time
            if 'last_activity' in session:
                idle_seconds = (datetime.utcnow() - session['last_activity']).total_seconds()
                
                # Idle: no activity for 5+ minutes
                if idle_seconds >= 300:
                    return 'idle'
                
                # Active: activity within last minute
                if idle_seconds < 60:
                    return 'active'
                
                # Normal: activity within last 5 minutes
                return 'normal'
            
            return 'normal'
            
        except Exception as e:
            logger.error(f"Error calculating activity level: {str(e)}", exc_info=True)
            return 'normal'
    
    def _format_idle_time(self, seconds):
        """Format idle time as human-readable string"""
        if seconds < 60:
            return f"{int(seconds)}s"
        elif seconds < 3600:
            return f"{int(seconds / 60)}m"
        elif seconds < 86400:
            hours = int(seconds / 3600)
            minutes = int((seconds % 3600) / 60)
            return f"{hours}h {minutes}m"
        else:
            days = int(seconds / 86400)
            hours = int((seconds % 86400) / 3600)
            return f"{days}d {hours}h"
    
    def mark_suspicious(self, session_id, reason=None):
        """Mark a session as suspicious"""
        try:
            if self.collection is None:
                return False
            
            update_data = {
                'is_suspicious': True,
                'activity_level': 'suspicious',
                'updated_at': datetime.utcnow()
            }
            
            if reason:
                update_data['suspicious_reason'] = reason
            
            result = self.collection.update_one(
                {'session_id': session_id},
                {'$set': update_data}
            )
            
            return result.modified_count > 0
            
        except Exception as e:
            logger.error(f"Error marking session as suspicious: {str(e)}", exc_info=True)
            return False
