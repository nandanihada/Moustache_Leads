from flask import Blueprint, request, jsonify
from models.api_keys_model import ApiKeyModel
from models.api_stats_model import ApiStatsModel
from models.api_conversions_model import ApiConversionsModel
import logging
from functools import wraps

logger = logging.getLogger(__name__)

api_tracking_bp = Blueprint('api_tracking', __name__)

api_keys_model = ApiKeyModel()
stats_model = ApiStatsModel()
conversions_model = ApiConversionsModel()

def require_api_key(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('apikey '):
            return jsonify({'error': 'Missing or invalid Authorization header. Format: apikey <your-key>'}), 401
            
        api_key_value = auth_header.split(' ')[1]
        key_doc = api_keys_model.verify_api_key(api_key_value)
        
        if not key_doc:
            return jsonify({'error': 'Invalid or inactive API key'}), 403
            
        # Attach validated key data to request context
        request.api_key_data = key_doc
        return f(*args, **kwargs)
    return decorated

@api_tracking_bp.route('/track/stats', methods=['POST'])
@require_api_key
def track_stats():
    """
    Receive clicks and impressions
    Data payload: 
    { "event_type": "click" | "impression", "traffic_source": "string", "device_type": "mobile"|"desktop" }
    """
    try:
        data = request.get_json() or {}
        event_type = data.get('event_type')
        traffic_source = data.get('traffic_source', 'Unknown')
        device_type = data.get('device_type', 'Unknown')
        
        if event_type not in ['click', 'impression']:
            return jsonify({'error': 'event_type must be click or impression'}), 400
            
        api_key_id = request.api_key_data['_id']
        success = stats_model.track_event(api_key_id, event_type, traffic_source, device_type)
        
        if success:
            return jsonify({'success': True, 'message': f'{event_type} tracked successfully'}), 200
        return jsonify({'error': 'Failed to track event due to database error'}), 500
        
    except Exception as e:
        logger.error(f"Error in track_stats: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

@api_tracking_bp.route('/track/conversion', methods=['POST'])
@require_api_key
def track_conversion():
    """
    Receive conversion/order data
    Data payload: {"order_id": "string", "payout": number}
    """
    try:
        data = request.get_json() or {}
        order_id = data.get('order_id')
        payout = data.get('payout')
        status = data.get('status', 'pending')
        
        if not order_id or payout is None:
            return jsonify({'error': 'order_id and payout are required'}), 400
            
        api_key_id = request.api_key_data['_id']
        conv_doc = conversions_model.track_conversion(api_key_id, order_id, payout, status)
        
        if conv_doc:
            return jsonify({'success': True, 'conversion_id': conv_doc['_id']}), 201
        return jsonify({'error': 'Failed to record conversion'}), 500
        
    except Exception as e:
        logger.error(f"Error in track_conversion: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500
