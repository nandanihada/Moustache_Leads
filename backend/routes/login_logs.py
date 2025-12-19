"""
Login Logs Routes
API endpoints for viewing and managing login logs and activity tracking
"""

from flask import Blueprint, request, jsonify
from models.login_logs import LoginLog
from models.page_visits import PageVisit
from models.active_sessions import ActiveSession
from utils.auth import token_required_with_user, admin_required, subadmin_or_admin_required
from utils.mongodb_json import mongodb_to_json
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)

login_logs_bp = Blueprint('login_logs', __name__)

@login_logs_bp.route('/login-logs', methods=['GET'])
@token_required_with_user
@subadmin_or_admin_required('login-logs')
def get_login_logs(current_user):
    """Get login logs with filters and pagination"""
    try:
        # Get query parameters
        page = int(request.args.get('page', 1))
        limit = int(request.args.get('limit', 100))
        status = request.args.get('status')
        user_id = request.args.get('user_id')
        email = request.args.get('email')
        login_method = request.args.get('login_method')
        ip_address = request.args.get('ip_address')
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        sort_by = request.args.get('sort_by', 'login_time')
        sort_order = int(request.args.get('sort_order', -1))
        
        # Build filters
        filters = {}
        
        if status:
            filters['status'] = status
        
        if user_id:
            filters['user_id'] = user_id
        
        if email:
            filters['email'] = email
        
        if login_method:
            filters['login_method'] = login_method
        
        if ip_address:
            filters['ip_address'] = ip_address
        
        if start_date and end_date:
            try:
                filters['start_date'] = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
                filters['end_date'] = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
            except ValueError as e:
                return jsonify({'error': f'Invalid date format: {str(e)}'}), 400
        
        # Get login logs
        login_log_model = LoginLog()
        result = login_log_model.get_logs(
            filters=filters,
            page=page,
            limit=limit,
            sort_by=sort_by,
            sort_order=sort_order
        )
        
        # Convert MongoDB objects to JSON-serializable format
        result = mongodb_to_json(result)
        
        return jsonify(result), 200
        
    except Exception as e:
        logger.error(f"Error getting login logs: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to get login logs: {str(e)}'}), 500


@login_logs_bp.route('/login-logs/<log_id>', methods=['GET'])
@token_required_with_user
@subadmin_or_admin_required('login-logs')
def get_login_log(current_user, log_id):
    """Get a specific login log by ID"""
    try:
        login_log_model = LoginLog()
        log = login_log_model.get_log_by_id(log_id)
        
        if not log:
            return jsonify({'error': 'Login log not found'}), 404
        
        return jsonify(mongodb_to_json(log)), 200
        
    except Exception as e:
        logger.error(f"Error getting login log: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to get login log: {str(e)}'}), 500


@login_logs_bp.route('/login-logs/user/<user_id>', methods=['GET'])
@token_required_with_user
def get_user_login_history(current_user, user_id):
    """Get login history for a specific user"""
    try:
        # Users can only view their own history unless they're admin
        if current_user.get('role') != 'admin' and str(current_user.get('_id')) != user_id:
            return jsonify({'error': 'Unauthorized'}), 403
        
        limit = int(request.args.get('limit', 50))
        
        login_log_model = LoginLog()
        logs = login_log_model.get_user_login_history(user_id, limit=limit)
        
        return jsonify({'logs': mongodb_to_json(logs)}), 200
        
    except Exception as e:
        logger.error(f"Error getting user login history: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to get login history: {str(e)}'}), 500


@login_logs_bp.route('/login-logs/stats', methods=['GET'])
@token_required_with_user
@subadmin_or_admin_required('login-logs')
def get_login_stats(current_user):
    """Get login statistics"""
    try:
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        
        # Parse dates if provided
        start_dt = None
        end_dt = None
        
        if start_date:
            try:
                start_dt = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
            except ValueError:
                return jsonify({'error': 'Invalid start_date format'}), 400
        
        if end_date:
            try:
                end_dt = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
            except ValueError:
                return jsonify({'error': 'Invalid end_date format'}), 400
        
        login_log_model = LoginLog()
        stats = login_log_model.get_stats(start_date=start_dt, end_date=end_dt)
        
        return jsonify(mongodb_to_json(stats)), 200
        
    except Exception as e:
        logger.error(f"Error getting login stats: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to get login stats: {str(e)}'}), 500


@login_logs_bp.route('/login-logs/failed-attempts', methods=['GET'])
@token_required_with_user
@subadmin_or_admin_required('login-logs')
def get_failed_attempts(current_user):
    """Get recent failed login attempts"""
    try:
        user_id = request.args.get('user_id')
        hours = int(request.args.get('hours', 24))
        
        login_log_model = LoginLog()
        attempts = login_log_model.get_failed_login_attempts(user_id=user_id, hours=hours)
        
        return jsonify({'attempts': mongodb_to_json(attempts)}), 200
        
    except Exception as e:
        logger.error(f"Error getting failed attempts: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to get failed attempts: {str(e)}'}), 500


@login_logs_bp.route('/active-sessions', methods=['GET'])
@token_required_with_user
@subadmin_or_admin_required('active-users')
def get_active_sessions(current_user):
    """Get all currently active sessions"""
    try:
        include_idle = request.args.get('include_idle', 'true').lower() == 'true'
        
        active_session_model = ActiveSession()
        sessions = active_session_model.get_active_sessions(include_idle=include_idle)
        
        return jsonify({'sessions': mongodb_to_json(sessions), 'count': len(sessions)}), 200
        
    except Exception as e:
        logger.error(f"Error getting active sessions: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to get active sessions: {str(e)}'}), 500


@login_logs_bp.route('/active-sessions/<session_id>', methods=['GET'])
@token_required_with_user
def get_session(current_user, session_id):
    """Get a specific session"""
    try:
        active_session_model = ActiveSession()
        session = active_session_model.get_session(session_id)
        
        if not session:
            return jsonify({'error': 'Session not found'}), 404
        
        # Users can only view their own session unless they're admin
        if current_user.get('role') != 'admin' and session.get('user_id') != str(current_user.get('_id')):
            return jsonify({'error': 'Unauthorized'}), 403
        
        return jsonify(mongodb_to_json(session)), 200
        
    except Exception as e:
        logger.error(f"Error getting session: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to get session: {str(e)}'}), 500


@login_logs_bp.route('/active-sessions/heartbeat', methods=['POST'])
@token_required_with_user
def update_heartbeat(current_user):
    """Update session heartbeat"""
    try:
        data = request.get_json()
        session_id = data.get('session_id')
        current_page = data.get('current_page')
        
        if not session_id:
            return jsonify({'error': 'session_id is required'}), 400
        
        active_session_model = ActiveSession()
        success = active_session_model.update_heartbeat(session_id, current_page=current_page)
        
        if success:
            return jsonify({'message': 'Heartbeat updated'}), 200
        else:
            return jsonify({'error': 'Failed to update heartbeat'}), 500
        
    except Exception as e:
        logger.error(f"Error updating heartbeat: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to update heartbeat: {str(e)}'}), 500


@login_logs_bp.route('/active-sessions/stats', methods=['GET'])
@token_required_with_user
@subadmin_or_admin_required('active-users')
def get_session_stats(current_user):
    """Get session statistics"""
    try:
        active_session_model = ActiveSession()
        stats = active_session_model.get_stats()
        
        return jsonify(mongodb_to_json(stats)), 200
        
    except Exception as e:
        logger.error(f"Error getting session stats: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to get session stats: {str(e)}'}), 500


@login_logs_bp.route('/page-visits/<session_id>', methods=['GET'])
@token_required_with_user
def get_page_visits(current_user, session_id):
    """Get page visits for a session"""
    try:
        limit = int(request.args.get('limit', 10))
        
        # Verify session belongs to user (unless admin)
        if current_user.get('role') != 'admin':
            active_session_model = ActiveSession()
            session = active_session_model.get_session(session_id)
            
            if not session or session.get('user_id') != str(current_user.get('_id')):
                return jsonify({'error': 'Unauthorized'}), 403
        
        page_visit_model = PageVisit()
        visits = page_visit_model.get_session_visits(session_id, limit=limit)
        
        # Convert MongoDB objects to JSON-serializable format
        visits = mongodb_to_json(visits)
        
        return jsonify({'visits': visits}), 200
        
    except Exception as e:
        logger.error(f"Error getting page visits: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to get page visits: {str(e)}'}), 500


@login_logs_bp.route('/page-visits/track', methods=['POST'])
@token_required_with_user
def track_page_visit(current_user):
    """Track a page visit"""
    try:
        from services.activity_tracking_service import activity_tracking_service
        
        data = request.get_json()
        session_id = data.get('session_id')
        page_url = data.get('page_url')
        page_title = data.get('page_title', '')
        referrer = data.get('referrer', '')
        
        if not session_id or not page_url:
            return jsonify({'error': 'session_id and page_url are required'}), 400
        
        page_data = {
            'page_url': page_url,
            'page_title': page_title,
            'referrer': referrer
        }
        
        visit_id = activity_tracking_service.track_page_visit(
            session_id,
            str(current_user.get('_id')),
            page_data,
            request
        )
        
        if visit_id:
            return jsonify({'message': 'Page visit tracked', 'visit_id': visit_id}), 200
        else:
            return jsonify({'error': 'Failed to track page visit'}), 500
        
    except Exception as e:
        logger.error(f"Error tracking page visit: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to track page visit: {str(e)}'}), 500


@login_logs_bp.route('/page-visits/popular', methods=['GET'])
@token_required_with_user
@subadmin_or_admin_required('login-logs')
def get_popular_pages(current_user):
    """Get most visited pages"""
    try:
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        limit = int(request.args.get('limit', 10))
        
        # Parse dates if provided
        start_dt = None
        end_dt = None
        
        if start_date:
            start_dt = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
        
        if end_date:
            end_dt = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
        
        page_visit_model = PageVisit()
        pages = page_visit_model.get_popular_pages(
            start_date=start_dt,
            end_date=end_dt,
            limit=limit
        )
        
        return jsonify({'pages': mongodb_to_json(pages)}), 200
        
    except Exception as e:
        logger.error(f"Error getting popular pages: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to get popular pages: {str(e)}'}), 500


@login_logs_bp.route('/activity-stats/overview', methods=['GET'])
@token_required_with_user
@subadmin_or_admin_required('login-logs')
def get_activity_overview(current_user):
    """Get comprehensive activity overview"""
    try:
        # Get login stats
        login_log_model = LoginLog()
        login_stats = login_log_model.get_stats()
        
        # Get session stats
        active_session_model = ActiveSession()
        session_stats = active_session_model.get_stats()
        
        # Get popular pages
        page_visit_model = PageVisit()
        popular_pages = page_visit_model.get_popular_pages(limit=5)
        
        return jsonify({
            'login_stats': mongodb_to_json(login_stats),
            'session_stats': mongodb_to_json(session_stats),
            'popular_pages': mongodb_to_json(popular_pages)
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting activity overview: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to get activity overview: {str(e)}'}), 500
