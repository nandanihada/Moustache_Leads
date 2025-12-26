"""
Publisher Promo Code Management Routes
Handles publisher viewing and applying promo codes to offers
"""

from flask import Blueprint, request, jsonify
from utils.auth import token_required
from database import db_instance
from bson import ObjectId
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

publisher_promo_codes_mgmt_bp = Blueprint('publisher_promo_codes_mgmt', __name__)


@publisher_promo_codes_mgmt_bp.route('/api/publisher/promo-codes/available', methods=['GET'])
@token_required
def get_available_promo_codes():
    """Get all available promo codes for publisher"""
    try:
        current_user = request.current_user
        
        # Get pagination params
        page = request.args.get('page', 1, type=int)
        limit = request.args.get('limit', 20, type=int)
        skip = (page - 1) * limit
        
        collection = db_instance.get_collection('promo_codes')
        
        # Get only active codes
        query = {'status': 'active'}
        
        # Get total count
        total = collection.count_documents(query)
        
        # Get promo codes
        codes = list(collection.find(query)
                    .sort('created_at', -1)
                    .skip(skip)
                    .limit(limit))
        
        # Convert ObjectIds to strings
        for code in codes:
            code['_id'] = str(code['_id'])
            code['created_by'] = str(code['created_by'])
        
        return jsonify({
            'promo_codes': codes,
            'total': total,
            'page': page,
            'limit': limit,
            'pages': (total + limit - 1) // limit
        }), 200
        
    except Exception as e:
        logger.error(f"❌ Error fetching available promo codes: {str(e)}")
        return jsonify({'error': f'Error fetching promo codes: {str(e)}'}), 500


