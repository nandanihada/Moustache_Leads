"""Placement Proof model for tracking publisher placement submissions"""
from datetime import datetime
from bson import ObjectId
from database import db_instance
import logging

logger = logging.getLogger(__name__)


class PlacementProof:
    def __init__(self):
        self.collection = db_instance.get_collection('placement_proofs')

    def _check_db(self):
        if self.collection is None or not db_instance.is_connected():
            return False
        try:
            self.collection.find_one({}, {'_id': 1})
            return True
        except Exception:
            return False

    def submit_proof(self, user_id, offer_id, proof_data):
        """Submit a placement proof for an offer"""
        if not self._check_db():
            return None, "Database connection not available"

        doc = {
            'user_id': str(user_id),
            'offer_id': str(offer_id),
            'offer_name': proof_data.get('offer_name', ''),
            'proof_type': proof_data.get('proof_type', 'screenshot'),  # screenshot, url, description
            'image_urls': proof_data.get('image_urls', []),
            'placement_url': proof_data.get('placement_url', ''),
            'description': proof_data.get('description', ''),
            'traffic_source': proof_data.get('traffic_source', ''),
            'status': 'pending',  # pending, approved, rejected
            'admin_notes': '',
            'score_awarded': 0,
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow()
        }

        try:
            result = self.collection.insert_one(doc)
            doc['_id'] = str(result.inserted_id)
            return doc, None
        except Exception as e:
            logger.error(f"Error submitting proof: {e}")
            return None, str(e)

    def get_proofs_by_user(self, user_id, page=1, per_page=20):
        """Get all proofs submitted by a user"""
        if not self._check_db():
            return [], 0

        try:
            query = {'user_id': str(user_id)}
            total = self.collection.count_documents(query)
            proofs = list(
                self.collection.find(query)
                .sort('created_at', -1)
                .skip((page - 1) * per_page)
                .limit(per_page)
            )
            for p in proofs:
                p['_id'] = str(p['_id'])
            return proofs, total
        except Exception as e:
            logger.error(f"Error getting user proofs: {e}")
            return [], 0

    def get_all_proofs(self, page=1, per_page=20, status=None, user_id=None):
        """Get all proofs (admin view)"""
        if not self._check_db():
            return [], 0

        try:
            query = {}
            if status and status != 'all':
                query['status'] = status
            if user_id:
                query['user_id'] = str(user_id)

            total = self.collection.count_documents(query)
            proofs = list(
                self.collection.find(query)
                .sort('created_at', -1)
                .skip((page - 1) * per_page)
                .limit(per_page)
            )
            for p in proofs:
                p['_id'] = str(p['_id'])
            return proofs, total
        except Exception as e:
            logger.error(f"Error getting all proofs: {e}")
            return [], 0

    def update_proof_status(self, proof_id, status, admin_notes='', score=0):
        """Update proof status (admin action)"""
        if not self._check_db():
            return None, "Database connection not available"

        try:
            result = self.collection.find_one_and_update(
                {'_id': ObjectId(proof_id)},
                {'$set': {
                    'status': status,
                    'admin_notes': admin_notes,
                    'score_awarded': score,
                    'updated_at': datetime.utcnow()
                }},
                return_document=True
            )
            if result:
                result['_id'] = str(result['_id'])
                return result, None
            return None, "Proof not found"
        except Exception as e:
            logger.error(f"Error updating proof: {e}")
            return None, str(e)

    def get_user_score(self, user_id):
        """Get total placement proof score for a user"""
        if not self._check_db():
            return 0, 0

        try:
            pipeline = [
                {'$match': {'user_id': str(user_id)}},
                {'$group': {
                    '_id': None,
                    'total_score': {'$sum': '$score_awarded'},
                    'total_proofs': {'$sum': 1},
                    'approved_proofs': {
                        '$sum': {'$cond': [{'$eq': ['$status', 'approved']}, 1, 0]}
                    }
                }}
            ]
            result = list(self.collection.aggregate(pipeline))
            if result:
                return result[0].get('total_score', 0), result[0].get('approved_proofs', 0)
            return 0, 0
        except Exception as e:
            logger.error(f"Error getting user score: {e}")
            return 0, 0

    def get_proofs_for_offer(self, user_id, offer_id):
        """Check if user already submitted proof for an offer"""
        if not self._check_db():
            return []

        try:
            proofs = list(self.collection.find({
                'user_id': str(user_id),
                'offer_id': str(offer_id)
            }).sort('created_at', -1))
            for p in proofs:
                p['_id'] = str(p['_id'])
            return proofs
        except Exception as e:
            logger.error(f"Error checking offer proofs: {e}")
            return []
