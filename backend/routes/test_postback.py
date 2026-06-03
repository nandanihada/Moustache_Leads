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

def send_test_postback(user_id: str, username: str, offer_name: str, points: float, delay_seconds: int, test_id: str, iteration: int, click_id: str = '', sub1: str = ''):
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
            'sub1': sub1 or 'test_end_user',
            'offer_name': offer_name,
            'offer_id': f'test_offer_{int(time.time())}',
            'points': str(points),
            'payout': str(points),
            'status': 'approved',
            'conversion_id': f'test_conv_{int(time.time())}',
            'transaction_id': f'test_txn_{int(time.time())}',
            'click_id': click_id or f'test_click_{int(time.time())}',
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
                        i + 1,  # Iteration number (1-based)
                        pb.get('click_id', ''),
                        pb.get('sub1', '')
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
    """Get all users from database (all roles) for simulation and test postback features"""
    try:
        users_collection = db_instance.get_collection('users')
        
        # Optional search query
        search = request.args.get('search', '').strip()
        
        # Build query — return ALL users (all roles)
        query = {}
        if search:
            query['$or'] = [
                {'username': {'$regex': search, '$options': 'i'}},
                {'email': {'$regex': search, '$options': 'i'}}
            ]
        
        # Fetch all users sorted by username
        users = list(users_collection.find(query).sort('username', 1))
        
        # Format response
        publishers = []
        for user in users:
            publishers.append({
                'user_id': str(user['_id']),
                'username': user.get('username', 'Unknown'),
                'email': user.get('email', ''),
                'postback_url': user.get('postback_url', ''),
                'postback_method': user.get('postback_method', 'GET'),
                'status': user.get('status', 'active'),
                'role': user.get('role', 'publisher')
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

@test_postback_bp.route('/test-postback/simulate-conversion', methods=['POST'])
@token_required
@admin_required
def simulate_conversion():
    """
    Simulate a full end-to-end conversion flow.
    Takes a click_id, fires the real postback pipeline, and returns step-by-step results.
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        click_id = data.get('click_id', '').strip()
        payout = data.get('payout')
        override_postback_url = data.get('override_postback_url', '').strip()
        
        if not click_id:
            return jsonify({'error': 'click_id is required'}), 400
        if payout is None or float(payout) <= 0:
            return jsonify({'error': 'payout must be greater than 0'}), 400
        
        payout = float(payout)
        steps = []
        
        # Step 1: Find the click
        clicks_collection = db_instance.get_collection('clicks')
        click = clicks_collection.find_one({'click_id': click_id})
        
        if not click:
            steps.append({'step': 'Find Click', 'status': 'failed', 'detail': f'Click ID "{click_id}" not found in database'})
            return jsonify({'success': False, 'steps': steps}), 404
        
        steps.append({
            'step': 'Find Click',
            'status': 'success',
            'detail': f'Click found — offer_id: {click.get("offer_id", "N/A")}, user: {click.get("user_id", "N/A")}, placement: {click.get("placement_id", "N/A")}'
        })
        
        offer_id = click.get('offer_id', '')
        user_id_from_click = click.get('user_id', '') or click.get('username', '')
        
        # Step 2: Check if click already has a conversion (warn but proceed)
        conversions_collection = db_instance.get_collection('conversions')
        existing_conv = conversions_collection.find_one({'click_id': click_id})
        if existing_conv:
            steps.append({
                'step': 'Duplicate Check',
                'status': 'warning',
                'detail': f'This click already has conversion {existing_conv.get("conversion_id")}. Simulation will be blocked by the pipeline duplicate check. Use a different click_id.'
            })
            return jsonify({'success': False, 'steps': steps, 'error': 'Click already has a conversion'}), 409
        
        steps.append({'step': 'Duplicate Check', 'status': 'success', 'detail': 'No existing conversion for this click'})
        
        # Step 3: Find the partner key to fire the postback through the real pipeline
        # We need the correct partner key to hit the /postback/<key> endpoint
        # Try to match by offer's network first, fallback to any active partner
        partners_collection = db_instance.get_collection('partners')
        
        # First try to find a partner that matches the offer's network
        partner = None
        offers_collection_for_partner = db_instance.get_collection('offers')
        if offers_collection_for_partner is not None and offer_id:
            offer_doc = offers_collection_for_partner.find_one({'offer_id': offer_id})
            if offer_doc:
                offer_network = offer_doc.get('network', '')
                if offer_network:
                    # Try to find partner matching the offer's network name
                    partner = partners_collection.find_one({
                        'status': 'active',
                        'unique_postback_key': {'$exists': True, '$ne': ''},
                        '$or': [
                            {'partner_name': {'$regex': offer_network, '$options': 'i'}},
                            {'partner_id': {'$regex': offer_network, '$options': 'i'}},
                            {'network_domain': {'$regex': offer_network, '$options': 'i'}}
                        ]
                    })
                    if partner:
                        logger.info(f"✅ Matched partner '{partner.get('partner_name')}' for offer network '{offer_network}'")
        
        # Fallback: use any active partner (but prefer non-leadads if possible for test)
        if not partner:
            # Try to find a partner that's NOT the default leadads (for cleaner test labeling)
            all_active = list(partners_collection.find({'status': 'active', 'unique_postback_key': {'$exists': True, '$ne': ''}}).limit(10))
            if len(all_active) > 1:
                # Prefer non-leadads partner
                for p in all_active:
                    if 'leadads' not in p.get('partner_name', '').lower():
                        partner = p
                        break
            if not partner and all_active:
                partner = all_active[0]
        
        if not partner:
            # Create a temporary test partner key
            import secrets as sec
            temp_key = sec.token_urlsafe(24)
            partners_collection.insert_one({
                'partner_id': f'test_sim_{int(time.time())}',
                'partner_name': 'Admin Test Simulation Partner',
                'unique_postback_key': temp_key,
                'status': 'active',
                'is_test_partner': True,
                'created_at': datetime.utcnow()
            })
            partner_key = temp_key
        else:
            partner_key = partner['unique_postback_key']
        
        # Step 4: If override_postback_url is provided, temporarily set it on the user
        users_collection = db_instance.get_collection('users')
        original_postback_url = None
        publisher_user = None
        
        if user_id_from_click:
            try:
                publisher_user = users_collection.find_one({'_id': ObjectId(user_id_from_click)})
            except:
                publisher_user = users_collection.find_one({'username': user_id_from_click})
            
            if not publisher_user:
                # Try via placement
                placement_id = click.get('placement_id', '')
                if placement_id and placement_id != 'default':
                    placements_collection = db_instance.get_collection('placements')
                    try:
                        placement = placements_collection.find_one({'_id': ObjectId(placement_id)})
                    except:
                        placement = None
                    if placement:
                        owner_id = placement.get('created_by') or placement.get('user_id')
                        if owner_id:
                            try:
                                publisher_user = users_collection.find_one({'_id': ObjectId(owner_id)})
                            except:
                                pass
        
        if override_postback_url and publisher_user:
            original_postback_url = publisher_user.get('postback_url', '')
            users_collection.update_one(
                {'_id': publisher_user['_id']},
                {'$set': {'postback_url': override_postback_url}}
            )
            steps.append({
                'step': 'Override Postback URL',
                'status': 'success',
                'detail': f'Temporarily set postback URL to: {override_postback_url}'
            })
        
        # Step 5: Fire the real postback receiver endpoint internally
        transaction_id = f'TEST-{int(time.time())}'
        
        try:
            # Build the internal request to the postback receiver
            # We call the endpoint directly via Flask's test client or internal function
            from flask import current_app
            
            postback_params = {
                'click_id': click_id,
                'payout': str(payout),
                'status': 'approved',
                'offer_id': offer_id,
                'transaction_id': transaction_id,
                'event_type': 'conversion',
                'user_id': user_id_from_click,
                'sub_id1': click.get('sub_id1', ''),
                'sub_id2': click.get('sub_id2', ''),
                'sub_id3': click.get('sub_id3', ''),
            }
            
            # Use Flask test client to fire the real endpoint
            with current_app.test_client() as client:
                resp = client.get(
                    f'/postback/{partner_key}',
                    query_string=postback_params
                )
                
                response_data = resp.get_json() if resp.content_type and 'json' in resp.content_type else {}
                pipeline_success = resp.status_code == 200
            
            if pipeline_success:
                steps.append({
                    'step': 'Postback Pipeline',
                    'status': 'success',
                    'detail': f'Postback processed through real pipeline (status {resp.status_code})'
                })
            else:
                steps.append({
                    'step': 'Postback Pipeline',
                    'status': 'failed',
                    'detail': f'Pipeline returned status {resp.status_code}: {response_data.get("message", "Unknown error")}'
                })
        
        except Exception as pipeline_err:
            steps.append({
                'step': 'Postback Pipeline',
                'status': 'failed',
                'detail': f'Pipeline error: {str(pipeline_err)}'
            })
            pipeline_success = False
        
        # Step 6: Check if conversion was created
        new_conv = conversions_collection.find_one({'click_id': click_id})
        if new_conv:
            # Mark it as admin test simulation
            conversions_collection.update_one(
                {'_id': new_conv['_id']},
                {'$set': {'source': 'admin_test_simulation', 'simulated_at': datetime.utcnow()}}
            )
            steps.append({
                'step': 'Conversion Created',
                'status': 'success',
                'detail': f'Conversion {new_conv.get("conversion_id")} created successfully'
            })
        else:
            steps.append({
                'step': 'Conversion Created',
                'status': 'failed',
                'detail': 'No conversion was created by the pipeline'
            })
        
        # Step 7: Check balance update
        balance_updated = False
        balance_amount = 0
        if new_conv and publisher_user:
            updated_user = users_collection.find_one({'_id': publisher_user['_id']})
            if updated_user:
                old_points = publisher_user.get('total_points', 0) or 0
                new_points = updated_user.get('total_points', 0) or 0
                balance_amount = round(new_points - old_points, 2)
                if balance_amount > 0:
                    balance_updated = True
                    steps.append({
                        'step': 'Balance Updated',
                        'status': 'success',
                        'detail': f'+${balance_amount:.2f} added to {updated_user.get("username", "publisher")}'
                    })
                else:
                    steps.append({
                        'step': 'Balance Updated',
                        'status': 'warning',
                        'detail': f'No balance change detected (old: {old_points}, new: {new_points})'
                    })
        elif new_conv:
            steps.append({
                'step': 'Balance Updated',
                'status': 'warning',
                'detail': 'Could not verify balance update — publisher user not identified'
            })
        
        # Step 8: Check postback forwarding
        forwarded_collection = db_instance.get_collection('forwarded_postbacks')
        fwd_record = forwarded_collection.find_one({'click_id': click_id, 'conversion_id': new_conv.get('conversion_id') if new_conv else ''})
        
        if fwd_record:
            fwd_status = fwd_record.get('forward_status', 'unknown')
            fwd_url = fwd_record.get('forward_url', 'N/A')
            fwd_code = fwd_record.get('response_code', 'N/A')
            
            if fwd_status == 'success':
                steps.append({
                    'step': 'Postback Forwarded',
                    'status': 'success',
                    'detail': f'Forwarded to {fwd_url} ({fwd_code} OK)'
                })
            elif fwd_status == 'no_url':
                steps.append({
                    'step': 'Postback Forwarded',
                    'status': 'warning',
                    'detail': 'Publisher has no postback URL configured — conversion recorded without forwarding'
                })
            else:
                steps.append({
                    'step': 'Postback Forwarded',
                    'status': 'failed',
                    'detail': f'Forward failed to {fwd_url} (status: {fwd_code})'
                })
        elif new_conv:
            # Check if there's a forwarded record by conversion_id
            fwd_record2 = forwarded_collection.find_one({'conversion_id': new_conv.get('conversion_id')})
            if fwd_record2:
                fwd_status = fwd_record2.get('forward_status', 'unknown')
                fwd_url = fwd_record2.get('forward_url', 'N/A')
                fwd_code = fwd_record2.get('response_code', 'N/A')
                steps.append({
                    'step': 'Postback Forwarded',
                    'status': 'success' if fwd_status == 'success' else 'warning',
                    'detail': f'Forwarded to {fwd_url} (status: {fwd_code})'
                })
            else:
                steps.append({
                    'step': 'Postback Forwarded',
                    'status': 'warning',
                    'detail': 'No forwarding record found — publisher may not have a postback URL'
                })
        
        # Step 9: Restore original postback URL if we overrode it
        if override_postback_url and publisher_user and original_postback_url is not None:
            users_collection.update_one(
                {'_id': publisher_user['_id']},
                {'$set': {'postback_url': original_postback_url}}
            )
            steps.append({
                'step': 'Restore Postback URL',
                'status': 'success',
                'detail': f'Restored original postback URL for publisher'
            })
        
        # Mark the conversion source for cleanup
        if new_conv:
            conversions_collection.update_one(
                {'_id': new_conv['_id']},
                {'$set': {'source': 'admin_test_simulation'}}
            )
        
        overall_success = pipeline_success and new_conv is not None
        
        return jsonify({
            'success': overall_success,
            'steps': steps,
            'conversion_id': new_conv.get('conversion_id') if new_conv else None,
            'transaction_id': transaction_id,
            'balance_change': balance_amount if balance_updated else 0
        }), 200
        
    except Exception as e:
        logger.error(f"❌ Error in simulate_conversion: {str(e)}", exc_info=True)
        
        # Restore postback URL on error
        if 'override_postback_url' in locals() and override_postback_url and 'publisher_user' in locals() and publisher_user and 'original_postback_url' in locals() and original_postback_url is not None:
            try:
                users_collection = db_instance.get_collection('users')
                users_collection.update_one(
                    {'_id': publisher_user['_id']},
                    {'$set': {'postback_url': original_postback_url}}
                )
            except:
                pass
        
        return jsonify({'error': str(e), 'steps': steps if 'steps' in locals() else []}), 500


@test_postback_bp.route('/test-postback/publisher-clicks/<user_id>', methods=['GET'])
@token_required
@admin_required
def get_publisher_recent_clicks(user_id):
    """
    Get the last 10 clicks for a specific publisher.
    Used by the Simulate Conversion UI to let admin pick a click.
    """
    try:
        clicks_collection = db_instance.get_collection('clicks')
        conversions_collection = db_instance.get_collection('conversions')
        
        # Find clicks for this user (by user_id field which stores the ObjectId as string)
        query = {'$or': [
            {'user_id': user_id},
            {'username': user_id}
        ]}
        
        # Also try with ObjectId
        try:
            query['$or'].append({'user_id': ObjectId(user_id)})
        except:
            pass
        
        clicks = list(clicks_collection.find(query).sort('timestamp', -1).limit(10))
        
        result = []
        for click in clicks:
            click_id = click.get('click_id', '')
            
            # Check if this click already has a conversion
            has_conversion = conversions_collection.find_one({'click_id': click_id}) is not None
            
            result.append({
                'click_id': click_id,
                'offer_id': click.get('offer_id', ''),
                'sub1': click.get('sub_id1', '') or click.get('sub1', ''),
                'timestamp': click.get('timestamp', ''),
                'has_conversion': has_conversion,
                'country': click.get('country', ''),
                'device_type': click.get('device_type', ''),
                'placement_id': click.get('placement_id', '')
            })
        
        return jsonify({'clicks': result}), 200
        
    except Exception as e:
        logger.error(f"❌ Error fetching publisher clicks: {str(e)}", exc_info=True)
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
