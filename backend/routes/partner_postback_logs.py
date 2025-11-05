"""
Partner Postback Logs Routes
Admin endpoints to view and manage partner postback distribution logs
"""

from flask import Blueprint, request, jsonify
from datetime import datetime, timedelta
from bson import ObjectId
import logging
from utils.auth import token_required

partner_postback_logs_bp = Blueprint('partner_postback_logs', __name__)
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

@partner_postback_logs_bp.route('/api/admin/partner-postback-logs', methods=['GET'])
@token_required
@admin_required
def get_partner_postback_logs():
    """Get partner postback logs with filtering"""
    try:
        partner_logs_collection = get_collection('partner_postback_logs')
        if partner_logs_collection is None:
            return jsonify({'error': 'Database not connected'}), 503
        
        # Get query parameters
        partner_id = request.args.get('partner_id')
        success = request.args.get('success')
        source_log_id = request.args.get('source_log_id')
        hours = int(request.args.get('hours', 24))
        limit = int(request.args.get('limit', 100))
        skip = int(request.args.get('skip', 0))
        
        # Build query
        query = {}
        
        if partner_id:
            query['partner_id'] = partner_id
        
        if success is not None:
            query['success'] = success.lower() == 'true'
        
        if source_log_id:
            query['source_log_id'] = source_log_id
        
        # Filter by time
        if hours > 0:
            cutoff_time = datetime.utcnow() - timedelta(hours=hours)
            query['timestamp'] = {'$gte': cutoff_time}
        
        # Get logs
        logs = list(partner_logs_collection.find(query)
                   .sort('timestamp', -1)
                   .skip(skip)
                   .limit(limit))
        
        # Convert ObjectId to string
        for log in logs:
            log['_id'] = str(log['_id'])
            if 'partner_id' in log and isinstance(log['partner_id'], ObjectId):
                log['partner_id'] = str(log['partner_id'])
        
        total = partner_logs_collection.count_documents(query)
        
        # Get statistics
        stats = {
            'total': total,
            'successful': partner_logs_collection.count_documents({**query, 'success': True}),
            'failed': partner_logs_collection.count_documents({**query, 'success': False})
        }
        
        return jsonify({
            'logs': logs,
            'total': total,
            'limit': limit,
            'skip': skip,
            'stats': stats
        }), 200
        
    except Exception as e:
        logger.error(f"Error fetching partner postback logs: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500

@partner_postback_logs_bp.route('/api/admin/partner-postback-logs/<log_id>', methods=['GET'])
@token_required
@admin_required
def get_partner_postback_log_detail(log_id):
    """Get detailed information about a specific partner postback log"""
    try:
        partner_logs_collection = get_collection('partner_postback_logs')
        if partner_logs_collection is None:
            return jsonify({'error': 'Database not connected'}), 503
        
        log = partner_logs_collection.find_one({'_id': ObjectId(log_id)})
        
        if not log:
            return jsonify({'error': 'Log not found'}), 404
        
        log['_id'] = str(log['_id'])
        if 'partner_id' in log and isinstance(log['partner_id'], ObjectId):
            log['partner_id'] = str(log['partner_id'])
        
        return jsonify(log), 200
        
    except Exception as e:
        logger.error(f"Error fetching partner postback log detail: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500

@partner_postback_logs_bp.route('/api/admin/partner-postback-logs/stats', methods=['GET'])
@token_required
@admin_required
def get_partner_postback_stats():
    """Get overall statistics for partner postback distribution"""
    try:
        partner_logs_collection = get_collection('partner_postback_logs')
        if partner_logs_collection is None:
            return jsonify({'error': 'Database not connected'}), 503
        
        hours = int(request.args.get('hours', 24))
        cutoff_time = datetime.utcnow() - timedelta(hours=hours)
        
        # Overall stats
        total = partner_logs_collection.count_documents({'timestamp': {'$gte': cutoff_time}})
        successful = partner_logs_collection.count_documents({
            'timestamp': {'$gte': cutoff_time},
            'success': True
        })
        failed = partner_logs_collection.count_documents({
            'timestamp': {'$gte': cutoff_time},
            'success': False
        })
        
        # Success rate
        success_rate = (successful / total * 100) if total > 0 else 0
        
        # Average response time
        pipeline = [
            {'$match': {
                'timestamp': {'$gte': cutoff_time},
                'response_time': {'$ne': None}
            }},
            {'$group': {
                '_id': None,
                'avg_response_time': {'$avg': '$response_time'}
            }}
        ]
        
        avg_result = list(partner_logs_collection.aggregate(pipeline))
        avg_response_time = avg_result[0]['avg_response_time'] if avg_result else 0
        
        # Partner breakdown
        partner_pipeline = [
            {'$match': {'timestamp': {'$gte': cutoff_time}}},
            {'$group': {
                '_id': '$partner_id',
                'partner_name': {'$first': '$partner_name'},
                'total': {'$sum': 1},
                'successful': {
                    '$sum': {'$cond': [{'$eq': ['$success', True]}, 1, 0]}
                },
                'failed': {
                    '$sum': {'$cond': [{'$eq': ['$success', False]}, 1, 0]}
                }
            }},
            {'$sort': {'total': -1}},
            {'$limit': 10}
        ]
        
        partner_stats = list(partner_logs_collection.aggregate(partner_pipeline))
        
        # Convert ObjectId to string
        for stat in partner_stats:
            if isinstance(stat['_id'], ObjectId):
                stat['_id'] = str(stat['_id'])
        
        return jsonify({
            'total': total,
            'successful': successful,
            'failed': failed,
            'success_rate': round(success_rate, 2),
            'avg_response_time': round(avg_response_time, 3) if avg_response_time else 0,
            'partner_breakdown': partner_stats,
            'time_period_hours': hours
        }), 200
        
    except Exception as e:
        logger.error(f"Error fetching partner postback stats: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500

@partner_postback_logs_bp.route('/api/admin/partner-postback-logs/retry-failed', methods=['POST'])
@token_required
@admin_required
def retry_failed_partner_postbacks():
    """Retry failed partner postbacks"""
    try:
        from services.partner_postback_service import partner_postback_service
        from database import db_instance
        
        data = request.get_json() or {}
        hours = int(data.get('hours', 24))
        
        logger.info(f"🔄 Starting retry of failed postbacks from last {hours} hours")
        
        result = partner_postback_service.retry_failed_postbacks(db_instance, hours)
        
        return jsonify({
            'success': True,
            'message': f"Retry completed",
            'total_retried': result.get('total_retried', 0),
            'succeeded': result.get('succeeded', 0),
            'failed': result.get('failed', 0)
        }), 200
        
    except Exception as e:
        logger.error(f"Error retrying failed postbacks: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500

@partner_postback_logs_bp.route('/api/admin/partner-postback-logs/delete-old', methods=['DELETE'])
@token_required
@admin_required
def delete_old_partner_postback_logs():
    """Delete old partner postback logs"""
    try:
        partner_logs_collection = get_collection('partner_postback_logs')
        if partner_logs_collection is None:
            return jsonify({'error': 'Database not connected'}), 503
        
        data = request.get_json() or {}
        days = int(data.get('days', 30))
        
        cutoff_time = datetime.utcnow() - timedelta(days=days)
        
        result = partner_logs_collection.delete_many({
            'timestamp': {'$lt': cutoff_time}
        })
        
        logger.info(f"🗑️ Deleted {result.deleted_count} old partner postback logs (older than {days} days)")
        
        return jsonify({
            'success': True,
            'deleted_count': result.deleted_count,
            'message': f"Deleted logs older than {days} days"
        }), 200
        
    except Exception as e:
        logger.error(f"Error deleting old logs: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500
