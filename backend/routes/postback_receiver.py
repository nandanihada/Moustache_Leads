"""
Postback Receiver Routes
Receives postback notifications from external partners/networks
"""

from flask import Blueprint, request, jsonify
from datetime import datetime
from bson import ObjectId
import logging
import secrets
from utils.auth import token_required

postback_receiver_bp = Blueprint('postback_receiver', __name__)
logger = logging.getLogger(__name__)

def admin_required(f):
    """Decorator to require admin role"""
    from functools import wraps
    @wraps(f)
    def decorated_function(*args, **kwargs):
        user = getattr(request, 'current_user', None)
        if not user or user.get('role') != 'admin':
            return jsonify({'error': 'Admin access required'}), 403
        return f(*args, **kwargs)
    return decorated_function

def get_collection(collection_name):
    """Get collection from database instance"""
    from database import db_instance
    if not db_instance.is_connected():
        logger.error("Database not connected")
        return None
    return db_instance.get_collection(collection_name)

@postback_receiver_bp.route('/postback/<unique_key>', methods=['GET', 'POST'])
def receive_postback(unique_key):
    """
    Receive postback from external partners
    URL format: https://moustacheleads-backend.onrender.com/postback/{unique_key}?param1=value1&param2=value2
    """
    try:
        partners_collection = get_collection('partners')
        received_postbacks_collection = get_collection('received_postbacks')
        if partners_collection is None or received_postbacks_collection is None:
            logger.error("Database not connected")
            return jsonify({'status': 'error', 'message': 'Service unavailable'}), 503
        
        # Get all query parameters
        params = dict(request.args)
        
        # Get request info
        method = request.method
        ip_address = request.headers.get('X-Forwarded-For', request.remote_addr)
        user_agent = request.headers.get('User-Agent', '')
        
        # Get POST body if available
        post_data = {}
        if method == 'POST':
            try:
                post_data = request.get_json() or {}
            except:
                post_data = dict(request.form)
        
        logger.info(f"📥 Postback received: key={unique_key}, method={method}, params={params}")
        
        # Find partner by unique key
        partner = partners_collection.find_one({'unique_postback_key': unique_key})
        
        if not partner:
            logger.warning(f"⚠️ Unknown postback key: {unique_key}")
            # Check if this is a standalone postback (no partner association)
            partner_id = f'standalone_{unique_key[:8]}'
            partner_name = 'Standalone Postback'
        else:
            partner_id = partner.get('partner_id', 'unknown')
            partner_name = partner.get('partner_name', 'Unknown')
        
        # Create received postback log
        received_log = {
            'unique_key': unique_key,
            'partner_id': partner_id,
            'partner_name': partner_name,
            'method': method,
            'query_params': params,
            'post_data': post_data,
            'ip_address': ip_address,
            'user_agent': user_agent,
            'timestamp': datetime.utcnow(),
            'status': 'received'
        }
        
        # Insert into received_postbacks collection
        result = received_postbacks_collection.insert_one(received_log)
        
        logger.info(f"✅ Postback logged: {result.inserted_id}")
        
        # Return success response
        return jsonify({
            'status': 'success',
            'message': 'Postback received',
            'log_id': str(result.inserted_id)
        }), 200
        
    except Exception as e:
        logger.error(f"❌ Error receiving postback: {str(e)}", exc_info=True)
        return jsonify({
            'status': 'error',
            'message': 'Internal server error'
        }), 500

