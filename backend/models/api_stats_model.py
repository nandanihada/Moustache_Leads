from datetime import datetime
from bson import ObjectId
from database import db_instance

class ApiStatsModel:
    def __init__(self):
        self.collection = db_instance.get_collection('api_stats')
    
    def _check_db_connection(self):
        return self.collection is not None and db_instance.is_connected()

    def track_event(self, api_key_id, event_type, traffic_source="Direct", device_type="Unknown"):
        # event_type is 'click' or 'impression'
        if not self._check_db_connection():
            return False
            
        today = datetime.utcnow().strftime("%Y-%m-%d")
        
        # Upsert rule: Group by api_key_id, date, traffic_source, device_type
        query = {
            "api_key_id": ObjectId(api_key_id),
            "date": today,
            "traffic_source": traffic_source,
            "device_type": device_type
        }
        
        update = {
            "$inc": { "clicks": 1 if event_type == 'click' else 0, "impressions": 1 if event_type == 'impression' else 0 },
            "$setOnInsert": { "created_at": datetime.utcnow() }
        }
        
        try:
            self.collection.update_one(query, update, upsert=True)
            return True
        except Exception:
            return False
            
    def get_stats_by_key(self, api_key_id, start_date=None, end_date=None):
        if not self._check_db_connection():
            return []
        try:
            query = {"api_key_id": ObjectId(api_key_id)}
            # Optional date filtering
            if start_date or end_date:
                query["date"] = {}
                if start_date: query["date"]["$gte"] = start_date
                if end_date: query["date"]["$lte"] = end_date
                
            stats = list(self.collection.find(query).sort("date", -1))
            for s in stats:
                s["_id"] = str(s["_id"])
                s["api_key_id"] = str(s["api_key_id"])
            return stats
        except Exception:
            return []
