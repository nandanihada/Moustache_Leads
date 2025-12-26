"""
Publisher Promo Code Routes
Handles promo code application and tracking for publishers
"""

from flask import Blueprint, request, jsonify
from utils.auth import token_required
from models.promo_code import PromoCode
from database import db_instance
from bson import ObjectId
import logging

logger = logging.getLogger(__name__)

publisher_promo_codes_bp = Blueprint('publisher_promo_codes', __name__)


@publisher_promo_codes_bp.route('/api/publisher/promo-codes/apply', methods=['POST'])
@token_required
def apply_promo_code():
    """Apply a promo code to user's account"""
    try:
        current_user = request.current_user
        data = request.get_json()
        
        if not data or 'code' not in data:
            return jsonify({'error': 'Promo code is required'}), 400
        
        code = data['code'].strip()
        if not code:
            return jsonify({'error': 'Promo code cannot be empty'}), 400
        
        promo_code_model = PromoCode()
        user_promo_doc, error = promo_code_model.apply_code_to_user(code, current_user['_id'])
        
        if error:
            return jsonify({'error': error}), 400
        
        # Get full code details
        code_obj = promo_code_model.get_promo_code_by_code(code)
        
        # Convert ObjectIds to strings for JSON serialization
        user_promo_doc['_id'] = str(user_promo_doc['_id'])
        user_promo_doc['user_id'] = str(user_promo_doc['user_id'])
        user_promo_doc['promo_code_id'] = str(user_promo_doc['promo_code_id'])
        
        logger.info(f"✅ Publisher {current_user.get('username')} applied promo code: {code}")
        
        return jsonify({
            'message': 'Promo code applied successfully',
            'user_promo_code': user_promo_doc,
            'code_details': {
                'code': code_obj['code'],
                'bonus_type': code_obj['bonus_type'],
                'bonus_amount': code_obj['bonus_amount'],
                'expires_at': code_obj['end_date'].isoformat() if code_obj['end_date'] else None
            }
        }), 201
        
    except Exception as e:
        logger.error(f"❌ Error applying promo code: {str(e)}")
        return jsonify({'error': f'Error applying code: {str(e)}'}), 500


@publisher_promo_codes_bp.route('/api/publisher/promo-codes/active', methods=['GET'])
@token_required
def get_active_promo_codes():
    """Get user's active promo codes"""
    try:
        current_user = request.current_user
        
        promo_code_model = PromoCode()
        codes = promo_code_model.get_user_active_codes(current_user['_id'])
        
        # Enrich with full code details
        for code in codes:
            full_code = promo_code_model.get_promo_code_by_id(str(code['promo_code_id']))
            if full_code:
                code['code_details'] = {
                    'bonus_type': full_code['bonus_type'],
                    'bonus_amount': full_code['bonus_amount'],
                    'description': full_code.get('description', '')
                }
        
        return jsonify({
            'active_codes': codes,
            'total': len(codes)
        }), 200
        
    except Exception as e:
        logger.error(f"❌ Error fetching active codes: {str(e)}")
        return jsonify({'error': f'Error fetching codes: {str(e)}'}), 500


@publisher_promo_codes_bp.route('/api/publisher/promo-codes/available', methods=['GET'])
@token_required
def get_available_promo_codes():
    """Get available promo codes for user to apply"""
    try:
        current_user = request.current_user
        
        # Get pagination params
        page = request.args.get('page', 1, type=int)
        limit = request.args.get('limit', 20, type=int)
        skip = (page - 1) * limit
        
        promo_code_model = PromoCode()
        codes, total = promo_code_model.get_available_codes(skip, limit)
        
        # Get user's already applied codes
        user_codes = promo_code_model.get_user_active_codes(current_user['_id'])
        user_code_ids = [str(uc['promo_code_id']) for uc in user_codes]
        
        # Mark which codes user has already applied
        for code in codes:
            code['already_applied'] = str(code['_id']) in user_code_ids
        
        return jsonify({
            'promo_codes': codes,
            'total': total,
            'page': page,
            'limit': limit,
            'pages': (total + limit - 1) // limit
        }), 200
        
    except Exception as e:
        logger.error(f"❌ Error fetching available codes: {str(e)}")
        return jsonify({'error': f'Error fetching codes: {str(e)}'}), 500


@publisher_promo_codes_bp.route('/api/publisher/promo-codes/<code_id>/remove', methods=['POST'])
@token_required
def remove_promo_code(code_id):
    """Remove a promo code from user's account"""
    try:
        current_user = request.current_user
        
        collection = db_instance.get_collection('user_promo_codes')
        if collection is None:
            return jsonify({'error': 'Database connection failed'}), 500
        
        # Deactivate the user promo code
        result = collection.update_one(
            {
                '_id': ObjectId(code_id),
                'user_id': ObjectId(current_user['_id'])
            },
            {'$set': {'is_active': False}}
        )
        
        if result.matched_count == 0:
            return jsonify({'error': 'Promo code not found'}), 404
        
        # Get the code details
        user_promo = collection.find_one({'_id': ObjectId(code_id)})
        
        # Remove from user's active_promo_codes array
        users_collection = db_instance.get_collection('users')
        users_collection.update_one(
            {'_id': ObjectId(current_user['_id'])},
            {'$pull': {'active_promo_codes': user_promo['code']}}
        )
        
        logger.info(f"✅ Publisher {current_user.get('username')} removed promo code: {user_promo['code']}")
        
        return jsonify({
            'message': 'Promo code removed successfully'
        }), 200
        
    except Exception as e:
        logger.error(f"❌ Error removing promo code: {str(e)}")
        return jsonify({'error': f'Error removing code: {str(e)}'}), 500


