from datetime import datetime
from bson import ObjectId
import secrets
import string
from database import db_instance

class ApiKeyModel:
    def __init__(self):
        self.collection = db_instance.get_collection('api_keys')
    
    def _check_db_connection(self):
        return self.collection is not None and db_instance.is_connected()

    def _generate_key_string(self):
        # Format: kapi- + random 24 chars
        alphabet = string.ascii_letters + string.digits
        random_str = ''.join(secrets.choice(alphabet) for _ in range(24))
        return f"kapi-{random_str}"

    def create_api_key(self, user_id, key_name):
        if not self._check_db_connection():
            return None, "Database connection not available"
        
        api_key_value = self._generate_key_string()
        
        doc = {
            "user_id": ObjectId(user_id),
            "key_name": key_name,
            "api_key": api_key_value,
            "status": "Active", # Active or Inactive
            "created_at": datetime.utcnow()
        }
        
        try:
            result = self.collection.insert_one(doc)
            doc["_id"] = str(result.inserted_id)
            doc["user_id"] = str(doc["user_id"])
            return doc, None
        except Exception as e:
            return None, str(e)
            
    def get_keys_by_user(self, user_id):
        if not self._check_db_connection():
            return []
        try:
            keys = list(self.collection.find({"user_id": ObjectId(user_id)}).sort("created_at", -1))
            for k in keys:
                k["_id"] = str(k["_id"])
                k["user_id"] = str(k["user_id"])
            return keys
        except Exception:
            return []

    def verify_api_key(self, api_key_value):
        if not self._check_db_connection():
            return None
        try:
            # Must be active
            return self.collection.find_one({"api_key": api_key_value, "status": "Active"})
        except Exception:
            return None

    def update_status(self, key_id, user_id, status):
        if not self._check_db_connection():
            return False
        try:
            result = self.collection.update_one(
                {"_id": ObjectId(key_id), "user_id": ObjectId(user_id)},
                {"$set": {"status": status}}
            )
            return result.modified_count > 0
        except:
            return False
            
    def delete_key(self, key_id, user_id):
        if not self._check_db_connection():
            return False
        try:
            result = self.collection.delete_one({"_id": ObjectId(key_id), "user_id": ObjectId(user_id)})
            return result.deleted_count > 0
        except:
            return False
