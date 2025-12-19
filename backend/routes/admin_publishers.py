from flask import Blueprint, request, jsonify
from utils.auth import token_required, admin_required, subadmin_or_admin_required
from models.user import User
from models.placement import Placement
from bson import ObjectId
import logging

logger = logging.getLogger(__name__)

admin_publishers_bp = Blueprint('admin_publishers', __name__)

@admin_publishers_bp.route('/publishers', methods=['GET'])
@token_required
@subadmin_or_admin_required('publishers')
def get_all_publishers():
    """Get all publishers with their details and statistics"""
    try:
        page = int(request.args.get('page', 1))
        size = int(request.args.get('size', 20))
        search = request.args.get('search', '')
        status_filter = request.args.get('status_filter', 'all')  # all, active, blocked
        
        user_model = User()
        placement_model = Placement()
        
        # Build query filter
        query_filter = {'role': {'$in': ['publisher', 'user']}}  # Include both roles
        
        if search:
            query_filter['$or'] = [
                {'username': {'$regex': search, '$options': 'i'}},
                {'email': {'$regex': search, '$options': 'i'}},
                {'firstName': {'$regex': search, '$options': 'i'}},
                {'lastName': {'$regex': search, '$options': 'i'}},
                {'companyName': {'$regex': search, '$options': 'i'}}
            ]
        
        if status_filter == 'active':
            query_filter['status'] = {'$ne': 'blocked'}
        elif status_filter == 'blocked':
            query_filter['status'] = 'blocked'
        
        # Get total count
        total = user_model.collection.count_documents(query_filter)
        
        # Get publishers with pagination
        skip = (page - 1) * size
        publishers = list(user_model.collection.find(
            query_filter,
            {
                'password': 1,  # Include password for admin view
                'username': 1,
                'email': 1,
                'firstName': 1,
                'lastName': 1,
                'companyName': 1,
                'website': 1,
                'postbackUrl': 1,
                'role': 1,
                'status': 1,
                'created_at': 1,
                'updated_at': 1,
                'lastLogin': 1
            }
        ).sort('created_at', -1).skip(skip).limit(size))
        
        # Get placement statistics for each publisher
        publisher_list = []
        for publisher in publishers:
            publisher_id = str(publisher['_id'])
            
            # Get placement stats using simple queries (more reliable)
            try:
                total_placements = placement_model.collection.count_documents({'publisherId': ObjectId(publisher_id)})
                approved_placements = placement_model.collection.count_documents({'publisherId': ObjectId(publisher_id), 'approvalStatus': 'APPROVED'})
                pending_placements = placement_model.collection.count_documents({'publisherId': ObjectId(publisher_id), 'approvalStatus': 'PENDING_APPROVAL'})
                rejected_placements = placement_model.collection.count_documents({'publisherId': ObjectId(publisher_id), 'approvalStatus': 'REJECTED'})
                
                stats = {
                    'total': total_placements,
                    'approved': approved_placements,
                    'pending': pending_placements,
                    'rejected': rejected_placements
                }
            except Exception as stats_error:
                logger.warning(f"Error getting stats for publisher {publisher.get('username')}: {stats_error}")
                stats = {'total': 0, 'approved': 0, 'pending': 0, 'rejected': 0}
            
            publisher_data = {
                'id': publisher_id,
                'username': publisher['username'],
                'email': publisher['email'],
                'firstName': publisher.get('firstName', ''),
                'lastName': publisher.get('lastName', ''),
                'companyName': publisher.get('companyName', ''),
                'website': publisher.get('website', ''),
                'postbackUrl': publisher.get('postbackUrl', ''),
                'role': publisher.get('role', 'user'),
                'status': publisher.get('status', 'active'),
                'password': publisher.get('password', ''),  # For admin view only
                'createdAt': publisher['created_at'].isoformat() if publisher.get('created_at') and hasattr(publisher.get('created_at'), 'isoformat') else None,
                'updatedAt': publisher.get('updated_at').isoformat() if publisher.get('updated_at') and hasattr(publisher.get('updated_at'), 'isoformat') else None,
                'lastLogin': publisher.get('lastLogin').isoformat() if publisher.get('lastLogin') and hasattr(publisher.get('lastLogin'), 'isoformat') else None,
                'placementStats': stats
            }
            publisher_list.append(publisher_data)
        
        return jsonify({
            'publishers': publisher_list,
            'pagination': {
                'page': page,
                'size': size,
                'total': total,
                'pages': (total + size - 1) // size
            }
        }), 200
        
    except Exception as e:
        logger.error(f"Error fetching publishers: {e}")
        return jsonify({'error': 'Failed to fetch publishers'}), 500

