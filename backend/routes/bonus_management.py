"""
Bonus Management Routes
Admin and publisher endpoints for managing bonus earnings
"""

from flask import Blueprint, request, jsonify
from database import db_instance
from services.bonus_calculation_service import BonusCalculationService
from utils.auth import token_required, admin_required, subadmin_or_admin_required
from bson import ObjectId
import logging

logger = logging.getLogger(__name__)

bonus_management_bp = Blueprint('bonus_management', __name__)
bonus_service = BonusCalculationService()


@bonus_management_bp.route('/api/admin/bonus/process-pending', methods=['POST'])
@token_required
@subadmin_or_admin_required('bonus-management')
def process_pending_bonuses():
    """Process pending bonus calculations for all conversions"""
    try:
        limit = request.args.get('limit', 100, type=int)
        
        result = bonus_service.process_pending_bonuses(limit=limit)
        
        if 'error' in result:
            return jsonify(result), 500
        
        logger.info(f"✅ Processed {result['processed']} pending bonuses")
        
        return jsonify(result), 200
        
    except Exception as e:
        logger.error(f"❌ Error processing pending bonuses: {str(e)}")
        return jsonify({'error': str(e)}), 500


@bonus_management_bp.route('/api/admin/bonus/conversion/<conversion_id>', methods=['GET'])
@token_required
@subadmin_or_admin_required('bonus-management')
def get_conversion_bonus(conversion_id):
    """Get bonus details for a specific conversion"""
    try:
        result = bonus_service.calculate_bonus_for_conversion(conversion_id)
        
        if 'error' in result:
            return jsonify(result), 404
        
        return jsonify(result), 200
        
    except Exception as e:
        logger.error(f"❌ Error getting conversion bonus: {str(e)}")
        return jsonify({'error': str(e)}), 500


@bonus_management_bp.route('/api/admin/bonus/user/<user_id>/summary', methods=['GET'])
@subadmin_or_admin_required('bonus-management')
def get_user_bonus_summary(user_id):
    """Get bonus summary for a user"""
    try:
        summary = bonus_service.get_user_bonus_summary(user_id)
        
        if 'error' in summary:
            return jsonify(summary), 500
        
        return jsonify(summary), 200
        
    except Exception as e:
        logger.error(f"❌ Error getting user bonus summary: {str(e)}")
        return jsonify({'error': str(e)}), 500


@bonus_management_bp.route('/api/admin/bonus/earnings', methods=['GET'])
@token_required
@subadmin_or_admin_required('bonus-management')
def list_bonus_earnings():
    """List all bonus earnings with filtering"""
    try:
        # Get filter params
        user_id = request.args.get('user_id')
        status = request.args.get('status')  # pending, credited, reversed
        page = request.args.get('page', 1, type=int)
        limit = request.args.get('limit', 50, type=int)
        skip = (page - 1) * limit
        
        collection = db_instance.get_collection('bonus_earnings')
        
        # Build query
        query = {}
        if user_id:
            query['user_id'] = ObjectId(user_id)
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
        
        return jsonify({
            'bonus_earnings': earnings,
            'total': total,
            'page': page,
            'limit': limit,
            'pages': (total + limit - 1) // limit
        }), 200
        
    except Exception as e:
        logger.error(f"❌ Error listing bonus earnings: {str(e)}")
        return jsonify({'error': str(e)}), 500


@bonus_management_bp.route('/api/admin/bonus/credit/<conversion_id>', methods=['POST'])
@subadmin_or_admin_required('bonus-management')
def credit_bonus_manually(conversion_id):
    """Manually credit bonus to user's balance"""
    try:
        result = bonus_service.credit_bonus_to_user_balance(conversion_id)
        
        if 'error' in result:
            return jsonify(result), 400
        
        logger.info(f"✅ Bonus credited for conversion {conversion_id}")
        
        return jsonify(result), 200
        
    except Exception as e:
        logger.error(f"❌ Error crediting bonus: {str(e)}")
        return jsonify({'error': str(e)}), 500


@bonus_management_bp.route('/api/admin/bonus/statistics', methods=['GET'])
@token_required
@subadmin_or_admin_required('bonus-management')
def get_bonus_statistics():
    """Get overall bonus statistics"""
    try:
        collection = db_instance.get_collection('bonus_earnings')
        
        # Get statistics
        stats = list(collection.aggregate([
            {
                '$group': {
                    '_id': None,
                    'total_bonus': {'$sum': '$bonus_amount'},
                    'pending_bonus': {
                        '$sum': {
                            '$cond': [{'$eq': ['$status', 'pending']}, '$bonus_amount', 0]
                        }
                    },
                    'credited_bonus': {
                        '$sum': {
                            '$cond': [{'$eq': ['$status', 'credited']}, '$bonus_amount', 0]
                        }
                    },
                    'reversed_bonus': {
                        '$sum': {
                            '$cond': [{'$eq': ['$status', 'reversed']}, '$bonus_amount', 0]
                        }
                    },
                    'total_earnings': {'$sum': 1},
                    'unique_users': {'$addToSet': '$user_id'},
                    'unique_codes': {'$addToSet': '$code'}
                }
            }
        ]))
        
        if stats:
            stat = stats[0]
            stat['unique_users_count'] = len(stat.get('unique_users', []))
            stat['unique_codes_count'] = len(stat.get('unique_codes', []))
            del stat['unique_users']
            del stat['unique_codes']
        else:
            stat = {
                'total_bonus': 0,
                'pending_bonus': 0,
                'credited_bonus': 0,
                'reversed_bonus': 0,
                'total_earnings': 0,
                'unique_users_count': 0,
                'unique_codes_count': 0
            }
        
        return jsonify(stat), 200
        
    except Exception as e:
        logger.error(f"❌ Error getting bonus statistics: {str(e)}")
        return jsonify({'error': str(e)}), 500


@bonus_management_bp.route('/api/publisher/bonus/summary', methods=['GET'])
@token_required
def get_my_bonus_summary():
    """Get current user's bonus summary"""
    try:
        current_user = request.current_user
        user_id = str(current_user['_id'])
        
        summary = bonus_service.get_user_bonus_summary(user_id)
        
        if 'error' in summary:
            return jsonify(summary), 500
        
        return jsonify(summary), 200
        
    except Exception as e:
        logger.error(f"❌ Error getting bonus summary: {str(e)}")
        return jsonify({'error': str(e)}), 500


@bonus_management_bp.route('/api/publisher/bonus/earnings', methods=['GET'])
@token_required
def get_my_bonus_earnings():
    """Get current user's bonus earnings"""
    try:
        current_user = request.current_user
        
        # Get filter params
        status = request.args.get('status')  # pending, credited, reversed
        page = request.args.get('page', 1, type=int)
        limit = request.args.get('limit', 20, type=int)
        skip = (page - 1) * limit
        
        collection = db_instance.get_collection('bonus_earnings')
        
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
        
        return jsonify({
            'bonus_earnings': earnings,
            'total': total,
            'page': page,
            'limit': limit,
            'pages': (total + limit - 1) // limit
        }), 200
        
    except Exception as e:
        logger.error(f"❌ Error getting bonus earnings: {str(e)}")
        return jsonify({'error': str(e)}), 500
