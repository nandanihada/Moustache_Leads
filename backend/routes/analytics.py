from flask import Blueprint, request, jsonify
from models.analytics import Analytics
from utils.auth import token_required, subadmin_or_admin_required
import logging

analytics_bp = Blueprint('analytics', __name__)
analytics_model = Analytics()

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

@analytics_bp.route('/track-click', methods=['POST'])
def track_click():
    """Track a click event (public endpoint)"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        # Add request metadata
        click_data = {
            **data,
            'ip_address': request.environ.get('HTTP_X_FORWARDED_FOR', request.environ.get('REMOTE_ADDR')),
            'user_agent': request.headers.get('User-Agent', ''),
            'referrer': request.headers.get('Referer', '')
        }
        
        click_record, error = analytics_model.track_click(click_data)
        
        if error:
            return jsonify({'error': error}), 400
        
        # Return minimal response for public endpoint
        return jsonify({
            'success': True,
            'click_id': str(click_record['_id']),
            'is_fraud': click_record['is_fraud']
        }), 200
        
    except Exception as e:
        logging.error(f"Track click error: {str(e)}", exc_info=True)
        return jsonify({'error': 'Failed to track click'}), 500

@analytics_bp.route('/track-conversion', methods=['POST'])
def track_conversion():
    """Track a conversion event (public endpoint)"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        conversion_record, error = analytics_model.track_conversion(data)
        
        if error:
            return jsonify({'error': error}), 400
        
        # Return minimal response for public endpoint
        return jsonify({
            'success': True,
            'conversion_id': str(conversion_record['_id']),
            'payout': conversion_record['payout']
        }), 200
        
    except Exception as e:
        logging.error(f"Track conversion error: {str(e)}", exc_info=True)
        return jsonify({'error': 'Failed to track conversion'}), 500

