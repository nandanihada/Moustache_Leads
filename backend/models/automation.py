from datetime import datetime, timedelta
from bson import ObjectId
from database import db_instance
import logging

logger = logging.getLogger(__name__)

class AutomationState:
    COLLECTION_NAME = 'automation_states'

    @classmethod
    def get_collection(cls):
        return db_instance.get_collection(cls.COLLECTION_NAME)

    @classmethod
    def get_by_user_id(cls, user_id):
        col = cls.get_collection()
        if col is None: return None
        state = col.find_one({'user_id': str(user_id)})
        return state

    @classmethod
    def update_state(cls, user_id, updates):
        col = cls.get_collection()
        if col is None: return False
        
        updates['updated_at'] = datetime.utcnow()
        col.update_one(
            {'user_id': str(user_id)},
            {'$set': updates},
            upsert=True
        )
        return True

    @classmethod
    def get_pending_queue(cls):
        col = cls.get_collection()
        if col is None: return []
        
        now = datetime.utcnow()
        return list(col.find({
            'queue_status': 'active',
            'next_mail_time': {'$lte': now}
        }))

class AutomationSettings:
    COLLECTION_NAME = 'automation_settings'

    @classmethod
    def get_settings(cls):
        col = db_instance.get_collection(cls.COLLECTION_NAME)
        if col is None: return cls.get_defaults()
        
        settings = col.find_one({'type': 'global'})
        if not settings:
            settings = cls.get_defaults()
            col.insert_one(settings)
        return settings

    @classmethod
    def get_defaults(cls):
        return {
            'type': 'global',
            'initial_delay_hours': 5,
            'step_interval_minutes': 200, # 3h 20m = 200m
            'cooldown_days': 7,
            'enabled': True,
            'updated_at': datetime.utcnow()
        }

    @classmethod
    def update_settings(cls, updates):
        col = db_instance.get_collection(cls.COLLECTION_NAME)
        if col is None: return False
        
        updates['updated_at'] = datetime.utcnow()
        col.update_one(
            {'type': 'global'},
            {'$set': updates},
            upsert=True
        )
        return True