@admin_publishers_bp.route('/publishers/<publisher_id>', methods=['GET'])
@token_required
@subadmin_or_admin_required('publishers')
def get_publisher_details(publisher_id):
    """Get detailed information about a specific publisher"""
    try:
        user_model = User()
        placement_model = Placement()
        
        # Get publisher details
        publisher = user_model.collection.find_one({'_id': ObjectId(publisher_id)})
        if not publisher:
            return jsonify({'error': 'Publisher not found'}), 404
        
        # Get all placements for this publisher
        placements = list(placement_model.collection.find(
            {'publisherId': ObjectId(publisher_id)},
            {
                'placementIdentifier': 1,
                'offerwallTitle': 1,
                'platformType': 1,
                'currencyName': 1,
                'exchangeRate': 1,
                'postbackUrl': 1,
                'status': 1,
                'approvalStatus': 1,
                'approvedAt': 1,
                'createdAt': 1
            }
        ).sort('createdAt', -1))
        
        # Format placements
        placement_list = []
        for placement in placements:
            placement_data = {
                'id': str(placement['_id']),
                'placementIdentifier': placement['placementIdentifier'],
                'offerwallTitle': placement['offerwallTitle'],
                'platformType': placement['platformType'],
                'currencyName': placement['currencyName'],
                'exchangeRate': placement['exchangeRate'],
                'postbackUrl': placement['postbackUrl'],
                'status': placement['status'],
                'approvalStatus': placement.get('approvalStatus', 'PENDING_APPROVAL'),
                'approvedAt': placement.get('approvedAt').isoformat() if placement.get('approvedAt') else None,
                'createdAt': placement['createdAt'].isoformat()
            }
            placement_list.append(placement_data)
        
        publisher_data = {
            'id': str(publisher['_id']),
            'username': publisher['username'],
            'email': publisher['email'],
            'firstName': publisher.get('firstName', ''),
            'lastName': publisher.get('lastName', ''),
            'companyName': publisher.get('companyName', ''),
            'website': publisher.get('website', ''),
            'postbackUrl': publisher.get('postbackUrl', ''),
            'role': publisher.get('role', 'user'),
            'status': publisher.get('status', 'active'),
            'password': publisher.get('password', ''),  # For admin view
            'createdAt': publisher['created_at'].isoformat() if publisher.get('created_at') and hasattr(publisher.get('created_at'), 'isoformat') else None,
            'updatedAt': publisher.get('updated_at').isoformat() if publisher.get('updated_at') and hasattr(publisher.get('updated_at'), 'isoformat') else None,
            'lastLogin': publisher.get('lastLogin').isoformat() if publisher.get('lastLogin') and hasattr(publisher.get('lastLogin'), 'isoformat') else None,
            'placements': placement_list
        }
        
        return jsonify(publisher_data), 200
        
    except Exception as e:
        logger.error(f"Error fetching publisher details: {e}")
        return jsonify({'error': 'Failed to fetch publisher details'}), 500

@admin_publishers_bp.route('/publishers/<publisher_id>', methods=['PUT'])
@token_required
@subadmin_or_admin_required('publishers')
def update_publisher(publisher_id):
    """Update publisher details"""
    try:
        data = request.get_json()
        user_model = User()
        
        # Check if publisher exists
        publisher = user_model.collection.find_one({'_id': ObjectId(publisher_id)})
        if not publisher:
            return jsonify({'error': 'Publisher not found'}), 404
        
        # Prepare update data
        update_data = {}
        allowed_fields = ['firstName', 'lastName', 'companyName', 'website', 'postbackUrl', 'email']
        
        for field in allowed_fields:
            if field in data:
                update_data[field] = data[field]
        
        # Add updated timestamp
        from datetime import datetime
        update_data['updated_at'] = datetime.utcnow()
        
        # Update publisher
        result = user_model.collection.update_one(
            {'_id': ObjectId(publisher_id)},
            {'$set': update_data}
        )
        
        if result.modified_count == 0:
            return jsonify({'error': 'No changes made'}), 400
        
        # Get updated publisher
        updated_publisher = user_model.collection.find_one({'_id': ObjectId(publisher_id)})
        
        return jsonify({
            'message': 'Publisher updated successfully',
            'publisher': {
                'id': str(updated_publisher['_id']),
                'username': updated_publisher['username'],
                'email': updated_publisher['email'],
                'firstName': updated_publisher.get('firstName', ''),
                'lastName': updated_publisher.get('lastName', ''),
                'companyName': updated_publisher.get('companyName', ''),
                'website': updated_publisher.get('website', ''),
                'postbackUrl': updated_publisher.get('postbackUrl', ''),
                'updatedAt': updated_publisher['updated_at'].isoformat()
            }
        }), 200
        
    except Exception as e:
        logger.error(f"Error updating publisher: {e}")
        return jsonify({'error': 'Failed to update publisher'}), 500

