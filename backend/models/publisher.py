from datetime import datetime
from bson import ObjectId
from database import db_instance
import logging

logger = logging.getLogger(__name__)


class Publisher:
    def __init__(self):
        self.collection = db_instance.get_collection('publishers')
    
    def _check_db_connection(self):
        """Check if database is connected and usable"""
        if self.collection is None or not db_instance.is_connected():
            return False
        
        try:
            self.collection.find_one({}, {'_id': 1})
            return True
        except Exception:
            return False
    
    def create_publisher(self, name, contact_email, user_id):
        """Create a new publisher"""
        if not self._check_db_connection():
            return None, "Database connection not available"
        
        # Check if publisher already exists for this user
        existing = self.find_by_user_id(user_id)
        if existing:
            return existing, None
        
        publisher_data = {
            'name': name,
            'contactEmail': contact_email,
            'userId': ObjectId(user_id),
            'status': 'ACTIVE',
            'createdAt': datetime.utcnow(),
            'updatedAt': datetime.utcnow()
        }
        
        try:
            result = self.collection.insert_one(publisher_data)
            publisher_data['_id'] = result.inserted_id
            return publisher_data, None
        except Exception as e:
            logger.error(f"Error creating publisher: {e}")
            return None, f"Error creating publisher: {str(e)}"
    
    def find_by_user_id(self, user_id):
        """Find publisher by user ID"""
        if not self._check_db_connection():
            return None
        
        try:
            return self.collection.find_one({'userId': ObjectId(user_id)})
        except Exception as e:
            logger.error(f"Error finding publisher by user ID: {e}")
            return None
    
    def find_by_id(self, publisher_id):
        """Find publisher by ID"""
        if not self._check_db_connection():
            return None
        
        try:
            return self.collection.find_one({'_id': ObjectId(publisher_id)})
        except Exception as e:
            logger.error(f"Error finding publisher by ID: {e}")
            return None
    
    def update_publisher(self, publisher_id, update_data):
        """Update publisher data"""
        if not self._check_db_connection():
            return False
        
        try:
            update_data['updatedAt'] = datetime.utcnow()
            result = self.collection.update_one(
                {'_id': ObjectId(publisher_id)},
                {'$set': update_data}
            )
            return result.modified_count > 0
        except Exception as e:
            logger.error(f"Error updating publisher: {e}")
            return False
    
    def get_or_create_for_user(self, user_data):
        """Get existing publisher or create new one for user"""
        publisher = self.find_by_user_id(user_data['id'])
        
        if not publisher:
            # Create new publisher for this user
            publisher, error = self.create_publisher(
                name=user_data['username'],
                contact_email=user_data['email'],
                user_id=user_data['id']
            )
            if error:
                return None, error
        
        return publisher, None
