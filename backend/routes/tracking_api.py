"""
Tracking API Routes
Handles offer completion tracking, click tracking, and tracking statistics
"""

from flask import Blueprint, request, jsonify
from services.tracking_service import TrackingService
from models.tracking_events import TrackingEvents
from utils.auth import token_required, subadmin_or_admin_required
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)

tracking_api_bp = Blueprint('tracking_api', __name__)
tracking_service = TrackingService()
tracking_events = TrackingEvents()

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

@tracking_api_bp.route('/track/completion', methods=['POST'])
def track_offer_completion():
    """
    Track offer completion from external sources
    Can be called by offer walls, partners, or direct integrations
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        # Required fields
        offer_id = data.get('offer_id')
        user_id = data.get('user_id')
        
        if not offer_id or not user_id:
            return jsonify({'error': 'offer_id and user_id are required'}), 400
        
        # Optional external data
        external_data = {
            'transaction_id': data.get('transaction_id'),
            'payout': data.get('payout'),
            'revenue': data.get('revenue'),
            'status': data.get('status', 'approved'),
            'external_id': data.get('external_id'),
            'ip_address': request.remote_addr,
            'user_agent': request.headers.get('User-Agent'),
            'country': data.get('country'),
            'sub_ids': data.get('sub_ids', {}),
            'completion_data': data.get('completion_data', {})
        }
        
        # Track the completion
        result = tracking_service.track_offer_completion(offer_id, user_id, external_data)
        
        if 'error' in result:
            return jsonify({'error': result['error']}), 400
        
        return jsonify({
            'success': True,
            'message': result['message'],
            'click_id': result['click_id'],
            'conversion_id': result['conversion_id']
        }), 200
        
    except Exception as e:
        logger.error(f"Error in track_offer_completion: {str(e)}")
        return jsonify({'error': f'Internal server error: {str(e)}'}), 500

@tracking_api_bp.route('/track/click', methods=['POST'])
@token_required
def track_offer_click():
    """
    Track offer click (for frontend integration)
    """
    try:
        data = request.get_json()
        user = request.current_user
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        offer_id = data.get('offer_id')
        if not offer_id:
            return jsonify({'error': 'offer_id is required'}), 400
        
        # Generate tracking link
        sub_ids = data.get('sub_ids', [])
        result = tracking_service.generate_tracking_link(
            offer_id=offer_id,
            affiliate_id=str(user['_id']),
            sub_ids=sub_ids
        )
        
        if 'error' in result:
            return jsonify({'error': result['error']}), 400
        
        return jsonify({
            'success': True,
            'tracking_url': result['tracking_url'],
            'click_id': result['click_id'],
            'expires_at': result['expires_at'].isoformat()
        }), 200
        
    except Exception as e:
        logger.error(f"Error in track_offer_click: {str(e)}")
        return jsonify({'error': f'Internal server error: {str(e)}'}), 500

@tracking_api_bp.route('/track/stats', methods=['GET'])
@token_required
def get_tracking_stats():
    """
    Get tracking statistics for current user or admin
    """
    try:
        user = request.current_user
        
        # Query parameters
        offer_id = request.args.get('offer_id')
        days = int(request.args.get('days', 7))
        
        # Date range
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=days)
        date_range = {'start': start_date, 'end': end_date}
        
        # For non-admin users, filter by their user ID
        user_id = None if user.get('role') == 'admin' else str(user['_id'])
        
        # Get stats
        stats = tracking_service.get_tracking_stats(
            offer_id=offer_id,
            user_id=user_id,
            date_range=date_range
        )
        
        if 'error' in stats:
            return jsonify({'error': stats['error']}), 500
        
        return jsonify({
            'success': True,
            'stats': stats,
            'date_range': {
                'start': start_date.isoformat(),
                'end': end_date.isoformat(),
                'days': days
            }
        }), 200
        
    except Exception as e:
        logger.error(f"Error in get_tracking_stats: {str(e)}")
        return jsonify({'error': f'Internal server error: {str(e)}'}), 500

@tracking_api_bp.route('/track/events', methods=['GET'])
@token_required
@subadmin_or_admin_required('tracking')
def get_tracking_events():
    """
    Get recent tracking events (Admin only)
    """
    try:
        # Query parameters
        limit = min(int(request.args.get('limit', 100)), 500)  # Max 500
        event_type = request.args.get('event_type')
        offer_id = request.args.get('offer_id')
        user_id = request.args.get('user_id')
        
        # Get events
        events = tracking_events.get_recent_events(
            limit=limit,
            event_type=event_type,
            offer_id=offer_id,
            user_id=user_id
        )
        
        return jsonify({
            'success': True,
            'events': events,
            'count': len(events)
        }), 200
        
    except Exception as e:
        logger.error(f"Error in get_tracking_events: {str(e)}")
        return jsonify({'error': f'Internal server error: {str(e)}'}), 500

@tracking_api_bp.route('/track/events/stats', methods=['GET'])
@token_required
@subadmin_or_admin_required('tracking')
def get_event_stats():
    """
    Get event statistics (Admin only)
    """
    try:
        hours = int(request.args.get('hours', 24))
        
        stats = tracking_events.get_event_stats(hours=hours)
        
        return jsonify({
            'success': True,
            'stats': stats
        }), 200
        
    except Exception as e:
        logger.error(f"Error in get_event_stats: {str(e)}")
        return jsonify({'error': f'Internal server error: {str(e)}'}), 500

@tracking_api_bp.route('/track/offer/<offer_id>/events', methods=['GET'])
@token_required
@subadmin_or_admin_required('tracking')
def get_offer_events(offer_id):
    """
    Get tracking events for a specific offer (Admin only)
    """
    try:
        limit = min(int(request.args.get('limit', 50)), 200)
        
        events = tracking_events.get_events_by_offer(offer_id, limit=limit)
        
        return jsonify({
            'success': True,
            'offer_id': offer_id,
            'events': events,
            'count': len(events)
        }), 200
        
    except Exception as e:
        logger.error(f"Error in get_offer_events: {str(e)}")
        return jsonify({'error': f'Internal server error: {str(e)}'}), 500

@tracking_api_bp.route('/track/user/<user_id>/events', methods=['GET'])
@token_required
@subadmin_or_admin_required('tracking')
def get_user_events(user_id):
    """
    Get tracking events for a specific user (Admin only)
    """
    try:
        limit = min(int(request.args.get('limit', 50)), 200)
        
        events = tracking_events.get_events_by_user(user_id, limit=limit)
        
        return jsonify({
            'success': True,
            'user_id': user_id,
            'events': events,
            'count': len(events)
        }), 200
        
    except Exception as e:
        logger.error(f"Error in get_user_events: {str(e)}")
        return jsonify({'error': f'Internal server error: {str(e)}'}), 500

# Webhook endpoint for external postbacks (no auth required)
@tracking_api_bp.route('/webhook/completion/<offer_id>', methods=['POST'])
def webhook_offer_completion(offer_id):
    """
    Webhook endpoint for external offer completion notifications
    Used by partners to notify us of completions
    """
    try:
        data = request.get_json() or {}
        
        # Extract user identification
        user_id = data.get('user_id') or data.get('affiliate_id') or data.get('sub_id')
        
        if not user_id:
            return jsonify({'error': 'user_id is required'}), 400
        
        # Build external data
        external_data = {
            'transaction_id': data.get('transaction_id') or data.get('txn_id'),
            'payout': data.get('payout') or data.get('amount'),
            'revenue': data.get('revenue'),
            'status': data.get('status', 'approved'),
            'external_id': data.get('external_id') or data.get('reference_id'),
            'ip_address': request.remote_addr,
            'user_agent': request.headers.get('User-Agent'),
            'country': data.get('country'),
            'webhook_data': data  # Store full webhook data
        }
        
        # Track the completion
        result = tracking_service.track_offer_completion(offer_id, user_id, external_data)
        
        if 'error' in result:
            logger.error(f"Webhook completion error for offer {offer_id}: {result['error']}")
            return jsonify({'error': result['error']}), 400
        
        logger.info(f"Webhook completion tracked for offer {offer_id}, user {user_id}")
        
        return jsonify({
            'success': True,
            'message': 'Completion tracked successfully',
            'conversion_id': result['conversion_id']
        }), 200
        
    except Exception as e:
        logger.error(f"Error in webhook_offer_completion: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500
