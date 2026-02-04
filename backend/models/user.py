from datetime import datetime, timedelta
from bson import ObjectId
import bcrypt
from database import db_instance

# Account status constants
ACCOUNT_STATUS_PENDING = 'pending_approval'
ACCOUNT_STATUS_APPROVED = 'approved'
ACCOUNT_STATUS_REJECTED = 'rejected'

class User:
    def __init__(self):
        self.collection = db_instance.get_collection('users')
    
    def _check_db_connection(self):
        """Check if database is connected and usable"""
        if self.collection is None or not db_instance.is_connected():
            return False
        
        # Try a simple operation to verify the connection actually works
        try:
            self.collection.find_one({}, {'_id': 1})
            return True
        except Exception:
            return False
    
    def create_user(self, username, email, password, **kwargs):
        """Create a new user with hashed password and optional partner fields"""
        if not self._check_db_connection():
            return None, "Database connection not available"
        
        # Check if user already exists
        if self.find_by_username(username):
            return None, "Username already exists"
        
        if self.find_by_email(email):
            return None, "Email already exists"
        
        # Hash password
        hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())
        
        # Base user data
        user_data = {
            'username': username,
            'email': email,
            'password': hashed_password,
            'role': kwargs.get('role', 'user'),  # Default role is 'user', can be 'admin', 'subadmin', or 'partner'
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow(),
            'is_active': True,
            'email_verified': False,  # Email verification status
            'email_verified_at': None,  # When email was verified
            # Account approval status - new users start as pending
            'account_status': ACCOUNT_STATUS_PENDING,  # pending_approval, approved, rejected
            'account_status_updated_at': datetime.utcnow(),  # For auto-approval tracking
            'account_approved_by': None,  # Admin who approved
            'account_rejection_reason': None,  # Reason if rejected
            # Email notification preferences
            'email_preferences': {
                'new_offers': True,  # Receive emails for new offers
                'offer_updates': True,  # Receive emails when offers are updated (promo codes, etc)
                'system_notifications': True,  # Receive system notifications
                'marketing_emails': False,  # Receive marketing emails
                'updated_at': datetime.utcnow()
            }
        }
        
        # Add partner-specific fields if provided
        if kwargs.get('first_name'):
            user_data['first_name'] = kwargs.get('first_name')
        if kwargs.get('last_name'):
            user_data['last_name'] = kwargs.get('last_name')
        if kwargs.get('company_name'):
            user_data['company_name'] = kwargs.get('company_name')
        if kwargs.get('website'):
            user_data['website'] = kwargs.get('website')
        if kwargs.get('postback_url'):
            user_data['postback_url'] = kwargs.get('postback_url')
        if kwargs.get('postback_method'):
            user_data['postback_method'] = kwargs.get('postback_method', 'GET')
        
        try:
            result = self.collection.insert_one(user_data)
            user_data['_id'] = result.inserted_id
            # Remove password from returned data
            user_data.pop('password')
            return user_data, None
        except Exception as e:
            return None, f"Error creating user: {str(e)}"
    
    def find_by_username(self, username):
        """Find user by username"""
        if not self._check_db_connection():
            return None
        return self.collection.find_one({'username': username})
    
    def find_by_email(self, email):
        """Find user by email"""
        if not self._check_db_connection():
            return None
        return self.collection.find_one({'email': email})
    
    def find_by_id(self, user_id):
        """Find user by ID"""
        if not self._check_db_connection():
            return None
        try:
            return self.collection.find_one({'_id': ObjectId(user_id)})
        except:
            return None
    
    def verify_password(self, username, password):
        """Verify user password"""
        if not self._check_db_connection():
            # Fallback demo user only when database is not available
            if username == "demo" and password == "demo123":
                return {
                    '_id': ObjectId(),
                    'username': 'demo',
                    'email': 'demo@example.com',
                    'role': 'user',
                    'created_at': datetime.utcnow(),
                    'is_active': True
                }
            return None
            
        user = self.find_by_username(username)
        if user and bcrypt.checkpw(password.encode('utf-8'), user['password']):
            # Remove password from returned data
            user.pop('password')
            return user
        return None
    
    def update_user(self, user_id, update_data):
        """Update user data"""
        if not self._check_db_connection():
            return False
        try:
            update_data['updated_at'] = datetime.utcnow()
            result = self.collection.update_one(
                {'_id': ObjectId(user_id)},
                {'$set': update_data}
            )
            return result.modified_count > 0
        except Exception as e:
            return False
    
    def create_admin_user(self, username, email, password):
        """Create an admin user"""
        if not self._check_db_connection():
            return None, "Database connection not available"
        
        # Check if user already exists
        if self.find_by_username(username):
            return None, "Username already exists"
        
        if self.find_by_email(email):
            return None, "Email already exists"
        
        # Hash password
        hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())
        
        user_data = {
            'username': username,
            'email': email,
            'password': hashed_password,
            'role': 'admin',  # Admin role
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow(),
            'is_active': True,
            'email_verified': False,
            'email_verified_at': None
        }
        
        try:
            result = self.collection.insert_one(user_data)
            user_data['_id'] = result.inserted_id
            # Remove password from returned data
            user_data.pop('password')
            return user_data, None
        except Exception as e:
            return None, f"Error creating admin user: {str(e)}"
    
    def mark_email_verified(self, user_id):
        """Mark user's email as verified"""
        if not self._check_db_connection():
            return False
        try:
            result = self.collection.update_one(
                {'_id': ObjectId(user_id)},
                {
                    '$set': {
                        'email_verified': True,
                        'email_verified_at': datetime.utcnow(),
                        'updated_at': datetime.utcnow()
                    }
                }
            )
            return result.modified_count > 0
        except Exception as e:
            return False
    
    def is_email_verified(self, user_id):
        """Check if user's email is verified"""
        if not self._check_db_connection():
            return False
        try:
            user = self.find_by_id(user_id)
            return user.get('email_verified', False) if user else False
        except Exception:
            return False
    
    def reset_password(self,user_id, new_password):
        """
        Reset user password
        
        Args:
            user_id: User ID
            new_password: New password (plain text)
            
        Returns:
            True if password reset successful, False otherwise
        """
        if not self._check_db_connection():
            return False
        
        try:
            # Hash the new password
            hashed_password = bcrypt.hashpw(new_password.encode('utf-8'), bcrypt.gensalt())
            
            # Update password in database
            result = self.collection.update_one(
                {'_id': ObjectId(user_id)},
                {
                    '$set': {
                        'password': hashed_password,
                        'password_updated_at': datetime.utcnow()
                    }
                }
            )
            
            return result.modified_count > 0
            
        except Exception as e:
            print(f"Error resetting password: {e}")
            return False
    
    def get_email_preferences(self, user_id):
        """Get user's email notification preferences"""
        if not self._check_db_connection():
            return None
        try:
            user = self.find_by_id(user_id)
            if user:
                return user.get('email_preferences', {
                    'new_offers': True,
                    'offer_updates': True,
                    'system_notifications': True,
                    'marketing_emails': False
                })
            return None
        except Exception:
            return None
    
    def update_email_preferences(self, user_id, preferences):
        """Update user's email notification preferences"""
        if not self._check_db_connection():
            return False
        try:
            preferences['updated_at'] = datetime.utcnow()
            result = self.collection.update_one(
                {'_id': ObjectId(user_id)},
                {
                    '$set': {
                        'email_preferences': preferences,
                        'updated_at': datetime.utcnow()
                    }
                }
            )
            return result.modified_count > 0
        except Exception as e:
            return False
    
    def should_receive_email(self, user_id, email_type):
        """Check if user should receive a specific type of email"""
        if not self._check_db_connection():
            return True  # Default to sending if we can't check
        try:
            preferences = self.get_email_preferences(user_id)
            if preferences:
                return preferences.get(email_type, True)
            return True  # Default to sending
        except Exception:
            return True
    
    def update_role(self, user_id, new_role):
        """Update user role"""
        if not self._check_db_connection():
            return False
        
        # Validate role
        allowed_roles = ['user', 'admin', 'subadmin', 'partner']
        if new_role not in allowed_roles:
            return False
        
        try:
            result = self.collection.update_one(
                {'_id': ObjectId(user_id)},
                {
                    '$set': {
                        'role': new_role,
                        'updated_at': datetime.utcnow()
                    }
                }
            )
            return result.modified_count > 0
        except Exception as e:
            return False
    
    def get_users_by_role(self, role=None):
        """Get all users, optionally filtered by role"""
        if not self._check_db_connection():
            return []
        
        try:
            query = {}
            if role:
                query['role'] = role
            
            users = list(self.collection.find(query, {'password': 0}))
            for user in users:
                user['_id'] = str(user['_id'])
            
            return users
        except Exception as e:
            return []
    
    def get_all_users_for_selection(self):
        """Get all users with basic info for selection dropdown"""
        if not self._check_db_connection():
            return []
        
        try:
            users = list(self.collection.find(
                {},
                {
                    '_id': 1,
                    'username': 1,
                    'email': 1,
                    'role': 1,
                    'created_at': 1
                }
            ))
            
            for user in users:
                user['_id'] = str(user['_id'])
            
            return users
        except Exception as e:
            return []
    
    # ============ Account Approval Methods ============
    
    def get_pending_users(self):
        """Get all users pending approval"""
        if not self._check_db_connection():
            return []
        
        try:
            # Get users with pending_approval status OR users without account_status field (legacy users)
            users = list(self.collection.find(
                {
                    '$or': [
                        {'account_status': ACCOUNT_STATUS_PENDING},
                        {'account_status': {'$exists': False}}  # Legacy users without status
                    ],
                    'role': {'$ne': 'admin'}  # Exclude admins
                },
                {'password': 0}  # Exclude password
            ).sort('created_at', -1))
            
            for user in users:
                user['_id'] = str(user['_id'])
                # Set default account_status for legacy users
                if 'account_status' not in user:
                    user['account_status'] = ACCOUNT_STATUS_PENDING
            
            return users
        except Exception as e:
            return []
    
    def get_all_users_with_status(self, status_filter=None):
        """Get all users with optional status filter"""
        if not self._check_db_connection():
            return []
        
        try:
            query = {'role': {'$ne': 'admin'}}  # Exclude admins
            
            if status_filter:
                if status_filter == ACCOUNT_STATUS_PENDING:
                    # Include users without account_status (legacy users)
                    query['$or'] = [
                        {'account_status': status_filter},
                        {'account_status': {'$exists': False}}
                    ]
                else:
                    query['account_status'] = status_filter
            
            users = list(self.collection.find(
                query,
                {'password': 0}  # Exclude password
            ).sort('created_at', -1))
            
            for user in users:
                user['_id'] = str(user['_id'])
                # Set default account_status for legacy users
                if 'account_status' not in user:
                    user['account_status'] = ACCOUNT_STATUS_PENDING
            
            return users
        except Exception as e:
            return []
    
    def approve_user(self, user_id, admin_id):
        """Approve a user account"""
        if not self._check_db_connection():
            return False, "Database connection not available"
        
        try:
            result = self.collection.update_one(
                {'_id': ObjectId(user_id)},
                {
                    '$set': {
                        'account_status': ACCOUNT_STATUS_APPROVED,
                        'account_status_updated_at': datetime.utcnow(),
                        'account_approved_by': admin_id,
                        'updated_at': datetime.utcnow()
                    }
                }
            )
            
            if result.modified_count > 0:
                return True, "User approved successfully"
            return False, "User not found or already approved"
        except Exception as e:
            return False, f"Error approving user: {str(e)}"
    
    def reject_user(self, user_id, admin_id, reason=None):
        """Reject a user account"""
        if not self._check_db_connection():
            return False, "Database connection not available"
        
        try:
            result = self.collection.update_one(
                {'_id': ObjectId(user_id)},
                {
                    '$set': {
                        'account_status': ACCOUNT_STATUS_REJECTED,
                        'account_status_updated_at': datetime.utcnow(),
                        'account_approved_by': admin_id,
                        'account_rejection_reason': reason,
                        'updated_at': datetime.utcnow()
                    }
                }
            )
            
            if result.modified_count > 0:
                return True, "User rejected"
            return False, "User not found"
        except Exception as e:
            return False, f"Error rejecting user: {str(e)}"
    
    def get_users_for_auto_approval(self, days=3):
        """Get users pending approval for more than X days (for auto-approval)"""
        if not self._check_db_connection():
            return []
        
        try:
            cutoff_date = datetime.utcnow() - timedelta(days=days)
            
            users = list(self.collection.find(
                {
                    'account_status': ACCOUNT_STATUS_PENDING,
                    'email_verified': True,  # Only auto-approve verified emails
                    'account_status_updated_at': {'$lt': cutoff_date},
                    'role': {'$ne': 'admin'}
                },
                {'password': 0}
            ))
            
            for user in users:
                user['_id'] = str(user['_id'])
            
            return users
        except Exception as e:
            return []
    
    def auto_approve_user(self, user_id):
        """Auto-approve a user (system action)"""
        if not self._check_db_connection():
            return False
        
        try:
            result = self.collection.update_one(
                {'_id': ObjectId(user_id)},
                {
                    '$set': {
                        'account_status': ACCOUNT_STATUS_APPROVED,
                        'account_status_updated_at': datetime.utcnow(),
                        'account_approved_by': 'system_auto_approval',
                        'updated_at': datetime.utcnow()
                    }
                }
            )
            return result.modified_count > 0
        except Exception as e:
            return False
    
    def is_account_approved(self, user_id):
        """Check if user's account is approved"""
        if not self._check_db_connection():
            return False
        
        try:
            user = self.find_by_id(user_id)
            if not user:
                return False
            # Admins are always approved
            if user.get('role') == 'admin':
                return True
            return user.get('account_status') == ACCOUNT_STATUS_APPROVED
        except Exception:
            return False
