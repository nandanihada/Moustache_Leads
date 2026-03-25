"""
Admin Activity Log Model
Tracks all admin actions across the platform for audit purposes
"""

from datetime import datetime
from bson import ObjectId
from database import db_instance
import logging

logger = logging.getLogger(__name__)


class AdminActivityLog:
    def __init__(self):
        self.collection = db_instance.get_collection('admin_activity_logs')

    def _check_db_connection(self):
        if self.collection is None or not db_instance.is_connected():
            return False
        try:
            self.collection.find_one({}, {'_id': 1})
            return True
        except Exception:
            return False

    def log_activity(self, activity_data):
        """
        Log an admin activity.

        activity_data should contain:
            - action: str (e.g. 'offer_created', 'offer_deleted', 'bulk_delete', etc.)
            - category: str ('offer', 'rotation', 'email', 'promo_code', 'gift_card', 'recycle_bin', 'general')
            - admin_id: str
            - admin_username: str
            - details: dict (action-specific data)
            - affected_items: list of dicts (optional, items affected by the action)
        """
        if not self._check_db_connection():
            return None

        try:
            doc = {
                'action': activity_data.get('action', 'unknown'),
                'category': activity_data.get('category', 'general'),
                'admin_id': activity_data.get('admin_id', ''),
                'admin_username': activity_data.get('admin_username', 'system'),
                'details': activity_data.get('details', {}),
                'affected_items': activity_data.get('affected_items', []),
                'affected_count': activity_data.get('affected_count', len(activity_data.get('affected_items', []))),
                'ip_address': activity_data.get('ip_address', ''),
                'timestamp': datetime.utcnow(),
            }
            result = self.collection.insert_one(doc)
            return str(result.inserted_id)
        except Exception as e:
            logger.error(f"Failed to log activity: {e}")
            return None

    def get_logs(self, filters=None, page=1, per_page=25, sort_field='timestamp', sort_order=-1):
        """
        Get activity logs with filtering, pagination, and sorting.

        filters dict can contain:
            - category: str
            - action: str
            - admin_username: str
            - search: str (searches details, action, admin_username)
            - network: str
            - date_from: datetime
            - date_to: datetime
        """
        if not self._check_db_connection():
            return [], 0

        try:
            query = {}

            if filters:
                if filters.get('category'):
                    query['category'] = filters['category']
                if filters.get('action'):
                    query['action'] = filters['action']
                if filters.get('admin_username'):
                    query['admin_username'] = {'$regex': filters['admin_username'], '$options': 'i'}
                if filters.get('network'):
                    query['$or'] = [
                        {'details.network': {'$regex': filters['network'], '$options': 'i'}},
                        {'affected_items.network': {'$regex': filters['network'], '$options': 'i'}},
                    ]
                if filters.get('search'):
                    search = filters['search']
                    search_conditions = [
                        {'action': {'$regex': search, '$options': 'i'}},
                        {'admin_username': {'$regex': search, '$options': 'i'}},
                        {'details.offer_name': {'$regex': search, '$options': 'i'}},
                        {'details.name': {'$regex': search, '$options': 'i'}},
                        {'details.code': {'$regex': search, '$options': 'i'}},
                        {'details.email_subject': {'$regex': search, '$options': 'i'}},
                    ]
                    if '$or' in query:
                        query['$and'] = [{'$or': query.pop('$or')}, {'$or': search_conditions}]
                    else:
                        query['$or'] = search_conditions

                date_query = {}
                if filters.get('date_from'):
                    date_query['$gte'] = filters['date_from']
                if filters.get('date_to'):
                    date_query['$lte'] = filters['date_to']
                if date_query:
                    query['timestamp'] = date_query

            total = self.collection.count_documents(query)
            skip = (page - 1) * per_page

            logs = list(
                self.collection.find(query)
                .sort(sort_field, sort_order)
                .skip(skip)
                .limit(per_page)
            )

            # Serialize ObjectIds
            for log in logs:
                log['_id'] = str(log['_id'])

            return logs, total
        except Exception as e:
            logger.error(f"Failed to get activity logs: {e}")
            return [], 0

    def delete_logs(self, log_ids):
        """Delete specific activity logs by IDs."""
        if not self._check_db_connection():
            return 0
        try:
            object_ids = [ObjectId(lid) for lid in log_ids if ObjectId.is_valid(lid)]
            if not object_ids:
                return 0
            result = self.collection.delete_many({'_id': {'$in': object_ids}})
            return result.deleted_count
        except Exception as e:
            logger.error(f"Failed to delete activity logs: {e}")
            return 0

    def get_filter_options(self):
        """Get distinct values for filter dropdowns."""
        if not self._check_db_connection():
            return {}
        try:
            return {
                'categories': self.collection.distinct('category'),
                'actions': self.collection.distinct('action'),
                'admins': self.collection.distinct('admin_username'),
            }
        except Exception as e:
            logger.error(f"Failed to get filter options: {e}")
            return {}
