"""
Forwarded Postbacks API Routes
Handles viewing and managing postbacks forwarded to downward partners
"""

from flask import Blueprint, request, jsonify
from bson import ObjectId
from datetime import datetime
import sys
import os

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import db_instance
from utils.auth import token_required

forwarded_postbacks_bp = Blueprint('forwarded_postbacks', __name__)

def admin_required(f):
    """Decorator to require admin role"""
    from functools import wraps
    @wraps(f)
    def decorated_function(*args, **kwargs):
        user = getattr(request, 'current_user', None)
        if not user or user.get('role') not in ['admin', 'subadmin']:
            return jsonify({'error': 'Admin access required'}), 403
        return f(*args, **kwargs)
    return decorated_function

@forwarded_postbacks_bp.route('/admin/forwarded-postbacks', methods=['GET'])
@token_required
@admin_required
def get_forwarded_postbacks():
    """Get list of forwarded postbacks"""
    try:
        import logging
        logger = logging.getLogger(__name__)
        logger.info("Fetching forwarded postbacks...")
        
        # Get query parameters
        limit = int(request.args.get('limit', 50))
        offset = int(request.args.get('offset', 0))
        publisher_id = request.args.get('publisher_id')
        
        logger.info(f"Query params - limit: {limit}, offset: {offset}, publisher_id: {publisher_id}")
        
        # Build query
        query = {}
        if publisher_id:
            query['publisher_id'] = publisher_id
        
        # Get forwarded postbacks
        if not db_instance.is_connected():
            logger.error("Database not connected")
            return jsonify({'success': False, 'error': 'Database not available'}), 503
            
        forwarded_postbacks_collection = db_instance.get_collection('forwarded_postbacks')
        if forwarded_postbacks_collection is None:
            logger.error("Could not get forwarded_postbacks collection")
            return jsonify({'success': False, 'error': 'Database collection not available'}), 503
        
        logger.info("Querying database...")
        forwarded_postbacks = list(
            forwarded_postbacks_collection.find(query)
            .sort('timestamp', -1)
            .skip(offset)
            .limit(limit)
        )
        
        logger.info(f"Found {len(forwarded_postbacks)} forwarded postbacks")
        
        # Convert ObjectId to string
        for postback in forwarded_postbacks:
            postback['_id'] = str(postback['_id'])
            if 'original_postback_id' in postback and isinstance(postback['original_postback_id'], ObjectId):
                postback['original_postback_id'] = str(postback['original_postback_id'])
        
        total = forwarded_postbacks_collection.count_documents(query)
        
        logger.info(f"Returning {len(forwarded_postbacks)} of {total} total forwarded postbacks")
        
        return jsonify({
            'success': True,
            'logs': forwarded_postbacks,
            'total': total
        })
        
    except Exception as e:
        import traceback
        error_msg = f"Error fetching forwarded postbacks: {str(e)}\n{traceback.format_exc()}"
        print(error_msg)
        logging.error(error_msg)
        return jsonify({'success': False, 'error': str(e)}), 500


@forwarded_postbacks_bp.route('/admin/forwarded-postbacks/<postback_id>', methods=['GET'])
@token_required
@admin_required
def get_forwarded_postback_details(postback_id):
    """Get details of a specific forwarded postback"""
    try:
        # Get postback
        forwarded_postbacks_collection = db_instance.get_collection('forwarded_postbacks')
        if not forwarded_postbacks_collection:
            return jsonify({'success': False, 'error': 'Database not available'}), 503
            
        postback = forwarded_postbacks_collection.find_one({'_id': ObjectId(postback_id)})
        
        if not postback:
            return jsonify({'success': False, 'error': 'Postback not found'}), 404
        
        # Convert ObjectId to string
        postback['_id'] = str(postback['_id'])
        if 'original_postback_id' in postback and isinstance(postback['original_postback_id'], ObjectId):
            postback['original_postback_id'] = str(postback['original_postback_id'])
        
        return jsonify({
            'success': True,
            'postback': postback
        })
        
    except Exception as e:
        print(f"Error fetching forwarded postback details: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@forwarded_postbacks_bp.route('/admin/forwarded-postbacks/bulk-delete', methods=['POST'])
@token_required
@admin_required
def bulk_delete_forwarded_postbacks():
    """Bulk delete forwarded postbacks"""
    try:
        import logging
        logger = logging.getLogger(__name__)
        
        data = request.get_json()
        
        if not data or 'log_ids' not in data:
            return jsonify({'error': 'log_ids array is required'}), 400
        
        log_ids = data['log_ids']
        
        if not isinstance(log_ids, list) or len(log_ids) == 0:
            return jsonify({'error': 'log_ids must be a non-empty array'}), 400
        
        forwarded_postbacks_collection = db_instance.get_collection('forwarded_postbacks')
        if not forwarded_postbacks_collection:
            return jsonify({'error': 'Database not available'}), 503
        
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
        result = forwarded_postbacks_collection.delete_many({'_id': {'$in': object_ids}})
        
        logger.info(f"✅ Bulk deleted {result.deleted_count} forwarded postback logs")
        
        return jsonify({
            'message': f'Successfully deleted {result.deleted_count} forwarded postback logs',
            'deleted_count': result.deleted_count
        }), 200
        
    except Exception as e:
        import logging
        logging.error(f"Error bulk deleting forwarded postbacks: {str(e)}")
        return jsonify({'error': str(e)}), 500
