from datetime import datetime
from bson import ObjectId
import bcrypt
from database import db_instance

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
    
    def create_user(self, username, email, password):
        """Create a new user with hashed password"""
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
            'role': 'user',  # Default role is 'user', can be 'admin'
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow(),
            'is_active': True
        }
        
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
            'is_active': True
        }
        
        try:
            result = self.collection.insert_one(user_data)
            user_data['_id'] = result.inserted_id
            # Remove password from returned data
            user_data.pop('password')
            return user_data, None
        except Exception as e:
            return None, f"Error creating admin user: {str(e)}"