@publisher_promo_codes_bp.route('/api/publisher/promo-codes/earnings', methods=['GET'])
@token_required
def get_bonus_earnings():
    """Get user's bonus earnings from promo codes"""
    try:
        current_user = request.current_user
        
        # Get filter params
        code_filter = request.args.get('code')
        status = request.args.get('status')
        
        # Get pagination params
        page = request.args.get('page', 1, type=int)
        limit = request.args.get('limit', 20, type=int)
        skip = (page - 1) * limit
        
        collection = db_instance.get_collection('bonus_earnings')
        if collection is None:
            return jsonify({'error': 'Database connection failed'}), 500
        
        # Build query
        query = {'user_id': ObjectId(current_user['_id'])}
        if status:
            query['status'] = status
        
        # Get total count
        total = collection.count_documents(query)
        
        # Get earnings
        earnings = list(collection.find(query)
                       .sort('created_at', -1)
                       .skip(skip)
                       .limit(limit))
        
        # Convert ObjectIds to strings
        for earning in earnings:
            earning['_id'] = str(earning['_id'])
            earning['user_id'] = str(earning['user_id'])
            earning['promo_code_id'] = str(earning['promo_code_id'])
            earning['offer_id'] = str(earning['offer_id'])
            earning['conversion_id'] = str(earning['conversion_id'])
        
        # Calculate totals
        totals = list(collection.aggregate([
            {'$match': {'user_id': ObjectId(current_user['_id'])}},
            {'$group': {
                '_id': None,
                'total_bonus': {'$sum': '$bonus_amount'},
                'total_conversions': {'$sum': 1},
                'pending_bonus': {
                    '$sum': {
                        '$cond': [{'$eq': ['$status', 'pending']}, '$bonus_amount', 0]
                    }
                },
                'credited_bonus': {
                    '$sum': {
                        '$cond': [{'$eq': ['$status', 'credited']}, '$bonus_amount', 0]
                    }
                }
            }}
        ]))
        
        total_stats = totals[0] if totals else {
            'total_bonus': 0,
            'total_conversions': 0,
            'pending_bonus': 0,
            'credited_bonus': 0
        }
        
        return jsonify({
            'earnings': earnings,
            'totals': {
                'total_bonus_earned': total_stats.get('total_bonus', 0),
                'total_conversions': total_stats.get('total_conversions', 0),
                'pending_bonus': total_stats.get('pending_bonus', 0),
                'credited_bonus': total_stats.get('credited_bonus', 0)
            },
            'pagination': {
                'page': page,
                'limit': limit,
                'total': total,
                'pages': (total + limit - 1) // limit
            }
        }), 200
        
    except Exception as e:
        logger.error(f"❌ Error fetching bonus earnings: {str(e)}")
        return jsonify({'error': f'Error fetching earnings: {str(e)}'}), 500


@publisher_promo_codes_bp.route('/api/publisher/promo-codes/balance', methods=['GET'])
@token_required
def get_bonus_balance():
    """Get user's current bonus balance"""
    try:
        current_user = request.current_user
        
        collection = db_instance.get_collection('bonus_earnings')
        if collection is None:
            return jsonify({'error': 'Database connection failed'}), 500
        
        # Calculate balance
        balance_data = list(collection.aggregate([
            {'$match': {'user_id': ObjectId(current_user['_id'])}},
            {'$group': {
                '_id': None,
                'total_earned': {'$sum': '$bonus_amount'},
                'pending': {
                    '$sum': {
                        '$cond': [{'$eq': ['$status', 'pending']}, '$bonus_amount', 0]
                    }
                },
                'credited': {
                    '$sum': {
                        '$cond': [{'$eq': ['$status', 'credited']}, '$bonus_amount', 0]
                    }
                }
            }}
        ]))
        
        if balance_data:
            balance = balance_data[0]
        else:
            balance = {
                'total_earned': 0,
                'pending': 0,
                'credited': 0
            }
        
        return jsonify({
            'bonus_balance': {
                'total_earned': balance.get('total_earned', 0),
                'pending': balance.get('pending', 0),
                'credited': balance.get('credited', 0),
                'available': balance.get('credited', 0)
            }
        }), 200
        
    except Exception as e:
        logger.error(f"❌ Error fetching bonus balance: {str(e)}")
        return jsonify({'error': f'Error fetching balance: {str(e)}'}), 500
