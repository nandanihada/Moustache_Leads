from datetime import datetime
from bson import ObjectId
from database import db_instance
from pymongo import ReturnDocument

class SmartLink:
    """Smart Link model for automatic offer redirection"""

    def __init__(self):
        self.collection = db_instance.get_collection('smart_links')

    def create_smart_link(self, name: str, slug: str, publisher_id: str = None, 
                          traffic_type: str = 'mainstream', allow_adult: bool = False,
                          status: str = 'active', offer_ids: list = None,
                          rotation_strategy: str = 'performance', fallback_url: str = None) -> tuple[dict, str]:
        """
        Create a new smart link
        """
        try:
            # Check if slug already exists
            existing = self.collection.find_one({'slug': slug})
            if existing:
                return None, f"Smart link with slug '{slug}' already exists"

            effective_rotation = rotation_strategy
            if not effective_rotation:
                effective_rotation = 'round_robin' if traffic_type in ['insurance', 'dating', 'free_trial'] else 'performance'

            smart_link_data = {
                'name': name,
                'slug': slug,
                'publisher_id': publisher_id,
                'traffic_type': traffic_type or 'mainstream', # mainstream / adult
                'allow_adult': allow_adult,
                'status': status,
                'offer_ids': offer_ids or [],
                'rotation_strategy': effective_rotation,
                'fallback_url': fallback_url,
                'rotation_pointers': {},  # Tracks which offer index for each country
                'created_at': datetime.utcnow(),
                'updated_at': datetime.utcnow()
            }

            result = self.collection.insert_one(smart_link_data)
            smart_link_data['_id'] = result.inserted_id

            return smart_link_data, ""

        except Exception as e:
            return None, str(e)

    def get_smart_link_by_slug(self, slug: str) -> dict:
        """
        Get smart link by slug
        """
        try:
            return self.collection.find_one({'slug': slug, 'status': 'active'})
        except Exception:
            return None

    def get_all_smart_links(self) -> list:
        """
        Get all smart links
        """
        try:
            return list(self.collection.find({}, {
                '_id': 1,
                'name': 1,
                'slug': 1,
                'publisher_id': 1,
                'traffic_type': 1,
                'allow_adult': 1,
                'status': 1,
                'offer_ids': 1,
                'rotation_strategy': 1,
                'fallback_url': 1,
                'created_at': 1,
                'updated_at': 1
            }).sort('created_at', -1))
        except Exception:
            return []

    def get_smart_links_by_publisher(self, publisher_id: str) -> list:
        """
        Get all smart links for a specific publisher
        """
        try:
            return list(self.collection.find({'publisher_id': publisher_id}).sort('created_at', -1))
        except Exception:
            return []

    def get_default_smart_link(self) -> dict:
        """
        Get the default active smart link for generic redirect flow
        """
        try:
            return self.collection.find_one({'status': 'active'}, sort=[('created_at', 1)])
        except Exception:
            return None

    def update_smart_link(self, smart_link_id: str, updates: dict) -> tuple[bool, str]:
        """
        Update smart link
        """
        try:
            updates['updated_at'] = datetime.utcnow()
            result = self.collection.update_one(
                {'_id': ObjectId(smart_link_id)},
                {'$set': updates}
            )
            return result.modified_count > 0, ""
        except Exception as e:
            return False, str(e)

    def delete_smart_link(self, smart_link_id: str) -> tuple[bool, str]:
        """
        Delete smart link
        """
        try:
            result = self.collection.delete_one({'_id': ObjectId(smart_link_id)})
            return result.deleted_count > 0, ""
        except Exception as e:
            return False, str(e)

    def get_and_increment_pointer(self, smart_link_id: str, country: str) -> int:
        """
        Atomically increment and return the rotation pointer for a specific country.
        Returns the value BEFORE incrementing.
        """
        try:
            # Safely handle the virtual global link string ID or publisher-specific master nodes
            query_id = smart_link_id
            is_virtual = smart_link_id in ['global_publisher_tracking', 'global_master_node'] or smart_link_id.startswith('global_master_')
            
            if not is_virtual:
                try:
                    from bson import ObjectId
                    query_id = ObjectId(smart_link_id)
                except:
                    pass
            
            # Key for the specific country in rotation_pointers map
            pointer_key = f'rotation_pointers.{country}'
            
            # Atomic increment
            result = self.collection.find_one_and_update(
                {'_id': query_id},
                {'$inc': {pointer_key: 1}},
                upsert=True,
                return_document=ReturnDocument.AFTER
            )
            
            if not result or 'rotation_pointers' not in result:
                return 0
                
            pointers = result.get('rotation_pointers', {})
            return pointers.get(country, 0)
            
        except Exception as e:
            print(f"!!! Error incrementing rotation pointer: {str(e)}")
            return 0

