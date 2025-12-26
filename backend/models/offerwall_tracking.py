import uuid
import datetime
from typing import Dict, List, Optional, Tuple, Any
from pymongo import MongoClient
import logging

logger = logging.getLogger(__name__)

class OfferwallTracking:
    """Enhanced offerwall tracking system with user points and fraud detection"""
    
    def __init__(self, db_instance: MongoClient):
        self.db = db_instance
        self.sessions_col = db_instance.get_collection('offerwall_sessions')
        self.impressions_col = db_instance.get_collection('offerwall_impressions')
        self.clicks_col = db_instance.get_collection('offerwall_clicks')
        self.conversions_col = db_instance.get_collection('offerwall_conversions')
        self.user_points_col = db_instance.get_collection('user_points')
        self.completions_col = db_instance.get_collection('offer_completions')
        self.fraud_signals_col = db_instance.get_collection('fraud_signals')
        self.analytics_col = db_instance.get_collection('offerwall_analytics')
        self.publisher_stats_col = db_instance.get_collection('publisher_offerwall_stats')
        
        # Initialize points for user if not exists
        self._init_user_points = lambda user_id: self.user_points_col.update_one(
            {'user_id': user_id},
            {
                '$setOnInsert': {
                    'user_id': user_id,
                    'total_points': 0,
                    'available_points': 0,
                    'redeemed_points': 0,
                    'pending_points': 0,
                    'created_at': datetime.datetime.utcnow(),
                    'updated_at': datetime.datetime.utcnow()
                }
            },
            upsert=True
        )

    def create_session(self, placement_id: str, user_id: str, publisher_id: str, 
                      device_info: Dict, geo_info: Dict, sub_id: Optional[str] = None) -> Tuple[str, Optional[str]]:
        """Create a new offerwall session"""
        try:
            session_id = str(uuid.uuid4())
            session_doc = {
                'session_id': session_id,
                'placement_id': placement_id,
                'user_id': user_id,
                'publisher_id': publisher_id,
                'sub_id': sub_id,
                'device_info': device_info,
                'geo_info': geo_info,
                'created_at': datetime.datetime.utcnow(),
                'status': 'active'
            }
            
            self.sessions_col.insert_one(session_doc)
            return session_id, None
            
        except Exception as e:
            logger.error(f"Error creating session: {e}")
            return None, str(e)

    def record_impression(self, session_id: str, placement_id: str, publisher_id: str,
                         user_id: str, impression_data: Dict) -> Tuple[str, Optional[str]]:
        """Record offerwall impression"""
        try:
            impression_id = str(uuid.uuid4())
            impression_doc = {
                'impression_id': impression_id,
                'session_id': session_id,
                'placement_id': placement_id,
                'publisher_id': publisher_id,
                'user_id': user_id,
                'timestamp': datetime.datetime.utcnow(),
                'data': impression_data
            }
            
            self.impressions_col.insert_one(impression_doc)
            return impression_id, None
            
        except Exception as e:
            logger.error(f"Error recording impression: {e}")
            return None, str(e)

    def record_click(self, session_id: str, offer_id: str, placement_id: str,
                    publisher_id: str, user_id: str, click_data: Dict) -> Tuple[str, Optional[str]]:
        """Record offer click with fraud detection"""
        try:
            # Check for duplicate clicks (within 5 seconds)
            five_seconds_ago = datetime.datetime.utcnow() - datetime.timedelta(seconds=5)
            existing_click = self.clicks_col.find_one({
                'user_id': user_id,
                'offer_id': offer_id,
                'timestamp': {'$gte': five_seconds_ago}
            })
            
            if existing_click:
                return None, "Duplicate click detected"
            
            click_id = str(uuid.uuid4())
            click_doc = {
                'click_id': click_id,
                'session_id': session_id,
                'offer_id': offer_id,
                'placement_id': placement_id,
                'publisher_id': publisher_id,
                'user_id': user_id,
                'timestamp': datetime.datetime.utcnow(),
                'data': click_data,
                'fraud_score': 0,
                'status': 'valid'
            }
            
            self.clicks_col.insert_one(click_doc)
            return click_id, None
            
        except Exception as e:
            logger.error(f"Error recording click: {e}")
            return None, str(e)

    def record_conversion(self, click_id: str, session_id: str, offer_id: str,
                         placement_id: str, publisher_id: str, user_id: str,
                         payout_amount: float, conversion_data: Dict) -> Tuple[str, Optional[str]]:
        """Record offer conversion with points awarding"""
        try:
            # Check for duplicate conversions (within 1 hour)
            one_hour_ago = datetime.datetime.utcnow() - datetime.timedelta(hours=1)
            existing_conversion = self.conversions_col.find_one({
                'user_id': user_id,
                'offer_id': offer_id,
                'timestamp': {'$gte': one_hour_ago}
            })
            
            if existing_conversion:
                return None, "Duplicate conversion detected"
            
            # Check for fast conversion (within 2 seconds of click is suspicious)
            # Note: Normal users take 2-30+ seconds to complete an offer
            # Less than 2 seconds indicates likely bot/automation
            click = self.clicks_col.find_one({'click_id': click_id})
            if click and (datetime.datetime.utcnow() - click['timestamp']).total_seconds() < 2:
                # Record fast conversion fraud signal
                self._record_fraud_signal(user_id, 'fast_conversion', {
                    'click_id': click_id,
                    'conversion_time': datetime.datetime.utcnow(),
                    'click_time': click['timestamp']
                })
            
            conversion_id = str(uuid.uuid4())
            points_awarded = int(payout_amount * 100)  # Convert to points
            
            conversion_doc = {
                'conversion_id': conversion_id,
                'click_id': click_id,
                'session_id': session_id,
                'offer_id': offer_id,
                'placement_id': placement_id,
                'publisher_id': publisher_id,
                'user_id': user_id,
                'payout_amount': payout_amount,
                'points_awarded': points_awarded,
                'timestamp': datetime.datetime.utcnow(),
                'data': conversion_data,
                'status': 'pending'
            }
            
            self.conversions_col.insert_one(conversion_doc)
            
            # Award points to user
            self._award_points(user_id, points_awarded, 'conversion', conversion_id, offer_id)
            
            # Record completion
            self._record_completion(user_id, offer_id, payout_amount, points_awarded)
            
            return conversion_id, None
            
        except Exception as e:
            logger.error(f"Error recording conversion: {e}")
            return None, str(e)

    def get_user_points(self, user_id: str) -> Dict:
        """Get user's points summary"""
        try:
            self._init_user_points(user_id)
            
            user_points = self.user_points_col.find_one({'user_id': user_id})
            
            if user_points:
                return {
                    'user_id': user_id,
                    'total_points': user_points.get('total_points', 0),
                    'available_points': user_points.get('available_points', 0),
                    'redeemed_points': user_points.get('redeemed_points', 0),
                    'pending_points': user_points.get('pending_points', 0)
                }
            else:
                return {
                    'user_id': user_id,
                    'total_points': 0,
                    'available_points': 0,
                    'redeemed_points': 0,
                    'pending_points': 0
                }
                
        except Exception as e:
            logger.error(f"Error getting user points: {e}")
            return {}

    def get_user_points_history(self, user_id: str, limit: int = 50) -> List[Dict]:
        """Get user's points earning history"""
        try:
            self._init_user_points(user_id)
            
            # Get points history from conversions
            conversions = list(self.conversions_col.find(
                {'user_id': user_id},
                {'timestamp': 1, 'points_awarded': 1, 'offer_id': 1, 'conversion_id': 1, 'status': 1}
            ).sort('timestamp', -1).limit(limit))
            
            history = []
            for conv in conversions:
                history.append({
                    'timestamp': conv['timestamp'],
                    'points': conv.get('points_awarded', 0),
                    'type': 'earned',
                    'offer_id': conv.get('offer_id'),
                    'conversion_id': conv.get('conversion_id'),
                    'status': conv.get('status', 'completed')
                })
            
            return history
            
        except Exception as e:
            logger.error(f"Error getting points history: {e}")
            return []

    def get_user_completed_offers(self, user_id: str, limit: int = 50) -> List[Dict]:
        """Get user's completed offers"""
        try:
            completions = list(self.completions_col.find(
                {'user_id': user_id}
            ).sort('completion_time', -1).limit(limit))
            
            return completions
            
        except Exception as e:
            logger.error(f"Error getting completed offers: {e}")
            return []

    def _award_points(self, user_id: str, points: int, points_type: str, 
                     reference_id: str, offer_id: str):
        """Award points to user"""
        try:
            self._init_user_points(user_id)
            
            # Update user points
            self.user_points_col.update_one(
                {'user_id': user_id},
                {
                    '$inc': {
                        'total_points': points,
                        'available_points': points
                    },
                    '$set': {
                        'updated_at': datetime.datetime.utcnow()
                    }
                }
            )
            
            # Record points history
            points_history_doc = {
                'user_id': user_id,
                'points': points,
                'type': points_type,
                'reference_id': reference_id,
                'offer_id': offer_id,
                'timestamp': datetime.datetime.utcnow()
            }
            
            # Store in user_points collection as history
            self.user_points_col.update_one(
                {'user_id': user_id},
                {
                    '$push': {
                        'history': points_history_doc
                    }
                }
            )
            
        except Exception as e:
            logger.error(f"Error awarding points: {e}")

    def _record_completion(self, user_id: str, offer_id: str, payout_amount: float, points_awarded: int):
        """Record offer completion"""
        try:
            completion_doc = {
                'user_id': user_id,
                'offer_id': offer_id,
                'offer_name': f'Offer {offer_id}',  # Would get from offers collection
                'payout_amount': payout_amount,
                'points_awarded': points_awarded,
                'completion_time': datetime.datetime.utcnow(),
                'status': 'completed',
                'fraud_score': 0
            }
            
            self.completions_col.insert_one(completion_doc)
            
        except Exception as e:
            logger.error(f"Error recording completion: {e}")

    def _record_fraud_signal(self, user_id: str, signal_type: str, data: Dict):
        """Record fraud signal"""
        try:
            fraud_doc = {
                'user_id': user_id,
                'signal_type': signal_type,
                'data': data,
                'timestamp': datetime.datetime.utcnow(),
                'status': 'detected',
                'severity': 'medium'
            }
            
            self.fraud_signals_col.insert_one(fraud_doc)
            
        except Exception as e:
            logger.error(f"Error recording fraud signal: {e}")

    def get_fraud_signals(self, limit: int = 100) -> List[Dict]:
        """Get fraud signals for review"""
        try:
            signals = list(self.fraud_signals_col.find(
                {}
            ).sort('timestamp', -1).limit(limit))
            
            # Convert ObjectId to string for JSON serialization
            for signal in signals:
                if '_id' in signal:
                    signal['_id'] = str(signal['_id'])
            
            return signals
            
        except Exception as e:
            logger.error(f"Error getting fraud signals: {e}")
            return []

    def get_dashboard_stats(self) -> Dict:
        """Get dashboard statistics"""
        try:
            # Get basic stats
            total_sessions = self.sessions_col.count_documents({})
            total_clicks = self.clicks_col.count_documents({})
            total_conversions = self.conversions_col.count_documents({})
            total_points = list(self.user_points_col.aggregate([
                {'$group': {'_id': None, 'total': {'$sum': '$total_points'}}}
            ]))
            
            points_total = total_points[0]['total'] if total_points else 0
            
            # Calculate CTR
            ctr = (total_clicks / total_sessions * 100) if total_sessions > 0 else 0
            
            # Calculate CVR
            cvr = (total_conversions / total_clicks * 100) if total_clicks > 0 else 0
            
            return {
                'total_sessions': total_sessions,
                'total_clicks': total_clicks,
                'total_conversions': total_conversions,
                'total_points_awarded': points_total,
                'ctr': round(ctr, 2),
                'cvr': round(cvr, 2)
            }
            
        except Exception as e:
            logger.error(f"Error getting dashboard stats: {e}")
            return {}