@publisher_promo_codes_mgmt_bp.route('/api/publisher/offers/<offer_id>/apply-promo-code', methods=['POST'])
@token_required
def apply_promo_code_to_offer(offer_id):
    """Apply promo code to an offer"""
    try:
        current_user = request.current_user
        data = request.get_json()
        
        logger.info(f"🔍 Apply promo code request: offer_id={offer_id}, data={data}")
        
        if not data or not data.get('promo_code_id'):
            logger.error(f"❌ Missing promo_code_id in request")
            return jsonify({'error': 'Promo code ID is required'}), 400
        
        # Get collections
        offers_collection = db_instance.get_collection('offers')
        promo_codes_collection = db_instance.get_collection('promo_codes')
        
        # Verify offer exists
        offer = offers_collection.find_one({'offer_id': offer_id})
        if not offer:
            try:
                offer = offers_collection.find_one({'_id': ObjectId(offer_id)})
            except:
                pass
        
        if not offer:
            return jsonify({'error': 'Offer not found'}), 404
        
        # Get promo code
        try:
            promo_code_id = ObjectId(data.get('promo_code_id'))
        except:
            return jsonify({'error': 'Invalid promo code ID'}), 400
        
        promo_code = promo_codes_collection.find_one({'_id': promo_code_id})
        if not promo_code:
            return jsonify({'error': 'Promo code not found'}), 404
        
        # Use PromoCode model to apply the code properly
        from models.promo_code import PromoCode
        promo_model = PromoCode()
        
        # Apply code to user (this will increment usage_count and check auto-deactivation)
        user_promo_doc, error = promo_model.apply_code_to_user(
            promo_code['code'],
            str(current_user['_id'])
        )
        
        if error:
            return jsonify({'error': error}), 400
        
        logger.info(f"✅ Publisher {current_user['username']} applied code {promo_code['code']} to offer {offer.get('name')}")
        
        return jsonify({
            'message': 'Promo code applied successfully',
            'offer_id': offer.get('offer_id'),
            'promo_code': promo_code['code'],
            'bonus_amount': promo_code['bonus_amount'],
            'bonus_type': promo_code['bonus_type']
        }), 200
        
    except Exception as e:
        logger.error(f"❌ Error applying promo code: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        return jsonify({'error': f'Error applying promo code: {str(e)}'}), 500


@publisher_promo_codes_mgmt_bp.route('/api/publisher/my-applied-codes', methods=['GET'])
@token_required
def get_my_applied_codes():
    """Get all promo codes applied by current publisher"""
    try:
        current_user = request.current_user
        
        # Get pagination params
        page = request.args.get('page', 1, type=int)
        limit = request.args.get('limit', 20, type=int)
        skip = (page - 1) * limit
        
        user_promo_codes_collection = db_instance.get_collection('user_promo_codes')
        
        # Get codes applied by this user
        query = {
            'user_id': ObjectId(current_user['_id']),
            'status': 'active'
        }
        
        # Get total count
        total = user_promo_codes_collection.count_documents(query)
        
        # Get applied codes with offer and code details
        pipeline = [
            {'$match': query},
            {
                '$lookup': {
                    'from': 'offers',
                    'localField': 'offer_id',
                    'foreignField': '_id',
                    'as': 'offer'
                }
            },
            {
                '$lookup': {
                    'from': 'promo_codes',
                    'localField': 'promo_code_id',
                    'foreignField': '_id',
                    'as': 'promo_code'
                }
            },
            {'$sort': {'applied_at': -1}},
            {'$skip': skip},
            {'$limit': limit}
        ]
        
        applied_codes = list(user_promo_codes_collection.aggregate(pipeline))
        
        # Format response
        formatted_codes = []
        for item in applied_codes:
            offer = item.get('offer', [{}])[0]
            promo_code = item.get('promo_code', [{}])[0]
            
            formatted_codes.append({
                '_id': str(item['_id']),
                'offer_id': str(item['offer_id']),
                'offer_name': offer.get('name', 'Unknown'),
                'promo_code_id': str(item['promo_code_id']),
                'promo_code': promo_code.get('code', 'Unknown'),
                'bonus_amount': promo_code.get('bonus_amount', 0),
                'bonus_type': promo_code.get('bonus_type', 'percentage'),
                'applied_at': item['applied_at'].isoformat() if item.get('applied_at') else None
            })
        
        return jsonify({
            'applied_codes': formatted_codes,
            'total': total,
            'page': page,
            'limit': limit,
            'pages': (total + limit - 1) // limit
        }), 200
        
    except Exception as e:
        logger.error(f"❌ Error fetching applied codes: {str(e)}")
        return jsonify({'error': f'Error fetching applied codes: {str(e)}'}), 500


@publisher_promo_codes_mgmt_bp.route('/api/publisher/offers/<offer_id>/remove-promo-code', methods=['POST'])
@token_required
def remove_promo_code_from_offer(offer_id):
    """Remove promo code from an offer"""
    try:
        current_user = request.current_user
        
        user_promo_codes_collection = db_instance.get_collection('user_promo_codes')
        
        # Find and remove the application
        result = user_promo_codes_collection.update_one(
            {
                'user_id': ObjectId(current_user['_id']),
                'offer_id': ObjectId(offer_id),
                'status': 'active'
            },
            {'$set': {'status': 'removed', 'removed_at': datetime.utcnow()}}
        )
        
        if result.matched_count == 0:
            return jsonify({'error': 'Promo code application not found'}), 404
        
        logger.info(f"✅ Publisher {current_user['username']} removed promo code from offer {offer_id}")
        
        return jsonify({
            'message': 'Promo code removed successfully',
            'offer_id': str(offer_id)
        }), 200
        
    except Exception as e:
        logger.error(f"❌ Error removing promo code: {str(e)}")
        return jsonify({'error': f'Error removing promo code: {str(e)}'}), 500


@publisher_promo_codes_mgmt_bp.route('/api/publisher/offers/<offer_id>/applied-code', methods=['GET'])
@token_required
def get_offer_applied_code(offer_id):
    """Get promo code applied to a specific offer by current publisher"""
    try:
        current_user = request.current_user
        
        user_promo_codes_collection = db_instance.get_collection('user_promo_codes')
        promo_codes_collection = db_instance.get_collection('promo_codes')
        
        # Find applied code
        applied = user_promo_codes_collection.find_one({
            'user_id': ObjectId(current_user['_id']),
            'offer_id': ObjectId(offer_id),
            'status': 'active'
        })
        
        if not applied:
            return jsonify({
                'applied_code': None,
                'offer_id': str(offer_id)
            }), 200
        
        # Get code details
        promo_code = promo_codes_collection.find_one({'_id': applied['promo_code_id']})
        
        return jsonify({
            'applied_code': {
                '_id': str(applied['_id']),
                'promo_code_id': str(applied['promo_code_id']),
                'code': promo_code.get('code') if promo_code else 'Unknown',
                'bonus_amount': promo_code.get('bonus_amount') if promo_code else 0,
                'bonus_type': promo_code.get('bonus_type') if promo_code else 'percentage',
                'applied_at': applied['applied_at'].isoformat() if applied.get('applied_at') else None
            },
            'offer_id': str(offer_id)
        }), 200
        
    except Exception as e:
        logger.error(f"❌ Error fetching applied code: {str(e)}")
        return jsonify({'error': f'Error fetching applied code: {str(e)}'}), 500