class ClickLog:
    """Click logging model for smart link analytics"""

    def __init__(self):
        self.collection = db_instance.get_collection('smart_link_clicks')

    def log_click(self, smart_link_id: str, offer_id: str = None, country: str = None, ip: str = None,
                  user_agent: str = None, publisher_id: str = None, device: str = None, 
                  click_id: str = None, offer_status: str = 'active', 
                  offer_name: str = None, session_id: str = None, 
                  timestamp: datetime = None) -> tuple[dict, str]:
        """
        Log a smart link click
        """
        try:
            click_data = {
                'smart_link_id': smart_link_id,
                'publisher_id': publisher_id,
                'offer_id': offer_id,
                'offer_name': offer_name,
                'offer_status': offer_status,
                'country': country,
                'ip': ip,
                'user_agent': user_agent,
                'device': device,
                'click_id': click_id or str(ObjectId()),
                'session_id': session_id,
                'timestamp': timestamp or datetime.utcnow()
            }

            result = self.collection.insert_one(click_data)
            click_data['_id'] = result.inserted_id

            return click_data, ""

        except Exception as e:
            return None, str(e)

    def get_raw_logs(self, limit: int = 200, **filters) -> list:
        """
        Get raw click logs for tabular view
        """
        try:
            query = {}
            if filters.get('smart_link_id'): query['smart_link_id'] = filters['smart_link_id']
            if filters.get('country'): query['country'] = filters['country']
            if filters.get('status'):
                if filters['status'] == 'redirected':
                    query['offer_id'] = {'$ne': None}
                else:
                    query['offer_id'] = None
                    
            cursor = self.collection.find(query).sort('timestamp', -1).limit(limit)
            results = []
            for doc in cursor:
                doc['_id'] = str(doc['_id'])
                results.append(doc)
            return results
        except Exception:
            return []

    def get_clicks_analytics(self, smart_link_id: str = None, start_date: datetime = None,
                           end_date: datetime = None, country: str = None) -> list:
        """
        Get click analytics with optional filters
        """
        try:
            query = {}
            if smart_link_id:
                query['smart_link_id'] = smart_link_id
            if country:
                query['country'] = country
            if start_date or end_date:
                query['timestamp'] = {}
                if start_date:
                    query['timestamp']['$gte'] = start_date
                if end_date:
                    query['timestamp']['$lte'] = end_date

            pipeline = [
                {'$match': query},
                {
                    '$group': {
                        '_id': {
                            'smart_link_id': '$smart_link_id',
                            'country': '$country',
                            'date': {
                                '$dateToString': {
                                    'format': '%Y-%m-%d',
                                    'date': '$timestamp'
                                }
                            }
                        },
                        'clicks': {'$sum': 1},
                        'unique_ips': {'$addToSet': '$ip'}
                    }
                },
                {
                    '$project': {
                        'smart_link_id': '$_id.smart_link_id',
                        'country': '$_id.country',
                        'date': '$_id.date',
                        'clicks': 1,
                        'unique_visitors': {'$size': '$unique_ips'}
                    }
                },
                {'$sort': {'date': -1, 'clicks': -1}}
            ]

            return list(self.collection.aggregate(pipeline))

        except Exception:
            return []

    def get_country_distribution(self, smart_link_id: str = None, start_date: datetime = None,
                                end_date: datetime = None) -> list:
        """
        Get country distribution analytics
        """
        try:
            query = {}
            if smart_link_id:
                query['smart_link_id'] = smart_link_id
            if start_date or end_date:
                query['timestamp'] = {}
                if start_date:
                    query['timestamp']['$gte'] = start_date
                if end_date:
                    query['timestamp']['$lte'] = end_date

            pipeline = [
                {'$match': query},
                {
                    '$group': {
                        '_id': '$country',
                        'clicks': {'$sum': 1}
                    }
                },
                {
                    '$project': {
                        'country': '$_id',
                        'clicks': 1
                    }
                },
                {'$sort': {'clicks': -1}}
            ]

            return list(self.collection.aggregate(pipeline))

        except Exception:
            return []

    def get_offer_distribution(self, smart_link_id: str = None, start_date: datetime = None,
                             end_date: datetime = None) -> list:
        """
        Get offer distribution analytics
        """
        try:
            query = {}
            if smart_link_id:
                query['smart_link_id'] = smart_link_id
            if start_date or end_date:
                query['timestamp'] = {}
                if start_date:
                    query['timestamp']['$gte'] = start_date
                if end_date:
                    query['timestamp']['$lte'] = end_date

            pipeline = [
                {'$match': query},
                {
                    '$group': {
                        '_id': '$offer_id',
                        'clicks': {'$sum': 1}
                    }
                },
                {
                    '$project': {
                        'offer_id': '$_id',
                        'clicks': 1
                    }
                },
                {'$sort': {'clicks': -1}}
            ]

            return list(self.collection.aggregate(pipeline))

        except Exception:
            return []