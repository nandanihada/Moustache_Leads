from flask import Blueprint, request, jsonify
from utils.auth import token_required
from models.promo_code import PromoCode
from database import db_instance
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

promo_v2_bp = Blueprint('promo_v2', __name__)

@promo_v2_bp.route('/api/promo/redeem', methods=['POST'])
@token_required
def redeem_promo_code_v2():
    try:
        current_user = request.current_user
        data = request.get_json()
        
        if not data or 'code' not in data:
            return jsonify({'success': False, 'error': 'Promo code is required'}), 400
            
        code = data['code'].strip().upper()
        
        if not code:
            return jsonify({'success': False, 'error': 'Promo code cannot be empty'}), 400
            
        promo_code_model = PromoCode()
        
        code_obj = promo_code_model.get_promo_code_by_code(code)
        
        if not code_obj:
            return jsonify({'success': False, 'error': 'Invalid or inactive promo code.'}), 404
            
        user_promo_doc, error = promo_code_model.apply_code_to_user(code, current_user['_id'])
        
        if error:
            return jsonify({'success': False, 'error': error}), 400
            
        return jsonify({
            'success': True,
            'message': f'Promo code {code} applied successfully!'
        }), 200
        
    except Exception as e:
        logger.error(f"Error redeeming promo code v2: {str(e)}")
        return jsonify({'success': False, 'error': 'Internal server error'}), 500

@promo_v2_bp.route('/api/analytics/promo', methods=['POST'])
@token_required
def track_promo_analytics():
    try:
        current_user = request.current_user
        data = request.get_json()
        
        if not data or 'event_type' not in data:
            return jsonify({'error': 'event_type is required'}), 400
            
        collection = db_instance.get_collection('promo_analytics_v2')
        if collection is None:
            return jsonify({'error': 'Database connect error'}), 500
            
        doc = {
            'user_id': current_user['_id'],
            'username': current_user.get('username'),
            'event_type': data.get('event_type'),
            'promo_code': data.get('promoCode'),
            'status': data.get('status'),
            'failure_reason': data.get('failureReason'),
            'timestamp': datetime.utcnow()
        }
        
        collection.insert_one(doc)
        
        return jsonify({'success': True}), 200
        
    except Exception as e:
        logger.error(f"Error tracking promo analytics v2: {str(e)}")
        return jsonify({'error': str(e)}), 500

@promo_v2_bp.route('/api/admin/promo-analytics-v2/logs', methods=['GET'])
@token_required
def get_promo_v2_logs():
    try:
        current_user = request.current_user
        if current_user.get('role') != 'admin':
            return jsonify({'error': 'Unauthorized'}), 403
            
        collection = db_instance.get_collection('promo_analytics_v2')
        if collection is None:
            return jsonify({'error': 'Database connect error'}), 500
            
        logs = list(collection.find().sort('timestamp', -1).limit(100))
        for log in logs:
            log['_id'] = str(log['_id'])
            log['user_id'] = str(log['user_id'])
            
        return jsonify({'logs': logs}), 200
    except Exception as e:
        logger.error(f"Error fetching logs: {str(e)}")
        return jsonify({'error': str(e)}), 500
