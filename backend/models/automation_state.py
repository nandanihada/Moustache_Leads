from datetime import datetime, timedelta
from bson import ObjectId
from database import db_instance

class AutomationState:
    def __init__(self):
        self.collection = db_instance.get_collection('automation_states')
        self.settings_collection = db_instance.get_collection('automation_settings')

    def get_user_state(self, user_id):
        return self.collection.find_one({'user_id': str(user_id)})

    def update_user_state(self, user_id, update_data):
        update_data['updated_at'] = datetime.utcnow()
        return self.collection.update_one(
            {'user_id': str(user_id)},
            {'$set': update_data},
            upsert=True
        )

    def get_active_queue(self):
        return list(self.collection.find({'queue_status': 'active'}))

    def get_all_states(self):
        return list(self.collection.find())

    def get_settings(self):
        settings = self.settings_collection.find_one({'type': 'global'})
        if not settings:
            # Default settings
            settings = {
                'type': 'global',
                'enabled': True,
                'initial_delay_hours': 5,
                'step_interval_minutes': 200, # 3h 20m
                'cooldown_days': 7,
                'updated_at': datetime.utcnow()
            }
            self.settings_collection.insert_one(settings)
        return settings

    def update_settings(self, new_settings):
        new_settings['updated_at'] = datetime.utcnow()
        return self.settings_collection.update_one(
            {'type': 'global'},
            {'$set': new_settings},
            upsert=True
        )