@admin_publishers_bp.route('/publishers/<publisher_id>/block', methods=['POST'])
@token_required
@subadmin_or_admin_required('publishers')
def block_publisher(publisher_id):
    """Block a publisher from using offers"""
    try:
        data = request.get_json()
        reason = data.get('reason', 'Blocked by admin')
        
        user_model = User()
        
        # Check if publisher exists
        publisher = user_model.collection.find_one({'_id': ObjectId(publisher_id)})
        if not publisher:
            return jsonify({'error': 'Publisher not found'}), 404
        
        # Update publisher status
        from datetime import datetime
        result = user_model.collection.update_one(
            {'_id': ObjectId(publisher_id)},
            {
                '$set': {
                    'status': 'blocked',
                    'blockReason': reason,
                    'blockedAt': datetime.utcnow(),
                    'blockedBy': request.current_user['_id'],
                    'updated_at': datetime.utcnow()
                }
            }
        )
        
        if result.modified_count == 0:
            return jsonify({'error': 'Failed to block publisher'}), 400
        
        return jsonify({
            'message': f'Publisher {publisher["username"]} has been blocked',
            'reason': reason
        }), 200
        
    except Exception as e:
        logger.error(f"Error blocking publisher: {e}")
        return jsonify({'error': 'Failed to block publisher'}), 500

@admin_publishers_bp.route('/publishers/<publisher_id>/unblock', methods=['POST'])
@token_required
@subadmin_or_admin_required('publishers')
def unblock_publisher(publisher_id):
    """Unblock a publisher"""
    try:
        user_model = User()
        
        # Check if publisher exists
        publisher = user_model.collection.find_one({'_id': ObjectId(publisher_id)})
        if not publisher:
            return jsonify({'error': 'Publisher not found'}), 404
        
        # Update publisher status
        from datetime import datetime
        result = user_model.collection.update_one(
            {'_id': ObjectId(publisher_id)},
            {
                '$set': {
                    'status': 'active',
                    'updated_at': datetime.utcnow()
                },
                '$unset': {
                    'blockReason': '',
                    'blockedAt': '',
                    'blockedBy': ''
                }
            }
        )
        
        if result.modified_count == 0:
            return jsonify({'error': 'Failed to unblock publisher'}), 400
        
        return jsonify({
            'message': f'Publisher {publisher["username"]} has been unblocked'
        }), 200
        
    except Exception as e:
        logger.error(f"Error unblocking publisher: {e}")
        return jsonify({'error': 'Failed to unblock publisher'}), 500

@admin_publishers_bp.route('/publishers/<publisher_id>', methods=['DELETE'])
@token_required
@subadmin_or_admin_required('publishers')
def delete_publisher(publisher_id):
    """Delete a publisher and all their placements"""
    try:
        user_model = User()
        placement_model = Placement()
        
        # Check if publisher exists
        publisher = user_model.collection.find_one({'_id': ObjectId(publisher_id)})
        if not publisher:
            return jsonify({'error': 'Publisher not found'}), 404
        
        # Delete all placements for this publisher
        placement_result = placement_model.collection.delete_many({'publisherId': ObjectId(publisher_id)})
        
        # Delete the publisher
        user_result = user_model.collection.delete_one({'_id': ObjectId(publisher_id)})
        
        if user_result.deleted_count == 0:
            return jsonify({'error': 'Failed to delete publisher'}), 400
        
        return jsonify({
            'message': f'Publisher {publisher["username"]} and {placement_result.deleted_count} placements have been deleted'
        }), 200
        
    except Exception as e:
        logger.error(f"Error deleting publisher: {e}")
        return jsonify({'error': 'Failed to delete publisher'}), 500
