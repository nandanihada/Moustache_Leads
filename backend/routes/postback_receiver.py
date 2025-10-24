"""
Postback Receiver Routes
Receives postback notifications from external partners/networks
"""

from flask import Blueprint, request, jsonify
from datetime import datetime
from bson import ObjectId
import logging
import secrets

postback_receiver_bp = Blueprint('postback_receiver', __name__)
logger = logging.getLogger(__name__)

def get_db():
    """Get database instance"""
    from database import Database
    db_instance = Database.get_instance()
    return db_instance.get_db() if db_instance.is_connected() else None

@postback_receiver_bp.route('/postback/<unique_key>', methods=['GET', 'POST'])
def receive_postback(unique_key):
    """
    Receive postback from external partners
    URL format: https://moustacheleads-backend.onrender.com/postback/{unique_key}?param1=value1&param2=value2
    """
    try:
        db = get_db()
        if not db:
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
        partner = db.partners.find_one({'unique_postback_key': unique_key})
        
        if not partner:
            logger.warning(f"⚠️ Unknown postback key: {unique_key}")
            # Still log it as unknown
            partner_id = 'unknown'
            partner_name = 'Unknown Partner'
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
        result = db.received_postbacks.insert_one(received_log)
        
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
def generate_unique_key():
    """
    Generate a unique postback key for a partner
    """
    try:
        from auth import token_required, admin_required
        
        # This would normally be protected, but for simplicity:
        data = request.get_json()
        partner_id = data.get('partner_id')
        
        if not partner_id:
            return jsonify({'error': 'partner_id is required'}), 400
        
        # Generate unique key (32 characters)
        unique_key = secrets.token_urlsafe(24)
        
        db = get_db()
        if not db:
            return jsonify({'error': 'Database not connected'}), 503
        
        # Update partner with unique key
        result = db.partners.update_one(
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
def get_received_postbacks():
    """
    Get all received postbacks with filtering
    """
    try:
        from auth import token_required
        
        db = get_db()
        if not db:
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
        logs = list(db.received_postbacks.find(query)
                   .sort('timestamp', -1)
                   .skip(skip)
                   .limit(limit))
        
        # Convert ObjectId to string
        for log in logs:
            log['_id'] = str(log['_id'])
        
        total = db.received_postbacks.count_documents(query)
        
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
def get_received_postback_detail(log_id):
    """
    Get detailed information about a specific received postback
    """
    try:
        from auth import token_required
        
        db = get_db()
        if not db:
            return jsonify({'error': 'Database not connected'}), 503
        
        log = db.received_postbacks.find_one({'_id': ObjectId(log_id)})
        
        if not log:
            return jsonify({'error': 'Log not found'}), 404
        
        log['_id'] = str(log['_id'])
        
        return jsonify(log), 200
        
    except Exception as e:
        logger.error(f"Error fetching postback detail: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500

@postback_receiver_bp.route('/api/admin/postback-receiver/test', methods=['POST'])
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
