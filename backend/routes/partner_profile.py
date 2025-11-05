"""
Partner Profile Routes
Endpoints for partners to manage their profiles and test postbacks
"""

from flask import Blueprint, request, jsonify
from utils.auth import token_required
import logging
import requests

partner_profile_bp = Blueprint('partner_profile', __name__)
logger = logging.getLogger(__name__)

def partner_required(f):
    """Decorator to require partner role"""
    from functools import wraps
    @wraps(f)
    def decorated_function(*args, **kwargs):
        user = getattr(request, 'current_user', None)
        if not user or user.get('role') not in ['partner', 'admin']:
            return jsonify({'error': 'Partner access required'}), 403
        return f(*args, **kwargs)
    return decorated_function

@partner_profile_bp.route('/partner/test-postback', methods=['POST'])
@token_required
@partner_required
def test_partner_postback():
    """Test partner's postback URL with sample data"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        postback_url = data.get('postback_url')
        method = data.get('method', 'GET')
        
        if not postback_url:
            return jsonify({'error': 'Postback URL is required'}), 400
        
        # Sample test data
        test_data = {
            'click_id': 'test_click_123456',
            'status': 'approved',
            'payout': '10.50',
            'offer_id': 'test_offer_789',
            'conversion_id': 'test_conv_abc',
            'transaction_id': 'test_txn_xyz'
        }
        
        # Replace macros in postback URL
        test_url = postback_url
        for key, value in test_data.items():
            test_url = test_url.replace(f'{{{key}}}', str(value))
        
        # Send test request
        try:
            if method == 'GET':
                response = requests.get(
                    test_url,
                    timeout=10,
                    headers={'User-Agent': 'PepeLeads-Partner-Test/1.0'}
                )
            else:  # POST
                response = requests.post(
                    test_url,
                    json=test_data,
                    timeout=10,
                    headers={'User-Agent': 'PepeLeads-Partner-Test/1.0'}
                )
            
            logger.info(f"✅ Partner postback test successful: {test_url}")
            
            return jsonify({
                'success': True,
                'test_url': test_url,
                'method': method,
                'status_code': response.status_code,
                'response_body': response.text[:500],  # Limit response size
                'test_data': test_data
            }), 200
            
        except requests.RequestException as e:
            logger.error(f"❌ Partner postback test failed: {str(e)}")
            return jsonify({
                'success': False,
                'test_url': test_url,
                'method': method,
                'error': str(e),
                'test_data': test_data
            }), 200
        
    except Exception as e:
        logger.error(f"Error testing partner postback: {str(e)}")
        return jsonify({'error': str(e)}), 500

@partner_profile_bp.route('/partner/stats', methods=['GET'])
@token_required
@partner_required
def get_partner_stats():
    """Get partner's postback statistics"""
    try:
        from database import db_instance
        user = request.current_user
        
        postback_logs_collection = db_instance.get_collection('postback_logs')
        
        if postback_logs_collection is None:
            return jsonify({'error': 'Database not connected'}), 503
        
        # Get partner's postback logs
        # For now, return dummy data - will be implemented when postback distribution is ready
        stats = {
            'total_postbacks': 0,
            'successful_postbacks': 0,
            'failed_postbacks': 0,
            'success_rate': 0
        }
        
        return jsonify(stats), 200
        
    except Exception as e:
        logger.error(f"Error fetching partner stats: {str(e)}")
        return jsonify({'error': str(e)}), 500

@partner_profile_bp.route('/partner/postback-logs', methods=['GET'])
@token_required
@partner_required
def get_partner_postback_logs():
    """Get partner's recent postback logs"""
    try:
        from database import db_instance
        user = request.current_user
        
        postback_logs_collection = db_instance.get_collection('postback_logs')
        
        if postback_logs_collection is None:
            return jsonify({'error': 'Database not connected'}), 503
        
        # Get query parameters
        limit = int(request.args.get('limit', 50))
        skip = int(request.args.get('skip', 0))
        
        # Query postback logs for this partner
        # For now, return empty array - will be implemented when postback distribution is ready
        logs = []
        total = 0
        
        return jsonify({
            'logs': logs,
            'total': total,
            'limit': limit,
            'skip': skip
        }), 200
        
    except Exception as e:
        logger.error(f"Error fetching partner postback logs: {str(e)}")
        return jsonify({'error': str(e)}), 500
