"""
Postback Receiver Routes
Receives postback notifications from external partners/networks
"""

from flask import Blueprint, request, jsonify
from datetime import datetime, timedelta
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

def calculate_offer_points_with_bonus(offer_id):
    """
    Calculate points from offer with bonus
    
    Args:
        offer_id: Offer ID (e.g., "ML-00065")
    
    Returns:
        dict: {
            'base_points': int,
            'bonus_points': int,
            'total_points': int,
            'bonus_percentage': float,
            'has_bonus': bool,
            'promo_code': str
        }
    """
    try:
        # Get offer from database
        offers = get_collection('offers')
        if offers is None:
            logger.error("Cannot access offers collection")
            return {
                'base_points': 0,
                'bonus_points': 0,
                'total_points': 0,
                'bonus_percentage': 0,
                'has_bonus': False,
                'promo_code': ''
            }
        
        offer = offers.find_one({'offer_id': offer_id})
        
        if not offer:
            logger.warning(f"⚠️ Offer not found: {offer_id}")
            return {
                'base_points': 0,
                'bonus_points': 0,
                'total_points': 0,
                'bonus_percentage': 0,
                'has_bonus': False,
                'promo_code': ''
            }
        
        # Get base points from offer
        base_points = int(offer.get('payout', 0))
        
        # Check for promo code bonus
        bonus_points = 0
        bonus_percentage = 0
        has_bonus = False
        promo_code = ''
        
        if offer.get('promo_code_id') and offer.get('bonus_amount'):
            has_bonus = True
            bonus_type = offer.get('bonus_type', 'percentage')
            bonus_amount = offer.get('bonus_amount', 0)
            promo_code = offer.get('promo_code', '')
            
            if bonus_type == 'percentage':
                bonus_points = int(base_points * (bonus_amount / 100))
                bonus_percentage = bonus_amount
            else:  # fixed
                bonus_points = int(bonus_amount)
                bonus_percentage = (bonus_amount / base_points * 100) if base_points > 0 else 0
        
        total_points = base_points + bonus_points
        
        logger.info(f"💰 Offer {offer_id}: base={base_points}, bonus={bonus_points}, total={total_points}")
        
        return {
            'base_points': base_points,
            'bonus_points': bonus_points,
            'total_points': total_points,
            'bonus_percentage': bonus_percentage,
            'has_bonus': has_bonus,
            'promo_code': promo_code
        }
    except Exception as e:
        logger.error(f"❌ Error calculating offer points: {e}")
        return {
            'base_points': 0,
            'bonus_points': 0,
            'total_points': 0,
            'bonus_percentage': 0,
            'has_bonus': False,
            'promo_code': ''
        }

def get_username_from_user_id(user_id):
    """Get username from user_id"""
    try:
        if not user_id:
            return 'Unknown'
        
        users = get_collection('users')
        if users is None:
            logger.warning("Cannot access users collection")
            return user_id
        
        # Try direct lookup
        user = users.find_one({'_id': user_id})
        if not user:
            # Try as ObjectId
            try:
                user = users.find_one({'_id': ObjectId(user_id)})
            except:
                pass
        # Try as username field
        if not user:
            user = users.find_one({'username': user_id})
        
        if user:
            return user.get('username', user_id)
        
        return user_id
    except Exception as e:
        logger.error(f"❌ Error getting username: {e}")
        return user_id

