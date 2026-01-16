"""
Test Postback Routes
Allows admins to send test postbacks to registered users/publishers for integration testing
"""

from flask import Blueprint, request, jsonify
from database import db_instance
from utils.auth import token_required
from bson import ObjectId
import logging
import requests
import time
from datetime import datetime
from threading import Thread
from typing import Dict, List, Any

test_postback_bp = Blueprint('test_postback', __name__)
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

def send_test_postback(user_id: str, username: str, offer_name: str, points: float, delay_seconds: int, test_id: str, iteration: int):
    """
    Send a test postback after specified delay
    Runs in background thread
    """
    try:
        # Wait for specified delay
        if delay_seconds > 0:
            logger.info(f"⏳ Waiting {delay_seconds} seconds before sending test postback (iteration {iteration})...")
            time.sleep(delay_seconds)
        
        # Get user/publisher details (downward partner)
        users_collection = db_instance.get_collection('users')
        user = users_collection.find_one({'_id': ObjectId(user_id)})
        
        if not user:
            logger.error(f"❌ User/Publisher not found: {user_id}")
            _log_test_postback(test_id, user_id, username, offer_name, points, False, "User/Publisher not found", iteration)
            return
        
        postback_url = user.get('postback_url', '')
        method = user.get('postback_method', 'GET').upper()
        
        if not postback_url:
            logger.error(f"❌ No postback URL configured for user: {user.get('username')}")
            _log_test_postback(test_id, user_id, username, offer_name, points, False, "No postback URL", iteration)
            return
        
        # Build test data
        test_data = {
            'user_id': username,
            'username': username,
            'offer_name': offer_name,
            'offer_id': f'test_offer_{int(time.time())}',
            'points': str(points),
            'payout': str(points),
            'status': 'approved',
            'conversion_id': f'test_conv_{int(time.time())}',
            'transaction_id': f'test_txn_{int(time.time())}',
            'click_id': f'test_click_{int(time.time())}',
            'timestamp': str(int(time.time())),
            'test_mode': 'true'
        }
        
        # Replace macros in URL
        final_url = postback_url
        for key, value in test_data.items():
            final_url = final_url.replace(f'{{{key}}}', str(value))
        
        logger.info(f"📤 Sending test postback #{iteration} to {user.get('username')} ({method}): {final_url}")
        
        # Send request
        start_time = time.time()
        
        try:
            if method == 'POST':
                response = requests.post(
                    final_url,
                    json=test_data,
                    timeout=10,
                    headers={
                        'User-Agent': 'MoustacheLeads-Test-Postback/1.0',
                        'Content-Type': 'application/json'
                    }
                )
            else:  # GET
                import urllib.parse
                parsed = urllib.parse.urlparse(final_url)
                existing_params = urllib.parse.parse_qs(parsed.query)
                
                for key, value in test_data.items():
                    existing_params[key] = [str(value)]
                
                new_query = urllib.parse.urlencode(existing_params, doseq=True)
                final_url_with_params = urllib.parse.urlunparse((
                    parsed.scheme, parsed.netloc, parsed.path,
                    parsed.params, new_query, parsed.fragment
                ))
                
                response = requests.get(
                    final_url_with_params,
                    timeout=10,
                    headers={'User-Agent': 'MoustacheLeads-Test-Postback/1.0'}
                )
            
            response_time = time.time() - start_time
            success = 200 <= response.status_code < 300
            
            if success:
                logger.info(f"✅ Test postback sent successfully - Status: {response.status_code}")
            else:
                logger.warning(f"⚠️ Test postback failed - Status: {response.status_code}")
            
            _log_test_postback(
                test_id, user_id, username, offer_name, points,
                success, None, response.status_code, response.text[:500], response_time, iteration
            )
            
        except requests.RequestException as e:
            logger.error(f"❌ Error sending test postback: {str(e)}")
            _log_test_postback(test_id, user_id, username, offer_name, points, False, str(e), iteration=iteration)
    
    except Exception as e:
        logger.error(f"❌ Error in send_test_postback: {str(e)}", exc_info=True)
        _log_test_postback(test_id, user_id, username, offer_name, points, False, str(e), iteration=iteration)

def _log_test_postback(
    test_id: str,
    user_id: str,
    username: str,
    offer_name: str,
    points: float,
    success: bool,
    error: str = None,
    status_code: int = None,
    response_body: str = None,
    response_time: float = None,
    iteration: int = 1
):
    """Log test postback to database"""
    try:
        test_logs_collection = db_instance.get_collection('test_postback_logs')
        
        log_entry = {
            'test_id': test_id,
            'user_id': user_id,
            'username': username,
            'offer_name': offer_name,
            'points': points,
            'success': success,
            'error': error,
            'status_code': status_code,
            'response_body': response_body,
            'response_time': response_time,
            'iteration': iteration,
            'timestamp': datetime.utcnow()
        }
        
        test_logs_collection.insert_one(log_entry)
        
    except Exception as e:
        logger.error(f"❌ Error logging test postback: {str(e)}", exc_info=True)

