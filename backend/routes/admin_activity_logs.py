"""
Admin Activity Logs Route
API endpoints for viewing and managing admin activity logs
"""

from flask import Blueprint, request, jsonify
from models.admin_activity_log import AdminActivityLog
from utils.auth import token_required, subadmin_or_admin_required
from datetime import datetime
import logging

admin_activity_logs_bp = Blueprint('admin_activity_logs', __name__)
log_model = AdminActivityLog()


@admin_activity_logs_bp.route('/activity-logs', methods=['GET'])
@token_required
@subadmin_or_admin_required('fraud-management')
def get_activity_logs():
    """Get paginated, filtered activity logs"""
    try:
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 25))
        category = request.args.get('category', '')
        action = request.args.get('action', '')
        admin_username = request.args.get('admin', '')
        network = request.args.get('network', '')
        search = request.args.get('search', '')
        date_from = request.args.get('date_from', '')
        date_to = request.args.get('date_to', '')
        sort_field = request.args.get('sort_field', 'timestamp')
        sort_order = int(request.args.get('sort_order', -1))

        filters = {}
        if category:
            filters['category'] = category
        if action:
            filters['action'] = action
        if admin_username:
            filters['admin_username'] = admin_username
        if network:
            filters['network'] = network
        if search:
            filters['search'] = search
        if date_from:
            try:
                filters['date_from'] = datetime.fromisoformat(date_from.replace('Z', '+00:00'))
            except ValueError:
                pass
        if date_to:
            try:
                filters['date_to'] = datetime.fromisoformat(date_to.replace('Z', '+00:00'))
            except ValueError:
                pass

        logs, total = log_model.get_logs(
            filters=filters,
            page=page,
            per_page=per_page,
            sort_field=sort_field,
            sort_order=sort_order
        )

        return jsonify({
            'success': True,
            'logs': logs,
            'total': total,
            'page': page,
            'per_page': per_page,
            'total_pages': (total + per_page - 1) // per_page
        }), 200

    except Exception as e:
        logging.error(f"Get activity logs error: {e}", exc_info=True)
        return jsonify({'error': f'Failed to get activity logs: {str(e)}'}), 500


@admin_activity_logs_bp.route('/activity-logs', methods=['DELETE'])
@token_required
@subadmin_or_admin_required('fraud-management')
def delete_activity_logs():
    """Delete selected activity logs"""
    try:
        data = request.get_json()
        log_ids = data.get('log_ids', [])

        if not log_ids:
            return jsonify({'error': 'No log IDs provided'}), 400

        deleted = log_model.delete_logs(log_ids)

        return jsonify({
            'success': True,
            'deleted_count': deleted,
            'message': f'{deleted} log(s) deleted successfully'
        }), 200

    except Exception as e:
        logging.error(f"Delete activity logs error: {e}", exc_info=True)
        return jsonify({'error': f'Failed to delete logs: {str(e)}'}), 500


@admin_activity_logs_bp.route('/activity-logs/filters', methods=['GET'])
@token_required
@subadmin_or_admin_required('fraud-management')
def get_filter_options():
    """Get distinct filter values for dropdowns"""
    try:
        options = log_model.get_filter_options()
        return jsonify({'success': True, **options}), 200
    except Exception as e:
        logging.error(f"Get filter options error: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500
