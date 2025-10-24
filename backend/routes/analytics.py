from flask import Blueprint, request, jsonify
from models.analytics import Analytics
from utils.auth import token_required
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
@admin_required
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
@admin_required
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
@admin_required
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
@admin_required
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

# Postback endpoint for external networks
@analytics_bp.route('/postback', methods=['GET', 'POST'])
def handle_postback():
    """Handle conversion postbacks from external networks"""
    try:
        # Get parameters from query string or form data
        if request.method == 'GET':
            params = request.args
        else:
            params = request.form
        
        # Extract common postback parameters
        subid = params.get('subid') or params.get('s1') or params.get('clickid')
        payout = float(params.get('payout', 0))
        status = params.get('status', 'approved')
        
        if not subid:
            return jsonify({'error': 'SubID required'}), 400
        
        # Track conversion
        conversion_data = {
            'subid': subid,
            'payout': payout,
            'conversion_type': params.get('type', 'lead'),
            'conversion_value': params.get('value'),
            'revenue': payout  # Assuming 1:1 for simplicity
        }
        
        conversion_record, error = analytics_model.track_conversion(conversion_data)
        
        if error:
            logging.warning(f"Postback conversion error: {error}")
            return "ERROR", 400
        
        return "OK", 200
        
    except Exception as e:
        logging.error(f"Postback error: {str(e)}", exc_info=True)
        return "ERROR", 500
