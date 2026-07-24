"""
Postback Receiver Routes
Receives postback notifications from external partners/networks
"""

from flask import Blueprint, request, jsonify, redirect as flask_redirect
from datetime import datetime, timezone, timedelta
from bson import ObjectId
import logging
import secrets
from utils.auth import token_required

postback_receiver_bp = Blueprint('postback_receiver', __name__)
logger = logging.getLogger(__name__)

# Thank You page template — Creative animated design with CSS animations
THANK_YOU_PAGE_TEMPLATE = """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{ title }} - Moustache Leads</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap" rel="stylesheet">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Inter', sans-serif;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #09090b;
            color: #fff;
            overflow: hidden;
        }
        .bg-glow {
            position: fixed;
            width: 500px;
            height: 500px;
            border-radius: 50%;
            filter: blur(150px);
            opacity: 0.12;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: {{ color }};
            animation: breathe 5s ease-in-out infinite;
        }
        .bg-glow-2 {
            position: fixed;
            width: 300px;
            height: 300px;
            border-radius: 50%;
            filter: blur(100px);
            opacity: 0.08;
            top: 30%;
            left: 30%;
            background: {{ color }};
            animation: drift 8s ease-in-out infinite;
        }
        @keyframes breathe {
            0%, 100% { opacity: 0.1; transform: translate(-50%, -50%) scale(1); }
            50% { opacity: 0.18; transform: translate(-50%, -50%) scale(1.15); }
        }
        @keyframes drift {
            0%, 100% { transform: translate(0, 0); }
            50% { transform: translate(40px, -30px); }
        }
        @keyframes fadeUp {
            from { opacity: 0; transform: translateY(25px); }
            to { opacity: 1; transform: translateY(0); }
        }
        @keyframes scaleIn {
            from { opacity: 0; transform: scale(0.5); }
            to { opacity: 1; transform: scale(1); }
        }
        @keyframes drawCircle {
            from { stroke-dashoffset: 166; }
            to { stroke-dashoffset: 0; }
        }
        @keyframes drawCheck {
            from { stroke-dashoffset: 30; }
            to { stroke-dashoffset: 0; }
        }
        @keyframes drawX {
            from { stroke-dashoffset: 20; }
            to { stroke-dashoffset: 0; }
        }
        .container {
            text-align: center;
            padding: 2rem;
            max-width: 460px;
            width: 100%;
            position: relative;
            z-index: 1;
        }
        .anim-icon {
            width: 100px;
            height: 100px;
            margin: 0 auto 2rem;
            animation: scaleIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) 0.2s both;
        }
        .anim-icon svg {
            width: 100%;
            height: 100%;
        }
        .anim-icon .circle {
            fill: none;
            stroke: {{ color }};
            stroke-width: 3;
            stroke-dasharray: 166;
            stroke-dashoffset: 166;
            animation: drawCircle 0.8s ease 0.3s forwards;
        }
        .anim-icon .icon-path {
            fill: none;
            stroke: {{ color }};
            stroke-width: 3;
            stroke-linecap: round;
            stroke-linejoin: round;
            stroke-dasharray: 30;
            stroke-dashoffset: 30;
            animation: drawCheck 0.4s ease 0.9s forwards;
        }
        .status-badge {
            display: inline-block;
            padding: 0.4rem 1.2rem;
            border-radius: 100px;
            font-size: 0.65rem;
            font-weight: 600;
            letter-spacing: 1.5px;
            text-transform: uppercase;
            background: {{ color }}15;
            color: {{ color }};
            border: 1px solid {{ color }}30;
            margin-bottom: 1.5rem;
            animation: fadeUp 0.5s ease 0.6s both;
        }
        h1 {
            font-size: 1.8rem;
            font-weight: 800;
            margin-bottom: 1rem;
            color: #fafafa;
            animation: fadeUp 0.5s ease 0.7s both;
        }
        p {
            font-size: 0.9rem;
            color: #71717a;
            line-height: 1.8;
            max-width: 380px;
            margin: 0 auto;
            animation: fadeUp 0.5s ease 0.8s both;
        }
        .footer {
            position: fixed;
            bottom: 2rem;
            left: 0;
            right: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 0.7rem;
            font-size: 0.9rem;
            color: #e4e4e7;
            animation: fadeUp 0.5s ease 1.2s both;
        }
        .footer img {
            width: 36px;
            height: 36px;
            border-radius: 8px;
            filter: drop-shadow(0 0 12px rgba(255, 255, 255, 0.4)) drop-shadow(0 0 24px rgba(139, 92, 246, 0.5));
            animation: logoGlow 3s ease-in-out infinite;
        }
        @keyframes logoGlow {
            0%, 100% { filter: drop-shadow(0 0 8px rgba(255,255,255,0.3)) drop-shadow(0 0 16px rgba(139,92,246,0.4)); }
            50% { filter: drop-shadow(0 0 14px rgba(255,255,255,0.5)) drop-shadow(0 0 28px rgba(139,92,246,0.7)); }
        }
    </style>
</head>
<body>
    <div class="bg-glow"></div>
    <div class="bg-glow-2"></div>
    <div class="container">
        <div class="anim-icon">{{ icon_svg|safe }}</div>
        <div class="status-badge">{{ badge }}</div>
        <h1>{{ title }}</h1>
        <p>{{ subtitle }}</p>
    </div>
    <div class="footer">
        <img src="https://moustacheleads.com/logo.png" alt="Moustache Leads" />
        Powered by Moustache Leads
    </div>
</body>
</html>
"""

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