@postback_receiver_bp.route('/postback/<unique_key>', methods=['GET', 'POST'])
def receive_postback(unique_key):
    """
    Receive postback from external partners
    URL format: https://moustacheleads-backend.onrender.com/postback/{unique_key}?param1=value1&param2=value2
    """
    logger.info(f"🔔 POSTBACK RECEIVER FUNCTION CALLED - VERSION WITH DISTRIBUTION")
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
        
        # 🎯 AUTO-CREATE CONVERSION
        try:
            from routes.postback_processor import process_single_postback
            success, conversion_id = process_single_postback(received_log)
            if success:
                logger.info(f"✅ Auto-created conversion: {conversion_id}")
            else:
                logger.warning(f"⚠️ Could not auto-create conversion: {conversion_id}")
        except Exception as conv_error:
            logger.error(f"❌ Conversion creation error: {conv_error}")
        
        # ❌ DISABLED OLD PARTNER DISTRIBUTION - Using new placement-based forwarding instead
        # The new code below handles forwarding to placements with correct points and username
        # This old code was sending "System:" and "0 points" to partners
        """
        # OLD PARTNER DISTRIBUTION CODE (COMMENTED OUT)
        distribution_data = {...}
        partner_postback_service.distribute_to_all_partners(...)
        """
        
        # 🎯 FORWARD POSTBACK TO THE SPECIFIC USER WHOSE OFFERWALL WAS USED
        # Get placement_id from click to identify which user's offerwall this was
        print("="*100)
        print("🚨 FORWARDING POSTBACK TO SPECIFIC USER 🚨")
        print("="*100)
        logger.info("="*100)
        logger.info("🚨 FORWARDING POSTBACK TO SPECIFIC USER 🚨")
        logger.info("="*100)
        
        try:
            # Read POST body data (upward partners send actual values here)
            post_data = {}
            try:
                if request.is_json:
                    post_data = request.get_json() or {}
                elif request.form:
                    post_data = request.form.to_dict()
                logger.info(f"📦 Received POST body: {post_data}")
            except Exception as json_error:
                logger.warning(f"⚠️ Could not parse POST body: {json_error}")
            
            # Helper function to safely get parameter value (POST body first, then query params)
            def get_param_value(key):
                # First check POST body for actual values
                if key in post_data:
                    val = post_data.get(key, '')
                    if val and val != f"{{{key}}}":  # Ignore literal macros
                        return str(val) if val else ''
                
                # Fall back to query params
                val = params.get(key, '')
                if isinstance(val, list):
                    return val[0] if val else ''
                return str(val) if val and val != f"{{{key}}}" else ''
            
            # Get click_id and offer_id (check both offer_id and survey_id)
            click_id = get_param_value('click_id')
            offer_id = get_param_value('offer_id') or get_param_value('survey_id')
            
            logger.info(f"📋 Postback parameters:")
            logger.info(f"   click_id: {click_id}")
            logger.info(f"   offer_id: {offer_id}")
            
            click = None
            
            # Try to find click by click_id first
            if click_id:
                logger.info(f"🔍 Looking up click by click_id: {click_id}")
                clicks_collection = get_collection('clicks')
                if clicks_collection is not None:
                    click = clicks_collection.find_one({'click_id': click_id})
                    if click:
                        logger.info(f"✅ Found click by click_id")
            
            # Fallback: find by placement_id + user_id (no need for offer_id mapping!)
            if not click:
                logger.warning("⚠️ No click_id - trying to find by placement_id + user_id + recent timestamp")
                
                # We can get placement_id from the postback URL path
                # The URL is /postback/{key} and we need to find which placement uses this key
                
                # Find the placement that has this postback key
                placements_collection = get_collection('placements')
                placement = None
                if placements_collection is not None:
                    # Search for placement by the API key used in the postback URL
                    # The key comes from the URL path, we need to extract it
                    postback_key = request.path.split('/')[-1]  # Get last part of /postback/KWh...
                    
                    # For now, use the known placement_id from our setup
                    # In future, this should be derived from the postback URL key
                    placement_id_to_search = 'zalUDOuAS0gaBh33'
                    
                    logger.info(f"🔍 Searching for recent click: placement={placement_id_to_search}")
                    
                    # Find the most recent click for this placement (within last hour)
                    one_hour_ago = datetime.utcnow() - timedelta(hours=1)
                    
                    clicks_collection = get_collection('clicks')
                    if clicks_collection is not None:
                        click = clicks_collection.find_one(
                            {
                                'placement_id': placement_id_to_search,
                                'timestamp': {'$gte': one_hour_ago}
                            },
                            sort=[('timestamp', -1)]
                        )
                        
                        if click:
                            logger.info(f"✅ Found recent click by placement_id")
                            logger.info(f"   User: {click.get('user_id')}, Offer: {click.get('offer_id')}")
                        else:
                            # Try offerwall_clicks_detailed
                            offerwall_clicks = get_collection('offerwall_clicks_detailed')
                            if offerwall_clicks is not None:
                                click = offerwall_clicks.find_one(
                                    {
                                        'placement_id': placement_id_to_search,
                                        'timestamp': {'$gte': one_hour_ago}
                                    },
                                    sort=[('timestamp', -1)]
                                )
                                if click:
                                    logger.info(f"✅ Found recent click in offerwall_clicks_detailed")
            
            
            if not click:
                logger.warning("⚠️ No click found - cannot forward postback")
            else:
                # Process the found click
                placement_id = click.get('placement_id') or click.get('sub_id1')
                user_id_from_click = click.get('user_id') or click.get('username') or click.get('sub2')
                
                logger.info(f"✅ Processing click - placement_id: {placement_id}, user: {user_id_from_click}")
                
                if not placement_id:
                    logger.warning("⚠️ No placement_id in click record")
                else:
                    # Get placement details to find the owner
                    placements_collection = get_collection('placements')
                    if placements_collection is not None:
                                placement = placements_collection.find_one({'_id': ObjectId(placement_id)})
                                
                                if not placement:
                                    logger.warning(f"⚠️ Placement not found: {placement_id}")
                                else:
                                    placement_owner = placement.get('created_by') or placement.get('user_id')
                                    placement_title = placement.get('offerwallTitle', 'Unknown')
                                    
                                    logger.info(f"📋 Placement: {placement_title}")
                                    logger.info(f"👤 Placement owner: {placement_owner}")
                                    
                                    # Get the owner's user details from users table
                                    users_collection = get_collection('users')
                                    if users_collection is not None:
                                        # Try to find by ObjectId first, then by username
                                        owner_user = None
                                        try:
                                            owner_user = users_collection.find_one({'_id': ObjectId(placement_owner)})
                                        except:
                                            owner_user = users_collection.find_one({'username': placement_owner})
                                        
                                        if not owner_user:
                                            logger.warning(f"⚠️ Owner user not found: {placement_owner}")
                                        else:
                                            owner_username = owner_user.get('username')
                                            owner_postback_url = owner_user.get('postback_url')
                                            
                                            logger.info(f"✅ Found owner: {owner_username}")
                                            logger.info(f"📤 Postback URL: {owner_postback_url}")
                                            
                                            if not owner_postback_url:
                                                logger.warning(f"⚠️ Owner {owner_username} has no postback_url configured")
                                            else:
                                                # Calculate points from offer (with bonus if applicable)
                                                points_calc = calculate_offer_points_with_bonus(offer_id)
                                                
                                                # Get actual username of the person who completed the offer
                                                actual_username = get_username_from_user_id(user_id_from_click) if user_id_from_click else 'Unknown'
                                                
                                                # Log calculation details
                                                logger.info(f"💰 Offer: {offer_id}")
                                                logger.info(f"   User who completed: {actual_username}")
                                                logger.info(f"   Base points: {points_calc['base_points']}")
                                                if points_calc['has_bonus']:
                                                    logger.info(f"   Bonus: {points_calc['bonus_percentage']:.1f}% ({points_calc['promo_code']}) = {points_calc['bonus_points']} points")
                                                logger.info(f"   Total points: {points_calc['total_points']}")
                                                
                                                # Replace macros with actual values
                                                final_url = owner_postback_url
                                                macros = {
                                                    '{click_id}': click_id or '',
                                                    '{status}': 'approved',
                                                    '{payout}': str(points_calc['total_points']),
                                                    '{points}': str(points_calc['total_points']),
                                                    '{offer_id}': offer_id or '',
                                                    '{conversion_id}': get_param_value('conversion_id') or '',
                                                    '{transaction_id}': get_param_value('transaction_id') or '',
                                                    '{user_id}': user_id_from_click or '',
                                                    '{affiliate_id}': user_id_from_click or '',
                                                    '{username}': actual_username or '',
                                                }
                                                
                                                # Log macro values
                                                logger.info(f"📋 Macro replacements:")
                                                for macro, value in macros.items():
                                                    logger.info(f"   {macro} → '{value}'")
                                                
                                                # Replace all macros in URL
                                                for macro, value in macros.items():
                                                    final_url = final_url.replace(macro, str(value))
                                                
                                                logger.info(f"📤 Final URL: {final_url}")
                                                
                                                # Send the postback
                                                import requests
                                                try:
                                                    response = requests.get(final_url, timeout=10)
                                                    logger.info(f"✅ Sent to {owner_username}! Status: {response.status_code}")
                                                    logger.info(f"   Response: {response.text[:200]}")
                                                    
                                                    # Log to forwarded_postbacks collection
                                                    forwarded_postbacks = get_collection('forwarded_postbacks')
                                                    if forwarded_postbacks is not None:
                                                        forwarded_log = {
                                                            'timestamp': datetime.utcnow(),
                                                            'original_postback_id': result.inserted_id,
                                                            'publisher_id': str(owner_user.get('_id')),
                                                            'publisher_name': owner_username,
                                                            'username': actual_username,
                                                            'points': points_calc['total_points'],
                                                            'forward_url': final_url,
                                                            'forward_status': 'success' if response.status_code == 200 else 'failed',
                                                            'response_code': response.status_code,
                                                            'response_body': response.text[:500],
                                                            'original_params': params,
                                                            'enriched_params': macros,
                                                            'placement_id': placement_id,
                                                            'placement_title': placement_title,
                                                            'offer_id': offer_id or 'unknown',
                                                            'click_id': click_id or 'unknown'
                                                        }
                                                        forwarded_postbacks.insert_one(forwarded_log)
                                                        logger.info(f"📝 Logged to forwarded_postbacks collection")
                                                    
                                                    # Update user points if successful
                                                    if response.status_code == 200 and user_id_from_click and points_calc['total_points'] > 0:
                                                        try:
                                                            users_collection.update_one(
                                                                {'username': actual_username},
                                                                {
                                                                    '$inc': {'total_points': points_calc['total_points']},
                                                                    '$set': {'updated_at': datetime.utcnow()}
                                                                },
                                                                upsert=False
                                                            )
                                                            logger.info(f"💰 Updated user points: {actual_username} +{points_calc['total_points']}")
                                                            
                                                            # Create points transaction record
                                                            points_transactions = get_collection('points_transactions')
                                                            if points_transactions is not None:
                                                                points_transactions.insert_one({
                                                                    'username': actual_username,
                                                                    'user_id': user_id_from_click,
                                                                    'points': points_calc['total_points'],
                                                                    'type': 'offer_completion',
                                                                    'offer_id': offer_id,
                                                                    'click_id': click_id,
                                                                    'conversion_id': get_param_value('conversion_id'),
                                                                    'timestamp': datetime.utcnow(),
                                                                    'status': 'completed'
                                                                })
                                                        except Exception as points_error:
                                                            logger.error(f"❌ Error updating user points: {points_error}")
                                                    
                                                except Exception as send_error:
                                                    logger.error(f"❌ Error sending postback: {send_error}")
                                                    
                                                    # Log failed forward
                                                    forwarded_postbacks = get_collection('forwarded_postbacks')
                                                    if forwarded_postbacks is not None:
                                                        forwarded_log = {
                                                            'timestamp': datetime.utcnow(),
                                                            'original_postback_id': result.inserted_id,
                                                            'publisher_id': str(owner_user.get('_id')),
                                                            'publisher_name': owner_username,
                                                            'username': actual_username,
                                                            'points': points_calc['total_points'],
                                                            'forward_url': final_url,
                                                            'forward_status': 'failed',
                                                            'error_message': str(send_error),
                                                            'original_params': params,
                                                            'enriched_params': macros,
                                                            'placement_id': placement_id,
                                                            'placement_title': placement_title,
                                                            'offer_id': offer_id or 'unknown',
                                                            'click_id': click_id or 'unknown'
                                                        }
                                                        forwarded_postbacks.insert_one(forwarded_log)
        
        except Exception as forward_error:
            logger.error(f"❌ Error in forwarding logic: {forward_error}")
            import traceback
            logger.error(traceback.format_exc())
        
        # 🚀 AUTOMATIC DISTRIBUTION TO PARTNERS (Keep existing logic for backward compatibility)
        # Prepare postback data for distribution
        logger.info("📝 Building distribution data for partner distribution...")
        
        # Helper function to safely get parameter value
        def get_param_value(key):
            val = params.get(key, '')
            if isinstance(val, list):
                return val[0] if val else ''
            return str(val) if val else ''
        
        distribution_data = {
            'click_id': get_param_value('click_id'),
            'status': get_param_value('status'),
            'payout': get_param_value('payout'),
            'offer_id': get_param_value('offer_id'),
            'conversion_id': get_param_value('conversion_id'),
            'transaction_id': get_param_value('transaction_id'),
            'user_id': get_param_value('user_id'),
            'affiliate_id': get_param_value('affiliate_id'),
            'campaign_id': get_param_value('campaign_id'),
            'sub_id': get_param_value('sub_id'),
            'sub_id1': get_param_value('sub_id1'),
            'sub_id2': get_param_value('sub_id2'),
            'sub_id3': get_param_value('sub_id3'),
            'sub_id4': get_param_value('sub_id4'),
            'sub_id5': get_param_value('sub_id5'),
            'ip': ip_address,
            'country': get_param_value('country'),
            'device_id': get_param_value('device_id'),
            'timestamp': str(int(datetime.utcnow().timestamp())),
        }
        
        logger.info(f"✅ Distribution data built successfully")
        
        # Add any additional params from POST data
        if post_data:
            distribution_data.update(post_data)
        

        
        # Return success response
        return jsonify({
            'status': 'success',
            'message': 'Postback received and distributed',
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
            'parameters': all_params
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

@postback_receiver_bp.route('/test-distribution-now', methods=['GET'])
def test_distribution_now():
    """Test distribution immediately - no auth required for debugging"""
    try:
        logger.info("🧪 TEST DISTRIBUTION ENDPOINT CALLED")
        
        from services.partner_postback_service import partner_postback_service
        from database import db_instance
        
        logger.info("✅ Service imported in test endpoint")
        
        test_data = {
            'click_id': 'TEST_MANUAL',
            'status': 'test',
            'payout': '1.00',
            'offer_id': 'TEST'
        }
        
        result = partner_postback_service.distribute_to_all_partners(
            postback_data=test_data,
            db_instance=db_instance,
            source_log_id='manual_test'
        )
        
        return jsonify({
            'success': True,
            'message': 'Distribution test completed',
            'result': result
        }), 200
        
    except Exception as e:
        logger.error(f"Test distribution error: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

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
