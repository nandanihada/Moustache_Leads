from datetime import datetime
from bson import ObjectId
from database import db_instance

class ApiConversionsModel:
    def __init__(self):
        self.collection = db_instance.get_collection('api_conversions')
    
    def _check_db_connection(self):
        return self.collection is not None and db_instance.is_connected()

    def track_conversion(self, api_key_id, order_id, payout, status="pending"):
        if not self._check_db_connection():
            return False
            
        doc = {
            "api_key_id": ObjectId(api_key_id),
            "order_id": order_id,
            "payout": float(payout),
            "status": status, # pending, approved, rejected
            "created_at": datetime.utcnow()
        }
        
        try:
            result = self.collection.insert_one(doc)
            doc["_id"] = str(result.inserted_id)
            doc["api_key_id"] = str(doc["api_key_id"])
            return doc
        except Exception:
            return None
            
    def get_conversions_by_key(self, api_key_id, status_filter=None):
        if not self._check_db_connection():
            return []
        try:
            query = {"api_key_id": ObjectId(api_key_id)}
            if status_filter:
                query["status"] = status_filter
                
            convs = list(self.collection.find(query).sort("created_at", -1))
            for c in convs:
                c["_id"] = str(c["_id"])
                c["api_key_id"] = str(c["api_key_id"])
            return convs
        except Exception:
            return []
