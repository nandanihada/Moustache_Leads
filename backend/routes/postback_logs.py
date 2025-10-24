from flask import Blueprint, request, jsonify
from database import db_instance
from utils.auth import token_required
import logging
from datetime import datetime, timedelta

postback_logs_bp = Blueprint('postback_logs', __name__)
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

@postback_logs_bp.route('/postback-logs', methods=['GET'])
@token_required
@admin_required
def get_postback_logs():
    """Get postback logs with filtering and pagination"""
    try:
        postback_logs_collection = db_instance.get_collection('postback_logs')
        
        # Get query parameters
        page = int(request.args.get('page', 1))
        limit = int(request.args.get('limit', 20))
        status = request.args.get('status')  # success/failed
        partner_id = request.args.get('partner_id')
        offer_id = request.args.get('offer_id')
        date_from = request.args.get('date_from')
        date_to = request.args.get('date_to')
        
        # Build query
        query = {}
        
        if status:
            query['status'] = status
        
        if partner_id:
            query['partner_id'] = partner_id
        
        if offer_id:
            query['offer_id'] = offer_id
        
        # Date range filter
        if date_from or date_to:
            query['created_at'] = {}
            if date_from:
                query['created_at']['$gte'] = datetime.fromisoformat(date_from.replace('Z', '+00:00'))
            if date_to:
                query['created_at']['$lte'] = datetime.fromisoformat(date_to.replace('Z', '+00:00'))
        
        # Get total count
        total = postback_logs_collection.count_documents(query)
        
        # Fetch logs with pagination
        skip = (page - 1) * limit
        logs = list(postback_logs_collection.find(query)
                   .sort('created_at', -1)
                   .skip(skip)
                   .limit(limit))
        
        # Convert ObjectId to string
        for log in logs:
            log['_id'] = str(log['_id'])
        
        return jsonify({
            'logs': logs,
            'total': total,
            'page': page,
            'limit': limit,
            'pages': (total + limit - 1) // limit
        }), 200
        
    except Exception as e:
        logger.error(f"Error fetching postback logs: {str(e)}")
        return jsonify({'error': str(e)}), 500

@postback_logs_bp.route('/postback-logs/stats', methods=['GET'])
@token_required
@admin_required
def get_postback_stats():
    """Get postback statistics"""
    try:
        postback_logs_collection = db_instance.get_collection('postback_logs')
        
        # Get date range from query params (default: last 30 days)
        date_from = request.args.get('date_from')
        date_to = request.args.get('date_to')
        
        query = {}
        if date_from or date_to:
            query['created_at'] = {}
            if date_from:
                query['created_at']['$gte'] = datetime.fromisoformat(date_from.replace('Z', '+00:00'))
            if date_to:
                query['created_at']['$lte'] = datetime.fromisoformat(date_to.replace('Z', '+00:00'))
        else:
            # Default: last 30 days
            query['created_at'] = {'$gte': datetime.utcnow() - timedelta(days=30)}
        
        # Get counts
        total_sent = postback_logs_collection.count_documents({**query, 'status': 'success'})
        total_failed = postback_logs_collection.count_documents({**query, 'status': 'failed'})
        total = total_sent + total_failed
        
        # Calculate success rate
        success_rate = (total_sent / total * 100) if total > 0 else 0
        
        # Get stats by partner
        pipeline = [
            {'$match': query},
            {'$group': {
                '_id': '$partner_id',
                'partner_name': {'$first': '$partner_name'},
                'total': {'$sum': 1},
                'success': {'$sum': {'$cond': [{'$eq': ['$status', 'success']}, 1, 0]}},
                'failed': {'$sum': {'$cond': [{'$eq': ['$status', 'failed']}, 1, 0]}}
            }},
            {'$sort': {'total': -1}},
            {'$limit': 10}
        ]
        
        partner_stats = list(postback_logs_collection.aggregate(pipeline))
        
        return jsonify({
            'total_sent': total_sent,
            'total_failed': total_failed,
            'total': total,
            'success_rate': round(success_rate, 2),
            'partner_stats': partner_stats
        }), 200
        
    except Exception as e:
        logger.error(f"Error fetching postback stats: {str(e)}")
        return jsonify({'error': str(e)}), 500

@postback_logs_bp.route('/postback-logs/<log_id>/retry', methods=['POST'])
@token_required
@admin_required
def retry_postback(log_id):
    """Retry a failed postback"""
    try:
        from services.tracking_service import TrackingService
        
        postback_logs_collection = db_instance.get_collection('postback_logs')
        postback_queue_collection = db_instance.get_collection('postback_queue')
        
        # Get the log entry
        log = postback_logs_collection.find_one({'log_id': log_id})
        if not log:
            return jsonify({'error': 'Log not found'}), 404
        
        # Check if already successful
        if log.get('status') == 'success':
            return jsonify({'error': 'Postback already successful'}), 400
        
        # Re-queue the postback
        postback_doc = {
            'postback_id': log.get('postback_id'),
            'conversion_id': log.get('conversion_id'),
            'offer_id': log.get('offer_id'),
            'partner_id': log.get('partner_id'),
            'partner_name': log.get('partner_name'),
            'url': log.get('url'),
            'method': log.get('method', 'GET'),
            'status': 'pending',
            'attempts': 0,
            'max_attempts': 3,
            'next_attempt': datetime.utcnow(),
            'created_at': datetime.utcnow()
        }
        
        # Check if already in queue
        existing = postback_queue_collection.find_one({
            'postback_id': log.get('postback_id'),
            'status': 'pending'
        })
        
        if existing:
            return jsonify({'error': 'Postback already queued for retry'}), 400
        
        # Insert into queue
        postback_queue_collection.insert_one(postback_doc)
        
        logger.info(f"✅ Postback re-queued for retry: {log_id}")
        
        return jsonify({
            'message': 'Postback queued for retry',
            'postback_id': log.get('postback_id')
        }), 200
        
    except Exception as e:
        logger.error(f"Error retrying postback: {str(e)}")
        return jsonify({'error': str(e)}), 500

@postback_logs_bp.route('/postback-logs/<log_id>', methods=['GET'])
@token_required
@admin_required
def get_postback_log_details(log_id):
    """Get detailed information about a specific postback log"""
    try:
        postback_logs_collection = db_instance.get_collection('postback_logs')
        
        log = postback_logs_collection.find_one({'log_id': log_id})
        if not log:
            return jsonify({'error': 'Log not found'}), 404
        
        log['_id'] = str(log['_id'])
        
        return jsonify({'log': log}), 200
        
    except Exception as e:
        logger.error(f"Error fetching postback log details: {str(e)}")
        return jsonify({'error': str(e)}), 500