@test_postback_bp.route('/test-postback/send', methods=['POST'])
@token_required
@admin_required
def send_test_postbacks():
    """
    Send test postbacks to multiple registered users/publishers
    Expects array of test postback configurations
    """
    try:
        data = request.get_json()
        
        if not data or 'postbacks' not in data:
            return jsonify({'error': 'Missing postbacks array'}), 400
        
        postbacks = data['postbacks']
        
        if not isinstance(postbacks, list) or len(postbacks) == 0:
            return jsonify({'error': 'postbacks must be a non-empty array'}), 400
        
        # Validate each postback
        for idx, pb in enumerate(postbacks):
            if 'user_id' not in pb:
                return jsonify({'error': f'Missing user_id in postback {idx}'}), 400
            if 'username' not in pb:
                return jsonify({'error': f'Missing username in postback {idx}'}), 400
            if 'offer_name' not in pb:
                return jsonify({'error': f'Missing offer_name in postback {idx}'}), 400
            if 'points' not in pb:
                return jsonify({'error': f'Missing points in postback {idx}'}), 400
            if 'count' not in pb:
                return jsonify({'error': f'Missing count in postback {idx}'}), 400
            if 'interval_seconds' not in pb:
                pb['interval_seconds'] = 0
        
        # Verify all users exist and have postback URLs
        users_collection = db_instance.get_collection('users')
        for idx, pb in enumerate(postbacks):
            user = users_collection.find_one({'_id': ObjectId(pb['user_id'])})
            if not user:
                return jsonify({'error': f'User/Publisher not found for postback {idx}'}), 404
            if not user.get('postback_url'):
                return jsonify({'error': f'User/Publisher {user.get("username")} does not have a postback URL configured'}), 400
        
        # Generate test ID
        test_id = f"test_{int(time.time())}"
        
        total_scheduled = 0
        
        # Start background threads for each postback configuration
        for pb in postbacks:
            count = int(pb['count'])
            interval_seconds = int(pb['interval_seconds'])
            
            # Create iterations for this publisher
            for i in range(count):
                delay = i * interval_seconds  # First one at 0, then interval, then 2*interval, etc.
                thread = Thread(
                    target=send_test_postback,
                    args=(
                        pb['user_id'],
                        pb['username'],
                        pb['offer_name'],
                        float(pb['points']),
                        delay,
                        test_id,
                        i + 1  # Iteration number (1-based)
                    )
                )
                thread.daemon = True
                thread.start()
                total_scheduled += 1
        
        logger.info(f"✅ Started {total_scheduled} test postback(s) - Test ID: {test_id}")
        
        return jsonify({
            'message': f'Test postbacks scheduled successfully',
            'test_id': test_id,
            'total_postbacks': total_scheduled,
            'publishers_count': len(postbacks)
        }), 200
        
    except Exception as e:
        logger.error(f"❌ Error in send_test_postbacks: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500

@test_postback_bp.route('/test-postback/publishers', methods=['GET'])
@token_required
@admin_required
def get_publishers_with_postback():
    """Get all registered users/publishers with postback URLs configured"""
    try:
        users_collection = db_instance.get_collection('users')
        
        # Find users with postback URLs (these are downward partners/publishers)
        users = list(users_collection.find({
            'postback_url': {'$exists': True, '$ne': ''},
            'role': {'$ne': 'admin'}  # Exclude admins
        }).sort('username', 1))
        
        # Format response
        publishers = []
        for user in users:
            publishers.append({
                'user_id': str(user['_id']),
                'username': user.get('username', 'Unknown'),
                'email': user.get('email', ''),
                'postback_url': user.get('postback_url', ''),
                'postback_method': user.get('postback_method', 'GET'),
                'status': user.get('status', 'active')
            })
        
        return jsonify({
            'publishers': publishers,
            'total': len(publishers)
        }), 200
        
    except Exception as e:
        logger.error(f"❌ Error fetching publishers: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500

@test_postback_bp.route('/test-postback/logs', methods=['GET'])
@token_required
@admin_required
def get_test_postback_logs():
    """Get test postback logs"""
    try:
        test_logs_collection = db_instance.get_collection('test_postback_logs')
        
        # Get query parameters
        test_id = request.args.get('test_id')
        limit = int(request.args.get('limit', 100))
        
        # Build query
        query = {}
        if test_id:
            query['test_id'] = test_id
        
        # Fetch logs
        logs = list(test_logs_collection.find(query).sort('timestamp', -1).limit(limit))
        
        # Convert ObjectId to string
        for log in logs:
            log['_id'] = str(log['_id'])
        
        return jsonify({
            'logs': logs,
            'total': len(logs)
        }), 200
        
    except Exception as e:
        logger.error(f"❌ Error fetching test postback logs: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500

@test_postback_bp.route('/test-postback/logs/<test_id>', methods=['GET'])
@token_required
@admin_required
def get_test_postback_logs_by_id(test_id):
    """Get test postback logs for a specific test ID"""
    try:
        test_logs_collection = db_instance.get_collection('test_postback_logs')
        
        # Fetch logs for this test
        logs = list(test_logs_collection.find({'test_id': test_id}).sort('timestamp', 1))
        
        # Convert ObjectId to string
        for log in logs:
            log['_id'] = str(log['_id'])
        
        # Calculate summary
        total = len(logs)
        successful = sum(1 for log in logs if log.get('success'))
        failed = total - successful
        
        return jsonify({
            'test_id': test_id,
            'logs': logs,
            'summary': {
                'total': total,
                'successful': successful,
                'failed': failed
            }
        }), 200
        
    except Exception as e:
        logger.error(f"❌ Error fetching test logs: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500