@postback_receiver_bp.route('/api/admin/postback-receiver/generate-key', methods=['POST'])
@token_required
@admin_required
def generate_unique_key():
    """
    Generate a unique postback key for a partner
    """
    try:
        data = request.get_json()
        partner_id = data.get('partner_id')
        
        if not partner_id:
            return jsonify({'error': 'partner_id is required'}), 400
        
        # Generate unique key (32 characters)
        unique_key = secrets.token_urlsafe(24)
        
        partners_collection = get_collection('partners')
        if partners_collection is None:
            return jsonify({'error': 'Database not connected'}), 503
        
        # Update partner with unique key
        result = partners_collection.update_one(
            {'partner_id': partner_id},
            {
                '$set': {
                    'unique_postback_key': unique_key,
                    'postback_receiver_url': f"https://moustacheleads-backend.onrender.com/postback/{unique_key}",
                    'updated_at': datetime.utcnow()
                }
            }
        )
        
        if result.modified_count == 0:
            return jsonify({'error': 'Partner not found or not updated'}), 404
        
        logger.info(f"✅ Generated unique key for partner: {partner_id}")
        
        return jsonify({
            'success': True,
            'unique_key': unique_key,
            'postback_url': f"https://moustacheleads-backend.onrender.com/postback/{unique_key}"
        }), 200
        
    except Exception as e:
        logger.error(f"Error generating key: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500

@postback_receiver_bp.route('/api/admin/received-postbacks', methods=['GET'])
@token_required
@admin_required
def get_received_postbacks():
    """
    Get all received postbacks with filtering
    """
    try:
        received_postbacks_collection = get_collection('received_postbacks')
        if received_postbacks_collection is None:
            return jsonify({'error': 'Database not connected'}), 503
        
        # Get query parameters
        partner_id = request.args.get('partner_id')
        unique_key = request.args.get('unique_key')
        limit = int(request.args.get('limit', 50))
        skip = int(request.args.get('skip', 0))
        
        # Build query
        query = {}
        if partner_id:
            query['partner_id'] = partner_id
        if unique_key:
            query['unique_key'] = unique_key
        
        # Get logs
        logs = list(received_postbacks_collection.find(query)
                   .sort('timestamp', -1)
                   .skip(skip)
                   .limit(limit))
        
        # Convert ObjectId to string
        for log in logs:
            log['_id'] = str(log['_id'])
        
        total = received_postbacks_collection.count_documents(query)
        
        return jsonify({
            'logs': logs,
            'total': total,
            'limit': limit,
            'skip': skip
        }), 200
        
    except Exception as e:
        logger.error(f"Error fetching received postbacks: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500

@postback_receiver_bp.route('/api/admin/received-postbacks/<log_id>', methods=['GET'])
@token_required
@admin_required
def get_received_postback_detail(log_id):
    """
    Get detailed information about a specific received postback
    """
    try:
        received_postbacks_collection = get_collection('received_postbacks')
        if received_postbacks_collection is None:
            return jsonify({'error': 'Database not connected'}), 503
        
        log = received_postbacks_collection.find_one({'_id': ObjectId(log_id)})
        
        if not log:
            return jsonify({'error': 'Log not found'}), 404
        
        log['_id'] = str(log['_id'])
        
        return jsonify(log), 200
        
    except Exception as e:
        logger.error(f"Error fetching postback detail: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500

@postback_receiver_bp.route('/api/admin/postback-receiver/generate-quick', methods=['POST'])
@token_required
@admin_required
def generate_quick_postback():
    """
    Generate a quick postback URL without requiring a partner
    """
    try:
        data = request.get_json()
        parameters = data.get('parameters', [])
        custom_params = data.get('custom_params', [])
        partner_name = data.get('partner_name', 'Quick Generated')
        
        # Generate unique key (32 characters)
        unique_key = secrets.token_urlsafe(24)
        
        # Build base URL
        base_url = f"https://moustacheleads-backend.onrender.com/postback/{unique_key}"
        
        # Build full URL with parameters
        all_params = parameters + custom_params
        if all_params:
            import urllib.parse
            param_dict = {}
            for param in all_params:
                if param.strip():
                    param_dict[param.strip()] = f"{{{param.strip()}}}"
            
            query_string = urllib.parse.urlencode(param_dict)
            full_url = f"{base_url}?{query_string}"
        else:
            full_url = base_url
        
        logger.info(f"✅ Generated quick postback URL: {unique_key}")
        
        return jsonify({
            'success': True,
            'unique_key': unique_key,
            'base_url': base_url,
            'full_url': full_url,
            'parameters': all_params,
            'partner_name': partner_name
        }), 200
        
    except Exception as e:
        logger.error(f"Error generating quick postback: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500

@postback_receiver_bp.route('/api/admin/postback-receiver/test-quick', methods=['POST'])
@token_required
@admin_required
def test_quick_postback():
    """
    Test a quick postback URL with sample data
    """
    try:
        data = request.get_json()
        unique_key = data.get('unique_key')
        test_params = data.get('params', {})
        
        if not unique_key:
            return jsonify({'error': 'unique_key is required'}), 400
        
        # Build test URL
        base_url = f"https://moustacheleads-backend.onrender.com/postback/{unique_key}"
        
        # Add test parameters
        import urllib.parse
        if test_params:
            query_string = urllib.parse.urlencode(test_params)
            test_url = f"{base_url}?{query_string}"
        else:
            test_url = base_url
        
        logger.info(f"🧪 Test quick postback URL: {test_url}")
        
        return jsonify({
            'success': True,
            'test_url': test_url,
            'message': 'Use this URL to test postback reception'
        }), 200
        
    except Exception as e:
        logger.error(f"Error testing quick postback: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500

@postback_receiver_bp.route('/api/admin/postback-receiver/test', methods=['POST'])
@token_required
@admin_required
def test_postback_receiver():
    """
    Test the postback receiver with sample data
    """
    try:
        data = request.get_json()
        unique_key = data.get('unique_key')
        test_params = data.get('params', {})
        
        if not unique_key:
            return jsonify({'error': 'unique_key is required'}), 400
        
        # Build test URL
        base_url = f"https://moustacheleads-backend.onrender.com/postback/{unique_key}"
        
        # Add test parameters
        import urllib.parse
        if test_params:
            query_string = urllib.parse.urlencode(test_params)
            test_url = f"{base_url}?{query_string}"
        else:
            test_url = base_url
        
        logger.info(f"🧪 Test postback URL: {test_url}")
        
        return jsonify({
            'success': True,
            'test_url': test_url,
            'message': 'Use this URL to test postback reception'
        }), 200
        
    except Exception as e:
        logger.error(f"Error testing postback: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500