@analytics_bp.route('/dashboard', methods=['GET'])
@token_required
@subadmin_or_admin_required('analytics')
def get_analytics_dashboard():
    """Get analytics dashboard data (Admin only)"""
    try:
        # Get query parameters
        date_range = request.args.get('date_range', '24h')
        offer_id = request.args.get('offer_id')
        
        filters = {'date_range': date_range}
        if offer_id:
            filters['offer_id'] = offer_id
        
        dashboard_data = analytics_model.get_analytics_dashboard(filters)
        
        return jsonify(dashboard_data), 200
        
    except Exception as e:
        logging.error(f"Get analytics dashboard error: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to get analytics: {str(e)}'}), 500

@analytics_bp.route('/fraud-report', methods=['GET'])
@token_required
@subadmin_or_admin_required('analytics')
def get_fraud_report():
    """Get fraud analysis report (Admin only)"""
    try:
        # Get query parameters
        date_range = request.args.get('date_range', '24h')
        
        filters = {'date_range': date_range}
        
        fraud_report = analytics_model.get_fraud_report(filters)
        
        return jsonify(fraud_report), 200
        
    except Exception as e:
        logging.error(f"Get fraud report error: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to get fraud report: {str(e)}'}), 500

@analytics_bp.route('/clicks', methods=['GET'])
@token_required
@subadmin_or_admin_required('analytics')
def get_clicks():
    """Get detailed click data (Admin only)"""
    try:
        # Get query parameters
        page = int(request.args.get('page', 1))
        per_page = min(int(request.args.get('per_page', 50)), 100)
        offer_id = request.args.get('offer_id')
        is_fraud = request.args.get('is_fraud')
        
        # Build query
        query = {}
        if offer_id:
            query['offer_id'] = offer_id
        if is_fraud is not None:
            query['is_fraud'] = is_fraud.lower() == 'true'
        
        # Calculate skip
        skip = (page - 1) * per_page
        
        # Get clicks
        clicks_cursor = analytics_model.clicks_collection.find(query).sort('timestamp', -1).skip(skip).limit(per_page)
        clicks = list(clicks_cursor)
        
        # Convert ObjectIds to strings
        for click in clicks:
            click['_id'] = str(click['_id'])
            if click.get('masked_link_id'):
                click['masked_link_id'] = str(click['masked_link_id'])
        
        # Get total count
        total = analytics_model.clicks_collection.count_documents(query)
        
        return jsonify({
            'clicks': clicks,
            'pagination': {
                'page': page,
                'per_page': per_page,
                'total': total,
                'pages': (total + per_page - 1) // per_page
            }
        }), 200
        
    except Exception as e:
        logging.error(f"Get clicks error: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to get clicks: {str(e)}'}), 500

@analytics_bp.route('/conversions', methods=['GET'])
@token_required
@subadmin_or_admin_required('analytics')
def get_conversions():
    """Get detailed conversion data (Admin only)"""
    try:
        # Get query parameters
        page = int(request.args.get('page', 1))
        per_page = min(int(request.args.get('per_page', 50)), 100)
        offer_id = request.args.get('offer_id')
        status = request.args.get('status')
        
        # Build query
        query = {}
        if offer_id:
            query['offer_id'] = offer_id
        if status:
            query['status'] = status
        
        # Calculate skip
        skip = (page - 1) * per_page
        
        # Get conversions
        conversions_cursor = analytics_model.conversions_collection.find(query).sort('timestamp', -1).skip(skip).limit(per_page)
        conversions = list(conversions_cursor)
        
        # Convert ObjectIds to strings
        for conversion in conversions:
            conversion['_id'] = str(conversion['_id'])
            conversion['click_id'] = str(conversion['click_id'])
        
        # Get total count
        total = analytics_model.conversions_collection.count_documents(query)
        
        return jsonify({
            'conversions': conversions,
            'pagination': {
                'page': page,
                'per_page': per_page,
                'total': total,
                'pages': (total + per_page - 1) // per_page
            }
        }), 200
        
    except Exception as e:
        logging.error(f"Get conversions error: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to get conversions: {str(e)}'}), 500

# Enhanced Postback endpoint - Captures ALL survey data
@analytics_bp.route('/postback', methods=['GET', 'POST'])
def handle_postback():
    """
    Enhanced postback endpoint that captures ALL data from survey partners
    
    Required: click_id
    Optional: status, payout, transaction_id, + ANY custom survey data
    """
    try:
        # Get ALL parameters
        if request.method == 'GET':
            all_params = dict(request.args)
        else:
            all_params = dict(request.form)
        
        # Log incoming postback
        logging.info(f"📥 POSTBACK RECEIVED: {all_params}")
        
        # Extract click_id (try multiple param names)
        click_id = (all_params.get('click_id') or 
                   all_params.get('clickid') or 
                   all_params.get('subid') or 
                   all_params.get('s1'))
        
        if not click_id:
            logging.warning("❌ Postback missing click_id")
            return "ERROR: click_id required", 400
        
        # Find original click
        from database import db_instance
        import secrets
        from datetime import datetime
        
        clicks_collection = db_instance.get_collection('clicks')
        click = clicks_collection.find_one({'click_id': click_id})
        
        if not click:
            logging.warning(f"❌ Click not found: {click_id}")
            return "ERROR: Click not found", 404
        
        # Extract standard fields
        status = all_params.get('status', 'approved').lower()
        payout = float(all_params.get('payout', 0))
        transaction_id = (all_params.get('transaction_id') or 
                         all_params.get('txn_id') or 
                         f'TXN-{secrets.token_hex(8).upper()}')
        
        # Capture ALL extra data as custom_data
        standard_fields = ['click_id', 'clickid', 'subid', 's1', 'status', 'payout', 'transaction_id', 'txn_id']
        custom_data = {k: v for k, v in all_params.items() if k not in standard_fields}
        
        # Create conversion with ALL data
        conversions_collection = db_instance.get_collection('conversions')
        conversion_id = f"CONV-{secrets.token_hex(6).upper()}"
        
        conversion_data = {
            'conversion_id': conversion_id,
            'click_id': click_id,
            'transaction_id': transaction_id,
            'offer_id': click.get('offer_id'),
            'user_id': click.get('user_id'),
            'affiliate_id': click.get('affiliate_id'),
            'status': status,
            'payout': payout,
            'currency': all_params.get('currency', 'USD'),
            'country': click.get('country', 'Unknown'),
            'device_type': click.get('device_type', 'unknown'),
            'ip_address': click.get('ip_address'),
            'sub_id1': click.get('sub_id1'),
            'sub_id2': click.get('sub_id2'),
            'sub_id3': click.get('sub_id3'),
            'conversion_time': datetime.utcnow(),
            
            # ✨ CAPTURE ALL SURVEY RESPONSES
            'custom_data': custom_data,
            'raw_postback': all_params,
            'survey_id': all_params.get('survey_id'),
            'partner_id': all_params.get('partner_id') or all_params.get('pid'),
            'session_id': all_params.get('session_id'),
            'postback_ip': request.remote_addr,
        }
        
        conversions_collection.insert_one(conversion_data)
        
        # Mark click as converted
        clicks_collection.update_one(
            {'click_id': click_id},
            {'$set': {'converted': True}}
        )
        
        logging.info(f"✅ Conversion: {conversion_id} | ${payout} | {len(custom_data)} custom fields")
        
        return "OK", 200
        
    except Exception as e:
        logging.error(f"❌ Postback error: {str(e)}", exc_info=True)
        return "ERROR", 500