def calculate_offer_points_with_bonus(offer_id, user_id=None):
    """
    Calculate points from offer with bonus (including user-specific promo codes)
    
    Args:
        offer_id: Offer ID (e.g., "ML-00065")
        user_id: Optional user ID to check user-specific promo codes
    
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
        
        # First check offer-level promo code (legacy)
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
        
        # Then check user-specific promo codes (from user_promo_codes collection)
        if user_id and not has_bonus:
            try:
                user_promo_codes = get_collection('user_promo_codes')
                promo_codes_collection = get_collection('promo_codes')
                
                if user_promo_codes is not None and promo_codes_collection is not None:
                    user_obj_id = ObjectId(user_id) if isinstance(user_id, str) else user_id
                    
                    # Find active promo codes for this user
                    active_codes = list(user_promo_codes.find({
                        'user_id': user_obj_id,
                        'is_active': True
                    }))
                    
                    for user_code in active_codes:
                        code_id = user_code.get('promo_code_id')
                        if not code_id:
                            continue
                        
                        code_obj = promo_codes_collection.find_one({'_id': ObjectId(code_id) if isinstance(code_id, str) else code_id})
                        if not code_obj or code_obj.get('status') != 'active':
                            continue
                        
                        # Check expiration
                        if code_obj.get('end_date') and code_obj['end_date'] < datetime.utcnow():
                            continue
                        
                        code_bonus_type = code_obj.get('bonus_type', 'percentage')
                        code_bonus_amount = code_obj.get('bonus_amount', 0)
                        
                        if code_bonus_amount > 0:
                            has_bonus = True
                            promo_code = code_obj.get('code', '')
                            
                            if code_bonus_type == 'percentage':
                                bonus_points = int(base_points * (code_bonus_amount / 100))
                                bonus_percentage = code_bonus_amount
                            else:  # fixed
                                bonus_points = int(code_bonus_amount)
                                bonus_percentage = (code_bonus_amount / base_points * 100) if base_points > 0 else 0
                            
                            logger.info(f"✅ User promo code bonus: {promo_code} → {bonus_points} points")
                            break  # Use first applicable code
                            
            except Exception as promo_error:
                logger.error(f"❌ Error checking user promo codes: {promo_error}")
        
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


def calculate_downward_payout(upward_payout, offer):
    """
    Calculate the payout to forward to downward partner (publisher).
    
    Publisher payout rules:
    1. If offer has revenue_share_percent > 0: publisher gets that % of upward payout
    2. Otherwise: publisher gets 80% of the offer's payout (standard 20% platform margin)
    
    Args:
        upward_payout: The payout amount received from upward partner
        offer: Offer document with revenue_share_percent field
        
    Returns:
        dict: {
            'downward_payout': float,
            'is_percentage': bool,
            'revenue_share_percent': float,
            'calculation_method': str
        }
    """
    try:
        upward_payout = float(upward_payout) if upward_payout else 0
        
        # Check if offer has revenue share percentage configured
        revenue_share_percent = offer.get('revenue_share_percent', 0)
        
        if revenue_share_percent and float(revenue_share_percent) > 0:
            # Percentage-based: forward percentage of upward payout
            percent = float(revenue_share_percent)
            downward_payout = upward_payout * (percent / 100)
            
            logger.info(f"💰 Revenue share calculation: {upward_payout} × {percent}% = {downward_payout}")
            
            return {
                'downward_payout': round(downward_payout, 2),
                'is_percentage': True,
                'revenue_share_percent': percent,
                'calculation_method': f'{percent}% of {upward_payout}'
            }
        else:
            # Fixed payout: use publisher_payout_override if set, else 80% of offer's payout
            offer_payout = float(offer.get('payout', 0))
            pub_override = offer.get('publisher_payout_override')
            if pub_override and float(pub_override) > 0:
                publisher_payout = round(float(pub_override), 2)
                logger.info(f"💰 Publisher payout (override): {publisher_payout} (admin payout: {offer_payout}, upward: {upward_payout})")
            else:
                publisher_payout = round(offer_payout * 0.8, 2)
                logger.info(f"💰 Publisher payout: {offer_payout} × 80% = {publisher_payout} (upward was {upward_payout})")
            
            return {
                'downward_payout': publisher_payout,
                'is_percentage': False,
                'revenue_share_percent': 0,
                'calculation_method': f'publisher_payout={publisher_payout} (admin={offer_payout})'
            }
            
    except Exception as e:
        logger.error(f"❌ Error calculating downward payout: {e}")
        # Fallback: use override if available, else 80% of offer's payout
        offer_payout = float(offer.get('payout', 0))
        pub_override = offer.get('publisher_payout_override')
        if pub_override and float(pub_override) > 0:
            publisher_payout = round(float(pub_override), 2)
        else:
            publisher_payout = round(offer_payout * 0.8, 2)
        return {
            'downward_payout': publisher_payout,
            'is_percentage': False,
            'revenue_share_percent': 0,
            'calculation_method': 'Fallback: publisher payout'
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


@postback_receiver_bp.route('/postback/<unique_key>/<event_type>', methods=['GET', 'POST'])
@postback_receiver_bp.route('/postback/<unique_key>', methods=['GET', 'POST'], defaults={'event_type': None})
def receive_postback(unique_key, event_type):
    """
    Receive postback from external partners
    URL format: https://postback.moustacheleads.com/postback/{unique_key}?param1=value1&param2=value2
    OR with event type: https://postback.moustacheleads.com/postback/{unique_key}/{event_type}?param1=value1&param2=value2
    
    Standard event types: complete, terminate, quotafull, security
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
            partner_id = f'standalone_{unique_key[:8]}'
            partner_name = 'Standalone Postback'
        else:
            partner_id = partner.get('partner_id', 'unknown')
            partner_name = partner.get('partner_name', 'Unknown')

        # 🌍 GEO ENRICHMENT: Try to get country from postback params first, fallback to ipinfo
        geo_country = ''
        geo_country_code = ''
        geo_city = ''
        geo_region = ''

        def _get_param(key):
            """Helper to get param from POST body first, then query params"""
            if post_data and key in post_data:
                val = post_data.get(key, '')
                if val and val != f'{{{key}}}':
                    return str(val)
            val = params.get(key, '')
            if isinstance(val, list):
                val = val[0] if val else ''
            return str(val) if val and val != f'{{{key}}}' else ''

        geo_country = _get_param('country') or _get_param('country_code')
        geo_city = _get_param('city')
        geo_region = _get_param('region') or _get_param('state')

        if not geo_country or geo_country.lower() in ('unknown', '', 'xx'):
            ip_to_lookup = ip_address.split(',')[0].strip() if ip_address else ''
            if ip_to_lookup and '.' in ip_to_lookup:
                try:
                    from services.ipinfo_service import get_ipinfo_service
                    ipinfo_svc = get_ipinfo_service()
                    ip_data = ipinfo_svc.lookup_ip(ip_to_lookup)
                    if ip_data:
                        geo_country = ip_data.get('country', '') or geo_country
                        geo_country_code = ip_data.get('country_code', '') or geo_country_code
                        geo_city = ip_data.get('city', '') or geo_city
                        geo_region = ip_data.get('region', '') or geo_region
                        logger.info(f"🌍 Geo enriched from ipinfo: country={geo_country}, city={geo_city}, region={geo_region}")
                except Exception as geo_err:
                    logger.warning(f"⚠️ Postback geo lookup failed for {ip_address}: {geo_err}")

        if not geo_country_code and geo_country:
            geo_country_code = geo_country

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
            'country': geo_country,
            'country_code': geo_country_code,
            'city': geo_city,
            'region': geo_region,
            'event_type': event_type or params.get('event_type', '') or params.get('event', ''),
            'sub_id1': params.get('sub_id1', '') or params.get('sub1', ''),
            'sub_id2': params.get('sub_id2', '') or params.get('sub2', ''),
            'sub_id3': params.get('sub_id3', '') or params.get('sub3', ''),
            'sub_id4': params.get('sub_id4', '') or params.get('sub4', ''),
            'sub_id5': params.get('sub_id5', '') or params.get('sub5', ''),
            'timestamp': datetime.utcnow(),
            'status': 'received'
        }

        # Insert into received_postbacks collection
        result = received_postbacks_collection.insert_one(received_log)
        logger.info(f"✅ Postback logged: {result.inserted_id}")

        # 📡 OFFER STATUS SIGNAL CAPTURE: Log offer_id + sub_id1 (TYP) for status tracking
        try:
            offer_id_param = _get_param('offer_id') or _get_param('oid') or _get_param('OID') or _get_param('camp')
            status_param = _get_param('sub_id1') or _get_param('typ') or _get_param('TYP') or _get_param('type')
            
            if offer_id_param and status_param:
                signals_col = get_collection('offer_status_signals')
                if signals_col is not None:
                    # Try to match offer in DB
                    offers_col = get_collection('offers')
                    matched_offer_id = None
                    matched_offer_name = None
                    current_status = None
                    
                    if offers_col is not None:
                        matched = offers_col.find_one(
                            {'campaign_id': str(offer_id_param)},
                            {'offer_id': 1, 'name': 1, 'status': 1}
                        )
                        if matched:
                            matched_offer_id = matched.get('offer_id', str(matched.get('_id', '')))
                            matched_offer_name = matched.get('name', '')
                            current_status = matched.get('status', '')
                    
                    signals_col.insert_one({
                        'network': partner_name,
                        'partner_id': partner_id,
                        'offer_id_received': str(offer_id_param),
                        'status_received': str(status_param),
                        'raw_params': params,
                        'matched_offer_id': matched_offer_id,
                        'matched_offer_name': matched_offer_name,
                        'current_status': current_status,
                        'suggested_status': None,
                        'applied': False,
                        'applied_at': None,
                        'ignored': False,
                        'received_at': datetime.utcnow(),
                        'ip': ip_address,
                        'source': 'postback',
                        'postback_log_id': str(result.inserted_id),
                    })
                    logger.info(f"📡 Offer status signal captured: offer={offer_id_param}, status={status_param}, network={partner_name}")
        except Exception as signal_err:
            logger.warning(f"Offer status signal capture error (non-critical): {signal_err}")

        # 🔀 SURVEY ROUTER: Check if this postback matches an active survey router session
        try:
            _update_survey_router_session(unique_key, params, post_data, _get_param)
        except Exception as sr_err:
            logger.warning(f"Survey router session update failed (non-critical): {sr_err}")

        # 🎯 AUTO-CREATE CONVERSION (only from real matched clicks — no fallback)
        # IMPORTANT: Only create conversions for 'complete' event type (or no event type for backward compat)
        # terminate, quotafull, security should only be logged — no payout
        conversion_created = False
        conversion_id_result = None
        
        # Determine if this is a non-conversion event type
        non_conversion_events = ['terminate', 'quotafull', 'security', 'terminated', 'quota_full', 'security_term']
        is_non_conversion = event_type and event_type.lower() in non_conversion_events
        
        if is_non_conversion:
            logger.info(f"🚫 Event type '{event_type}' — skipping conversion creation (log only, no payout)")
            # Update the log status to reflect the event type
            received_postbacks_collection.update_one(
                {'_id': result.inserted_id},
                {'$set': {'status': f'logged_{event_type}', 'is_non_conversion': True}}
            )
            
            # 🔄 MarketXcel S2S callback for non-conversion events (terminate, quotafull, security)
            try:
                # Try to find the offer to check if it's MarketXcel
                click_id_for_mxcel = (post_data.get('click_id') or params.get('click_id', [''])[0] 
                                      if isinstance(params.get('click_id'), list) else params.get('click_id', ''))
                offer_id_for_mxcel = (post_data.get('offer_id') or post_data.get('survey_id') or 
                                      params.get('offer_id', [''])[0] if isinstance(params.get('offer_id'), list) else params.get('offer_id', ''))
                
                if click_id_for_mxcel or offer_id_for_mxcel:
                    offers_col_mxcel = get_collection('offers')
                    offer_check = None
                    if offer_id_for_mxcel and offers_col_mxcel:
                        offer_check = offers_col_mxcel.find_one({'offer_id': offer_id_for_mxcel})
                    if not offer_check and click_id_for_mxcel and offers_col_mxcel:
                        clicks_col_mxcel = get_collection('clicks')
                        if clicks_col_mxcel:
                            click_for_mxcel = clicks_col_mxcel.find_one({'click_id': click_id_for_mxcel})
                            if click_for_mxcel and click_for_mxcel.get('offer_id'):
                                offer_check = offers_col_mxcel.find_one({'offer_id': click_for_mxcel['offer_id']})
                    
                    if offer_check and offer_check.get('network', '').lower() in ['marketxcel', 'market_xcel']:
                        from services.marketxcel_callback_service import fire_marketxcel_callback
                        respondent_id = click_id_for_mxcel
                        mxcel_status = 2  # Default: Terminate
                        et_lower = event_type.lower()
                        if et_lower in ['quotafull', 'quota_full', 'overquota']:
                            mxcel_status = 3
                        elif et_lower in ['security', 'security_term']:
                            mxcel_status = 4
                        fire_marketxcel_callback(respondent_id, mxcel_status)
            except Exception as mxcel_nc_err:
                logger.warning(f"⚠️ MarketXcel non-conversion callback failed (non-critical): {mxcel_nc_err}")
        else:
            try:
                from routes.postback_processor import process_single_postback
                success, conv_result = process_single_postback(received_log)
                if success:
                    conversion_created = True
                    conversion_id_result = conv_result
                    logger.info(f"✅ Auto-created verified conversion: {conv_result}")
                else:
                    logger.warning(f"⚠️ Could not auto-create conversion: {conv_result}")
            except Exception as conv_error:
                logger.error(f"❌ Conversion creation error: {conv_error}")

        # Track whether fallback already handled everything (to avoid double-processing)
        fallback_handled = False

        # 🚫 STRICT MODE: No fallback credit. Only verified click_id matches get credited.
        # If conversion was not created, it means click_id was missing or not found.
        # The postback is logged but NO balance update or forwarding happens.
        if not conversion_created:
            logger.warning("🚫 No verified conversion created — STRICT MODE: no fallback credit. Postback logged only.")
            fallback_handled = False


        if conversion_created and not fallback_handled:
            logger.info("🚨 FORWARDING POSTBACK TO SPECIFIC USER — verified conversion exists 🚨")
            try:
                # Re-read POST body data
                fwd_post_data = {}
                try:
                    if request.is_json:
                        fwd_post_data = request.get_json() or {}
                    elif request.form:
                        fwd_post_data = request.form.to_dict()
                except Exception:
                    pass

                def get_param_value(key):
                    if key in fwd_post_data:
                        val = fwd_post_data.get(key, '')
                        if val and val != f"{{{key}}}":
                            return str(val) if val else ''
                    val = params.get(key, '')
                    if isinstance(val, list):
                        return val[0] if val else ''
                    return str(val) if val and val != f"{{{key}}}" else ''

                click_id = get_param_value('click_id')
                offer_id = get_param_value('offer_id') or get_param_value('survey_id')
                upward_payout = get_param_value('payout') or get_param_value('amount') or 0
                event_type = get_param_value('event_type') or get_param_value('event') or ''
                sub_id1 = get_param_value('sub_id1') or get_param_value('sub1') or ''
                sub_id2 = get_param_value('sub_id2') or get_param_value('sub2') or ''
                sub_id3 = get_param_value('sub_id3') or get_param_value('sub3') or ''
                sub_id4 = get_param_value('sub_id4') or get_param_value('sub4') or ''
                sub_id5 = get_param_value('sub_id5') or get_param_value('sub5') or ''

                # Find the click (already matched by processor, find it again for context)
                click = None
                clicks_collection = get_collection('clicks')
                if click_id and clicks_collection is not None:
                    click = clicks_collection.find_one({'click_id': click_id})

                # Get user/placement info from click
                placement_id = click.get('placement_id', '') if click else ''
                user_id_from_click = (click.get('user_id') or click.get('username') or '') if click else ''
                actual_username = get_username_from_user_id(user_id_from_click) if user_id_from_click else get_param_value('username') or 'Unknown'

                # Get placement and owner info
                placement_title = 'Unknown'
                owner_username = actual_username
                owner_postback_url = None
                publisher_id = ''
                owner_user = None

                if placement_id and placement_id != 'default':
                    placements_collection = get_collection('placements')
                    if placements_collection is not None:
                        try:
                            placement = placements_collection.find_one({'_id': ObjectId(placement_id)})
                        except:
                            placement = placements_collection.find_one({'_id': placement_id})
                        if placement:
                            placement_title = placement.get('offerwallTitle', 'Unknown')
                            placement_owner = placement.get('created_by') or placement.get('user_id')
                            users_collection = get_collection('users')
                            if users_collection is not None and placement_owner:
                                try:
                                    owner_user = users_collection.find_one({'_id': ObjectId(placement_owner)})
                                except:
                                    owner_user = users_collection.find_one({'username': placement_owner})
                                if owner_user:
                                    owner_username = owner_user.get('username', actual_username)
                                    owner_postback_url = owner_user.get('postback_url')
                                    publisher_id = str(owner_user.get('_id', ''))

                # Fallback: if placement lookup didn't find the user, look up directly from click's user_id
                if owner_user is None and user_id_from_click:
                    users_collection = get_collection('users')
                    if users_collection is not None:
                        try:
                            owner_user = users_collection.find_one({'_id': ObjectId(user_id_from_click)})
                        except:
                            owner_user = users_collection.find_one({'username': user_id_from_click})
                        if owner_user:
                            owner_username = owner_user.get('username', actual_username)
                            owner_postback_url = owner_user.get('postback_url')
                            publisher_id = str(owner_user.get('_id', ''))
                            logger.info(f"✅ Found user directly from click user_id: {owner_username}")

                # Calculate points
                matched_offer_id = click.get('offer_id') if click else offer_id
                offers_col = get_collection('offers')
                offer_for_calc = offers_col.find_one({'offer_id': matched_offer_id}) if offers_col is not None and matched_offer_id else None

                if offer_for_calc and upward_payout:
                    revenue_calc = calculate_downward_payout(upward_payout, offer_for_calc)
                    total_points = revenue_calc['downward_payout']
                elif offer_for_calc:
                    # No upward payout available — use 80% of offer's payout (standard platform margin)
                    total_points = round(float(offer_for_calc.get('payout', 0)) * 0.8, 2)
                else:
                    total_points = round(float(upward_payout) * 0.8, 2) if upward_payout else 0

                # Check user promo bonus
                if user_id_from_click and matched_offer_id:
                    try:
                        user_bonus = calculate_offer_points_with_bonus(matched_offer_id, user_id_from_click)
                        if user_bonus.get('has_bonus') and user_bonus.get('bonus_points', 0) > 0:
                            total_points += user_bonus['bonus_points']
                    except:
                        pass

                logger.info(f"💰 Conversion: user={actual_username}, offer={offer_id}, points={total_points}")

                # === ALWAYS CREATE FORWARDED_POSTBACKS RECORD (for conversion report) ===
                forwarded_postbacks_col = get_collection('forwarded_postbacks')
                forward_status = 'pending'
                forward_url = ''
                response_code = 0

                # Try to forward if user has a postback URL
                if owner_postback_url:
                    # Get offer name for macro replacement
                    fwd_offer_name = ''
                    if offer_for_calc:
                        fwd_offer_name = offer_for_calc.get('name', '')
                    elif offers_col is not None and (offer_id or matched_offer_id):
                        o = offers_col.find_one({'offer_id': offer_id or matched_offer_id})
                        if o:
                            fwd_offer_name = o.get('name', '')

                    # Comprehensive macro map supporting multiple naming conventions
                    # Publishers use different macro formats depending on their platform
                    macros = {
                        # Click & conversion identifiers
                        '{click_id}': click_id or '',
                        '{conversion_id}': conversion_id_result or '',
                        '{transaction_id}': get_param_value('transaction_id') or '',
                        '{trans}': get_param_value('transaction_id') or '',
                        
                        # Status
                        '{status}': 'approved',
                        
                        # Payout (publisher amount) — multiple naming conventions
                        '{payout}': str(total_points),
                        '{points}': str(total_points),
                        '{payout_amount}': str(total_points),
                        '{amount}': str(total_points),
                        '{reward}': str(total_points),
                        
                        # Offer info
                        '{offer_id}': offer_id or matched_offer_id or '',
                        '{offer_name}': fwd_offer_name,
                        '{offerName}': fwd_offer_name,
                        '{cid}': offer_id or matched_offer_id or '',
                        '{cname}': fwd_offer_name,
                        
                        # User/affiliate identifiers
                        '{user_id}': user_id_from_click or '',
                        '{affiliate_id}': user_id_from_click or '',
                        '{aff_id}': user_id_from_click or '',
                        '{publisher_id}': publisher_id or user_id_from_click or '',
                        '{username}': actual_username or '',
                        
                        # Sub IDs — multiple naming conventions
                        '{sub_id1}': click.get('sub_id1', '') if click else '',
                        '{sub_id2}': click.get('sub_id2', '') if click else '',
                        '{sub_id3}': click.get('sub_id3', '') if click else '',
                        '{sub1}': click.get('sub_id1', '') if click else '',
                        '{sub2}': click.get('sub_id2', '') if click else '',
                        '{sub3}': click.get('sub_id3', '') if click else '',
                        '{aff_sub}': click.get('sub_id1', '') if click else '',
                        '{aff_sub1}': click.get('sub_id1', '') if click else '',
                        '{aff_sub2}': click.get('sub_id2', '') if click else '',
                        '{aff_sub3}': click.get('sub_id3', '') if click else '',
                        '{aff_sub4}': click.get('sub_id4', '') if click else '',
                        '{aff_sub5}': click.get('sub_id5', '') if click else '',
                        
                        # IP address — multiple naming conventions
                        '{user_ip}': click.get('ip_address', '') if click else '',
                        '{ip}': click.get('ip_address', '') if click else '',
                        '{ip_address}': click.get('ip_address', '') if click else '',
                        
                        # Geo
                        '{country}': click.get('country', '') if click else '',
                        '{country_code}': click.get('country_code', '') if click else '',
                        
                        # Device
                        '{device}': click.get('device_type', '') if click else '',
                        '{device_type}': click.get('device_type', '') if click else '',
                    }
                    forward_url = owner_postback_url
                    for macro, value in macros.items():
                        forward_url = forward_url.replace(macro, str(value))

                    import requests as req_lib
                    try:
                        resp = req_lib.get(forward_url, timeout=10)
                        response_code = resp.status_code
                        forward_status = 'success' if resp.status_code == 200 else 'failed'
                        logger.info(f"📤 Forwarded to {owner_username}: status={resp.status_code}")
                    except Exception as send_err:
                        forward_status = 'failed'
                        logger.error(f"❌ Forward failed: {send_err}")
                else:
                    forward_status = 'no_url'
                    logger.info(f"📝 No postback URL for {owner_username} — recording conversion without forwarding")

                # Create the forwarded_postbacks record (ALWAYS — this is what shows in conversion report)
                if forwarded_postbacks_col is not None:
                    # Get offer name for display — use cname from postback as fallback
                    offer_name_from_postback = get_param_value('cname') or get_param_value('offer_name') or ''
                    offer_name = 'Unknown Offer'
                    if offer_for_calc:
                        offer_name = offer_for_calc.get('name', offer_name_from_postback or 'Unknown Offer')
                    elif offers_col is not None and (offer_id or matched_offer_id):
                        o = offers_col.find_one({'offer_id': offer_id or matched_offer_id})
                        if o:
                            offer_name = o.get('name', offer_name_from_postback or 'Unknown Offer')
                        elif offer_name_from_postback:
                            offer_name = offer_name_from_postback
                    elif offer_name_from_postback:
                        offer_name = offer_name_from_postback

                    # Get end-user info from postback params (person who completed the offer)
                    end_user_username = get_param_value('username') or actual_username
                    end_user_id = get_param_value('user_id') or user_id_from_click

                    fwd_record = {
                        'timestamp': datetime.utcnow(),
                        'original_postback_id': result.inserted_id,
                        'received_postback_id': str(result.inserted_id),
                        'publisher_id': publisher_id,
                        'publisher_name': owner_username,
                        'username': end_user_username,
                        'end_user_id': end_user_id,
                        'points': total_points,
                        'forward_url': forward_url,
                        'forward_status': forward_status,
                        'response_code': response_code,
                        'original_params': params,
                        'placement_id': placement_id,
                        'placement_title': placement_title,
                        'offer_id': offer_id or matched_offer_id or 'unknown',
                        'offer_name': offer_name,
                        'click_id': click_id or 'unknown',
                        'source': 'verified_postback',
                        'conversion_id': conversion_id_result,
                        'transaction_id': get_param_value('transaction_id') or '',
                        'country': click.get('country', '') if click else '',
                        'device_type': click.get('device_type', '') if click else '',
                        'ip_address': click.get('ip_address', '') if click else '',
                        'sub_id1': click.get('sub_id1', '') if click else '',
                        'sub_id2': click.get('sub_id2', '') if click else '',
                        'sub_id3': click.get('sub_id3', '') if click else '',
                        'sub_id4': click.get('sub_id4', '') if click else '',
                        'sub_id5': click.get('sub_id5', '') if click else '',
                    }
                    forwarded_postbacks_col.insert_one(fwd_record)
                    logger.info(f"📝 Created forwarded_postbacks record (status={forward_status})")

                # Award points regardless of forward status (publisher earned the conversion)
                if total_points > 0 and actual_username != 'Unknown':
                    try:
                        users_col = get_collection('users')
                        if users_col is not None:
                            # Ensure total_points field exists (initialize if None)
                            users_col.update_one(
                                {'username': actual_username, 'total_points': None},
                                {'$set': {'total_points': 0}}
                            )
                            users_col.update_one(
                                {'username': actual_username},
                                {'$inc': {'total_points': total_points}, '$set': {'updated_at': datetime.utcnow()}},
                                upsert=False
                            )
                            logger.info(f"💰 Updated points: {actual_username} +{total_points}")

                        pts_col = get_collection('points_transactions')
                        if pts_col is not None:
                            pts_col.insert_one({
                                'username': actual_username, 'user_id': user_id_from_click,
                                'points': total_points, 'type': 'offer_completion',
                                'offer_id': offer_id or matched_offer_id, 'click_id': click_id,
                                'conversion_id': conversion_id_result,
                                'received_postback_id': str(result.inserted_id),
                                'timestamp': datetime.utcnow(), 'status': 'completed',
                                'source': 'verified_postback',
                            })

                        # Referral P2 commission
                        try:
                            from models.referral import Referral
                            ref_model = Referral()
                            users_col2 = get_collection('users')
                            if users_col2 is not None:
                                pub_user = users_col2.find_one({'username': actual_username})
                                if pub_user and pub_user.get('referred_by'):
                                    ref_model.update_p2_revenue(str(pub_user['_id']), total_points)
                        except:
                            pass
                    except Exception as pts_err:
                        logger.error(f"❌ Error updating points: {pts_err}")

                # 🔄 NETWORK S2S CALLBACK: MarketXcel respondent status update
                if offer_for_calc and offer_for_calc.get('network', '').lower() in ['marketxcel', 'market_xcel']:
                    try:
                        from services.marketxcel_callback_service import fire_marketxcel_callback
                        respondent_id = click_id  # Our click_id is passed as [identifier] in their URL
                        # Determine status based on event_type
                        mxcel_status = 1  # 1=Complete (default for successful conversion)
                        if event_type:
                            et_lower = event_type.lower()
                            if et_lower in ['terminate', 'terminated']:
                                mxcel_status = 2
                            elif et_lower in ['quotafull', 'quota_full', 'overquota']:
                                mxcel_status = 3
                            elif et_lower in ['security', 'security_term']:
                                mxcel_status = 4
                        fire_marketxcel_callback(respondent_id, mxcel_status)
                    except Exception as mxcel_err:
                        logger.warning(f"⚠️ MarketXcel S2S callback failed (non-critical): {mxcel_err}")

            except Exception as forward_error:
                logger.error(f"❌ Error in forwarding logic: {forward_error}")
                import traceback
                logger.error(traceback.format_exc())

        # Return success response
        # If partner has redirect_mode enabled OR event_type came from URL path, show thank you page
        is_redirect_mode = False
        redirect_url = None
        if partner and isinstance(partner, dict):
            is_redirect_mode = partner.get('redirect_mode', False)
            redirect_url = partner.get('redirect_url', '')
        
        # If event_type came from URL path, it's likely a browser redirect from survey platform
        if event_type and is_redirect_mode:
            from flask import render_template_string
            # Determine message based on event type (CSS animated SVG icons)
            # Checkmark circle
            svg_complete = '<svg viewBox="0 0 52 52"><circle class="circle" cx="26" cy="26" r="25"/><path class="icon-path" d="M14.1 27.2l7.1 7.2 16.7-16.8"/></svg>'
            # X circle
            svg_terminate = '<svg viewBox="0 0 52 52"><circle class="circle" cx="26" cy="26" r="25"/><path class="icon-path" d="M16 16 36 36M36 16 16 36"/></svg>'
            # Pause/stop bars
            svg_quota = '<svg viewBox="0 0 52 52"><circle class="circle" cx="26" cy="26" r="25"/><path class="icon-path" d="M20 18v16M32 18v16"/></svg>'
            # Shield/lock
            svg_security = '<svg viewBox="0 0 52 52"><circle class="circle" cx="26" cy="26" r="25"/><path class="icon-path" d="M26 16v8M22 24h8v8H22z"/></svg>'
            
            messages = {
                'complete': {
                    'title': 'Survey Completed!',
                    'subtitle': 'Your response has been recorded successfully. Thank you for taking the time to participate.',
                    'badge': 'Completed',
                    'color': '#8b5cf6',
                    'icon_svg': svg_complete
                },
                'terminate': {
                    'title': 'Terminated',
                    'subtitle': 'You did not qualify for this survey based on your responses. This is normal — not every survey is a match.',
                    'badge': 'Disqualified',
                    'color': '#f59e0b',
                    'icon_svg': svg_terminate
                },
                'quotafull': {
                    'title': 'Quota Reached',
                    'subtitle': 'This survey has already collected enough responses for your demographic. Please try another survey.',
                    'badge': 'Quota Full',
                    'color': '#8b5cf6',
                    'icon_svg': svg_quota
                },
                'security': {
                    'title': 'Security Check Failed',
                    'subtitle': 'Your session was flagged by our security system. If you believe this is an error, please contact support.',
                    'badge': 'Security Terminated',
                    'color': '#ef4444',
                    'icon_svg': svg_security
                },
            }
            msg = messages.get(event_type, messages['complete'])
            logger.info(f"🔀 Redirect mode: showing thank you page (event_type={event_type})")
            return render_template_string(THANK_YOU_PAGE_TEMPLATE, 
                title=msg['title'], subtitle=msg['subtitle'], badge=msg['badge'],
                color=msg['color'], icon_svg=msg['icon_svg'])
        
        return jsonify({
            'status': 'success',
            'message': 'Postback received and processed',
            'log_id': str(result.inserted_id),
            'conversion_created': conversion_created,
            'event_type': event_type or ''
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
                    'postback_receiver_url': f"https://postback.moustacheleads.com/postback/{unique_key}",
                    'updated_at': datetime.now(timezone.utc)
                }
            }
        )
        
        if result.modified_count == 0:
            return jsonify({'error': 'Partner not found or not updated'}), 404
        
        logger.info(f"✅ Generated unique key for partner: {partner_id}")
        
        return jsonify({
            'success': True,
            'unique_key': unique_key,
            'postback_url': f"https://postback.moustacheleads.com/postback/{unique_key}"
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
        
        # Resolve usernames from user_id in query_params
        users_collection = get_collection('users')
        user_cache = {}  # Cache to avoid repeated lookups
        
        for log in logs:
            log['_id'] = str(log['_id'])
            
            # Resolve username from user_id in query_params
            user_id = (log.get('query_params', {}).get('user_id', '') or 
                      log.get('query_params', {}).get('affiliate_id', '') or
                      log.get('query_params', {}).get('aff_id', ''))
            
            if user_id and users_collection is not None:
                if user_id not in user_cache:
                    try:
                        user = users_collection.find_one({'_id': ObjectId(user_id)}, {'username': 1})
                        user_cache[user_id] = user.get('username', user_id) if user else user_id
                    except:
                        user_cache[user_id] = user_id
                log['resolved_username'] = user_cache[user_id]
            else:
                log['resolved_username'] = user_id or ''
        
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

@postback_receiver_bp.route('/api/admin/received-postbacks/bulk-delete', methods=['POST'])
@token_required
@admin_required
def bulk_delete_received_postbacks():
    """
    Bulk delete received postbacks
    """
    try:
        data = request.get_json()
        
        if not data or 'log_ids' not in data:
            return jsonify({'error': 'log_ids array is required'}), 400
        
        log_ids = data['log_ids']
        
        if not isinstance(log_ids, list) or len(log_ids) == 0:
            return jsonify({'error': 'log_ids must be a non-empty array'}), 400
        
        received_postbacks_collection = get_collection('received_postbacks')
        if received_postbacks_collection is None:
            return jsonify({'error': 'Database not connected'}), 503
        
        # Convert string IDs to ObjectId
        object_ids = []
        for log_id in log_ids:
            try:
                object_ids.append(ObjectId(log_id))
            except:
                # If not a valid ObjectId, skip it
                pass
        
        if len(object_ids) == 0:
            return jsonify({'error': 'No valid log IDs provided'}), 400
        
        # Delete logs
        result = received_postbacks_collection.delete_many({'_id': {'$in': object_ids}})
        
        logger.info(f"✅ Bulk deleted {result.deleted_count} received postback logs")
        
        return jsonify({
            'message': f'Successfully deleted {result.deleted_count} received postback logs',
            'deleted_count': result.deleted_count
        }), 200
        
    except Exception as e:
        logger.error(f"Error bulk deleting received postbacks: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500

@postback_receiver_bp.route('/api/admin/postback-receiver/generate-quick', methods=['POST'])
@token_required
@admin_required
def generate_quick_postback():
    """
    Generate a quick postback URL without requiring a partner and save it to database
    """
    try:
        data = request.get_json()
        parameters = data.get('parameters', [])
        custom_params = data.get('custom_params', [])
        partner_name = data.get('partner_name', 'Quick Generated Partner')
        # Get parameter mappings: { our_param: partner_param } e.g., { "username": "aff_id" }
        parameter_mappings = data.get('parameter_mappings', {})
        
        # Generate unique key (32 characters)
        unique_key = secrets.token_urlsafe(24)
        
        # Build base URL
        base_url = f"https://postback.moustacheleads.com/postback/{unique_key}"
        
        # Build full URL with parameters
        # NOTE: We manually build the query string to avoid URL-encoding the curly braces
        # Partners expect {username} not %7Busername%7D
        all_params = parameters + custom_params
        if all_params:
            param_parts = []
            for param in all_params:
                if param.strip():
                    # Get partner's macro name - what THEY call this parameter in their system
                    partner_macro = parameter_mappings.get(param.strip(), param.strip())
                    # Format: our_param={partner_macro}
                    # - Left side (our_param): what WE will receive as the query parameter
                    # - Right side ({partner_macro}): placeholder that PARTNER replaces with actual value
                    param_parts.append(f"{param.strip()}={{{partner_macro}}}")
            
            if param_parts:
                query_string = "&".join(param_parts)
                full_url = f"{base_url}?{query_string}"
            else:
                full_url = base_url
        else:
            full_url = base_url
        
        # Save to database as a partner
        partners_collection = get_collection('partners')
        if partners_collection is not None:
            import uuid
            partner_doc = {
                'partner_id': str(uuid.uuid4()),
                'partner_name': partner_name,
                'postback_url': '',  # They send TO us, not we send to them
                'method': 'GET',
                'status': 'active',
                'description': f'Quick generated postback with parameters: {", ".join(all_params)}',
                'unique_postback_key': unique_key,
                'postback_receiver_url': full_url,
                'parameter_mapping': {param: param for param in all_params if param.strip()},
                'created_by': str(request.current_user['_id']),
                'created_at': datetime.now(timezone.utc),
                'updated_at': datetime.now(timezone.utc),
                'is_quick_generated': True  # Flag to identify quick generated partners
            }
            
            partners_collection.insert_one(partner_doc)
            logger.info(f"✅ Saved quick postback to database: {partner_name} - {unique_key}")
        
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
        base_url = f"https://postback.moustacheleads.com/postback/{unique_key}"
        
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
        base_url = f"https://postback.moustacheleads.com/postback/{unique_key}"
        
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


@postback_receiver_bp.route('/api/admin/postback-pipeline/stats', methods=['GET'])
@token_required
@admin_required
def get_pipeline_stats():
    """Get postback pipeline statistics — received, matched, converted, forwarded"""
    try:
        received = get_collection('received_postbacks')
        conversions = get_collection('conversions')
        forwarded = get_collection('forwarded_postbacks')
        clicks = get_collection('clicks')
        points_tx = get_collection('points_transactions')

        if received is None:
            return jsonify({'error': 'Database not connected'}), 503

        # Date filter
        from datetime import datetime, timedelta
        days = int(request.args.get('days', 30))
        since = datetime.utcnow() - timedelta(days=days)

        # Pipeline counts
        total_received = received.count_documents({'timestamp': {'$gte': since}})
        matched = received.count_documents({'timestamp': {'$gte': since}, 'status': 'processed'})
        unmatched = received.count_documents({'timestamp': {'$gte': since}, 'status': 'unmatched'})
        still_received = received.count_documents({'timestamp': {'$gte': since}, 'status': 'received'})

        total_conversions = conversions.count_documents({'conversion_time': {'$gte': since}}) if conversions is not None else 0
        verified_conversions = conversions.count_documents({'conversion_time': {'$gte': since}, 'source': 'postback', 'verified': True}) if conversions is not None else 0
        fake_conversions = conversions.count_documents({'source': 'fallback_fake'}) if conversions is not None else 0

        total_forwarded = forwarded.count_documents({'timestamp': {'$gte': since}}) if forwarded is not None else 0
        verified_forwarded = forwarded.count_documents({'timestamp': {'$gte': since}, 'source': 'verified_postback'}) if forwarded is not None else 0
        fake_forwarded = forwarded.count_documents({'source': 'fallback_fake'}) if forwarded is not None else 0
        legacy_forwarded = forwarded.count_documents({'timestamp': {'$gte': since}, 'source': {'$exists': False}}) if forwarded is not None else 0

        total_points_tx = points_tx.count_documents({'timestamp': {'$gte': since}, 'type': 'offer_completion'}) if points_tx is not None else 0
        verified_points_tx = points_tx.count_documents({'timestamp': {'$gte': since}, 'type': 'offer_completion', 'source': 'verified_postback'}) if points_tx is not None else 0
        fake_points_tx = points_tx.count_documents({'source': 'fallback_fake', 'type': 'offer_completion'}) if points_tx is not None else 0

        # Recent received postbacks (last 20)
        recent_received = []
        for pb in received.find({'timestamp': {'$gte': since}}).sort('timestamp', -1).limit(20):
            pb['_id'] = str(pb['_id'])
            recent_received.append(pb)

        # Recent forwarded (last 20)
        recent_forwarded = []
        if forwarded is not None:
            for fwd in forwarded.find({'timestamp': {'$gte': since}, 'source': {'$nin': ['fallback_fake']}}).sort('timestamp', -1).limit(20):
                fwd['_id'] = str(fwd['_id'])
                if 'original_postback_id' in fwd:
                    fwd['original_postback_id'] = str(fwd['original_postback_id'])
                recent_forwarded.append(fwd)

        return jsonify({
            'success': True,
            'days': days,
            'pipeline': {
                'received': {
                    'total': total_received,
                    'matched': matched,
                    'unmatched': unmatched,
                    'pending': still_received
                },
                'conversions': {
                    'total': total_conversions,
                    'verified': verified_conversions,
                    'fake_flagged': fake_conversions
                },
                'forwarded': {
                    'total': total_forwarded,
                    'verified': verified_forwarded,
                    'fake_flagged': fake_forwarded,
                    'legacy_unflagged': legacy_forwarded
                },
                'points': {
                    'total_transactions': total_points_tx,
                    'verified_transactions': verified_points_tx,
                    'fake_flagged': fake_points_tx
                }
            },
            'recent_received': recent_received,
            'recent_forwarded': recent_forwarded
        }), 200

    except Exception as e:
        logger.error(f"Error getting pipeline stats: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@postback_receiver_bp.route('/api/admin/postback-pipeline/cleanup', methods=['POST'])
@token_required
@admin_required
def run_cleanup():
    """Run the fake conversion cleanup — flags fake records and deducts fake points"""
    try:
        data = request.get_json() or {}
        dry_run = data.get('dry_run', True)

        from database import db_instance
        from collections import Counter

        conversions = get_collection('conversions')
        clicks_col = get_collection('clicks')
        fwd_col = get_collection('forwarded_postbacks')
        pts_col = get_collection('points_transactions')
        users_col = get_collection('users')

        # === PHASE 1: forwarded_postbacks ===
        fwd_flagged = 0
        fwd_verified = 0
        all_fwd = list(fwd_col.find({})) if fwd_col is not None else []

        # Detect duplicate click_ids
        click_id_counts = Counter()
        for fwd in all_fwd:
            cid = fwd.get('click_id', '')
            if cid and cid != 'unknown':
                click_id_counts[cid] += 1
        duplicate_click_ids = {cid for cid, count in click_id_counts.items() if count > 1}

        for fwd in all_fwd:
            is_fake = False
            enriched = fwd.get('enriched_params', {})
            ep = enriched.get('points', '') if isinstance(enriched, dict) else ''
            eu = enriched.get('username', '') if isinstance(enriched, dict) else ''
            cid = fwd.get('click_id', '')

            if ep in ('0', 0, ''):
                is_fake = True
            if eu in ('Unknown', '', 'System:'):
                is_fake = True
            if cid and cid != 'unknown' and cid in duplicate_click_ids:
                is_fake = True
            if not cid or cid == 'unknown':
                is_fake = True

            if is_fake:
                fwd_flagged += 1
                if not dry_run:
                    fwd_col.update_one({'_id': fwd['_id']}, {'$set': {'source': 'fallback_fake', 'flagged_at': datetime.utcnow()}})
            else:
                fwd_verified += 1
                if not dry_run and fwd.get('source') != 'verified_postback':
                    fwd_col.update_one({'_id': fwd['_id']}, {'$set': {'source': 'legacy_verified'}})

        # === PHASE 2: conversions ===
        conv_flagged = 0
        conv_verified = 0
        all_conv = list(conversions.find({})) if conversions is not None else []

        for conv in all_conv:
            click_id = conv.get('click_id')
            conv_offer = conv.get('offer_id')
            is_fake = False

            click = clicks_col.find_one({'click_id': click_id}) if click_id and clicks_col is not None else None
            if click is None:
                is_fake = True
            elif click.get('offer_id') and conv_offer and click.get('offer_id') != conv_offer:
                is_fake = True

            if is_fake:
                conv_flagged += 1
                if not dry_run:
                    conversions.update_one({'_id': conv['_id']}, {'$set': {'source': 'fallback_fake', 'verified': False, 'flagged_at': datetime.utcnow()}})
            else:
                conv_verified += 1
                if not dry_run and conv.get('source') != 'postback':
                    conversions.update_one({'_id': conv['_id']}, {'$set': {'source': 'legacy_verified', 'verified': True}})

        # === PHASE 3: points_transactions ===
        pts_flagged = 0
        pts_verified = 0
        pts_fake_total = 0
        fake_by_user = {}
        all_pts = list(pts_col.find({'type': 'offer_completion'})) if pts_col is not None else []

        for pt in all_pts:
            cid = pt.get('click_id', '')
            is_fake = False
            if cid and cid in duplicate_click_ids:
                is_fake = True
            elif not cid or cid == 'unknown':
                is_fake = True

            if is_fake:
                pts_flagged += 1
                pts_fake_total += pt.get('points', 0)
                u = pt.get('username', 'unknown')
                fake_by_user[u] = fake_by_user.get(u, 0) + pt.get('points', 0)
                if not dry_run:
                    pts_col.update_one({'_id': pt['_id']}, {'$set': {'source': 'fallback_fake', 'flagged_at': datetime.utcnow()}})
            else:
                pts_verified += 1
                if not dry_run:
                    pts_col.update_one({'_id': pt['_id']}, {'$set': {'source': 'legacy_verified'}})

        # === PHASE 4: Deduct fake points ===
        if not dry_run and users_col is not None:
            for username, fake_pts in fake_by_user.items():
                users_col.update_one({'username': username}, {'$inc': {'total_points': -fake_pts}})

        result = {
            'conversions': {'flagged': conv_flagged, 'verified': conv_verified, 'total': len(all_conv)},
            'forwarded_postbacks': {'flagged': fwd_flagged, 'verified': fwd_verified, 'total': len(all_fwd)},
            'points_transactions': {'flagged': pts_flagged, 'verified': pts_verified, 'total': len(all_pts)},
            'fake_points_total': pts_fake_total,
            'fake_points_by_user': fake_by_user
        }

        return jsonify({'success': True, 'dry_run': dry_run, 'result': result}), 200

    except Exception as e:
        logger.error(f"Error running cleanup: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500


# ============================================================
# SURVEY ROUTER: Update session when partner postback arrives
# ============================================================

def _update_survey_router_session(unique_key, params, post_data, get_param_fn):
    """
    When a postback arrives from a partner, check if there's an active
    survey_router_session waiting for this partner's postback.
    If found, update the session status so the polling frontend knows.
    
    Matching logic:
    - Find sessions where current_attempt.partner_unique_key == unique_key
    - OR match by session_id/attempt_id if passed in postback params
    """
    sessions_col = get_collection('survey_router_sessions')
    if sessions_col is None:
        return

    # Try to match by session_id first (if partner passes it through)
    session_id = get_param_fn('session_id')
    attempt_id = get_param_fn('attempt_id')
    
    # Also try click_id as session_id (common mapping)
    if not session_id:
        session_id = get_param_fn('click_id')
    if not attempt_id:
        attempt_id = get_param_fn('sub1')

    session = None
    
    if session_id:
        session = sessions_col.find_one({'session_id': session_id, 'status': 'in_progress'})
    
    # Fallback: find by partner unique key (any in-progress session for this partner)
    if not session:
        # Find partner_id from unique_key
        partners_col = get_collection('partners')
        if partners_col is not None:
            partner = partners_col.find_one({'unique_postback_key': unique_key})
            if partner:
                partner_id = partner.get('partner_id', '')
                logger.info(f"🔀 Survey router: looking for session with partner_id={partner_id}")
                # Find most recent in-progress session for this partner
                session = sessions_col.find_one(
                    {'current_attempt.partner_id': partner_id, 'status': 'in_progress'},
                    sort=[('created_at', -1)]
                )

    if not session:
        logger.info(f"🔀 Survey router: no matching session found for key={unique_key}")
        return  # No matching survey router session

    # Determine status from postback params
    status_raw = get_param_fn('status') or get_param_fn('event_type') or get_param_fn('event') or ''
    status_lower = status_raw.lower().strip()
    
    if status_lower in ('complete', 'completed', 'success', '1', 'approved'):
        status = 'completed'
    elif status_lower in ('fail', 'failed', 'disqualified', 'dq', 'screenout', '0', 'rejected'):
        status = 'failed'
    elif status_lower in ('quota_full', 'quotafull', 'over_quota', 'overquota', '2'):
        status = 'quota_full'
    else:
        status = 'completed'  # Default to completed if status unclear
        status = 'completed'  # Default to completed if status unclear

    payout = 0
    try:
        payout_str = get_param_fn('payout') or get_param_fn('amount') or '0'
        payout = float(payout_str) if payout_str else 0
    except (ValueError, TypeError):
        payout = 0

    now = datetime.utcnow()
    
    # Update the session
    update_set = {
        'current_attempt.status': status,
        'current_attempt.payout': payout,
        'current_attempt.postback_received_at': now,
        'updated_at': now,
    }
    
    if status == 'completed':
        update_set['status'] = 'completed'
    
    sessions_col.update_one(
        {'_id': session['_id']},
        {'$set': update_set}
    )
    
    # Also update in the attempts array if we have attempt_id
    current_attempt_id = session.get('current_attempt', {}).get('attempt_id', '')
    if current_attempt_id:
        sessions_col.update_one(
            {'_id': session['_id'], 'attempts.attempt_id': current_attempt_id},
            {'$set': {
                'attempts.$.status': status,
                'attempts.$.payout': payout,
                'attempts.$.postback_received_at': now,
            }}
        )

    logger.info(f"🔀 Survey router session updated: {session.get('session_id')} → {status} (payout: {payout})")
