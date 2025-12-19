"""
Subadmin Permissions Model
Manages tab-level permissions for subadmin users
"""

from database import db_instance
from datetime import datetime
from bson import ObjectId
import logging

logger = logging.getLogger(__name__)

class SubadminPermissions:
    def __init__(self):
        self.db = db_instance.get_db()
        self.collection = self.db['subadmin_permissions'] if self.db is not None else None
    
    def create_permissions(self, user_id, allowed_tabs):
        """Create permissions for a subadmin user"""
        try:
            if self.collection is None:
                logger.error("Database not connected")
                return None
            
            # Check if permissions already exist
            existing = self.collection.find_one({'user_id': user_id})
            if existing:
                # Update existing permissions
                return self.update_permissions(user_id, allowed_tabs)
            
            permission_data = {
                'user_id': user_id,
                'allowed_tabs': allowed_tabs,
                'created_at': datetime.utcnow(),
                'updated_at': datetime.utcnow()
            }
            
            result = self.collection.insert_one(permission_data)
            logger.info(f"Created permissions for user {user_id}: {allowed_tabs}")
            
            return str(result.inserted_id)
            
        except Exception as e:
            logger.error(f"Error creating permissions: {str(e)}", exc_info=True)
            return None
    
    def update_permissions(self, user_id, allowed_tabs):
        """Update permissions for a subadmin user"""
        try:
            if self.collection is None:
                return False
            
            result = self.collection.update_one(
                {'user_id': user_id},
                {
                    '$set': {
                        'allowed_tabs': allowed_tabs,
                        'updated_at': datetime.utcnow()
                    }
                }
            )
            
            logger.info(f"Updated permissions for user {user_id}: {allowed_tabs}")
            return result.modified_count > 0 or result.matched_count > 0
            
        except Exception as e:
            logger.error(f"Error updating permissions: {str(e)}", exc_info=True)
            return False
    
    def get_permissions(self, user_id):
        """Get permissions for a subadmin user"""
        try:
            if self.collection is None:
                return None
            
            permissions = self.collection.find_one({'user_id': user_id})
            if permissions:
                permissions['_id'] = str(permissions['_id'])
            
            return permissions
            
        except Exception as e:
            logger.error(f"Error getting permissions: {str(e)}", exc_info=True)
            return None
    
    def check_permission(self, user_id, tab_name):
        """Check if user has permission for a specific tab"""
        try:
            if self.collection is None:
                return False
            
            permissions = self.get_permissions(user_id)
            if not permissions:
                return False
            
            allowed_tabs = permissions.get('allowed_tabs', [])
            return tab_name in allowed_tabs
            
        except Exception as e:
            logger.error(f"Error checking permission: {str(e)}", exc_info=True)
            return False
    
    def delete_permissions(self, user_id):
        """Delete permissions for a user (when removing subadmin role)"""
        try:
            if self.collection is None:
                return False
            
            result = self.collection.delete_one({'user_id': user_id})
            logger.info(f"Deleted permissions for user {user_id}")
            
            return result.deleted_count > 0
            
        except Exception as e:
            logger.error(f"Error deleting permissions: {str(e)}", exc_info=True)
            return False
    
    def get_all_subadmins(self):
        """Get all users with subadmin permissions"""
        try:
            if self.collection is None:
                return []
            
            permissions = list(self.collection.find({}))
            for perm in permissions:
                perm['_id'] = str(perm['_id'])
            
            return permissions
            
        except Exception as e:
            logger.error(f"Error getting all subadmins: {str(e)}", exc_info=True)
            return []
    
    @staticmethod
    def get_available_tabs():
        """Get list of all available admin tabs"""
        return [
            'offers',
            'promo-codes',
            'bonus-management',
            'offer-access-requests',
            'placement-approval',
            'offerwall-analytics',
            'comprehensive-analytics',
            'click-tracking',
            'login-logs',
            'active-users',
            'fraud-management',
            'analytics',
            'reports',
            'tracking',
            'test-tracking',
            'partners',
            'postback-logs',
            'postback-receiver',
            'publishers',
            'subadmin-management'
        ]
