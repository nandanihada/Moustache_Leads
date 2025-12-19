from flask import Blueprint, request, jsonify
from utils.auth import token_required, admin_required, subadmin_or_admin_required
from models.user import User
from models.placement import Placement
from bson import ObjectId
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

admin_publishers_simple_bp = Blueprint('admin_publishers_simple', __name__)

@admin_publishers_simple_bp.route('/publishers', methods=['GET'])
@token_required
@subadmin_or_admin_required('publishers')
def get_all_publishers():
    """Get all publishers with their details and statistics"""
    try:
        page = int(request.args.get('page', 1))
        size = int(request.args.get('size', 20))
        search = request.args.get('search', '')
        status_filter = request.args.get('status_filter', 'all')
        
        user_model = User()
        placement_model = Placement()
        
        # Get all users who have approved placements (publishers)
        # First, get unique publisher IDs from approved placements
        approved_publisher_ids = placement_model.collection.distinct('publisherId', {'approvalStatus': 'APPROVED'})
        
        # Build query filter for users who have approved placements
        query_filter = {'_id': {'$in': approved_publisher_ids}}
        
        if search:
            query_filter['$and'] = [
                {'_id': {'$in': approved_publisher_ids}},
                {'$or': [
                    {'username': {'$regex': search, '$options': 'i'}},
                    {'email': {'$regex': search, '$options': 'i'}},
                    {'firstName': {'$regex': search, '$options': 'i'}},
                    {'lastName': {'$regex': search, '$options': 'i'}},
                    {'companyName': {'$regex': search, '$options': 'i'}}
                ]}
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
                'password': 1,
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
        
        # Build publisher list with simplified stats
        publisher_list = []
        for publisher in publishers:
            publisher_id = str(publisher['_id'])
            
            # Simple placement count (no complex aggregation)
            total_placements = placement_model.collection.count_documents({'publisherId': ObjectId(publisher_id)})
            
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
                'password': str(publisher.get('password', '')) if publisher.get('password') else 'No password',
                'createdAt': publisher['created_at'].strftime('%Y-%m-%d') if publisher.get('created_at') else None,
                'updatedAt': publisher.get('updated_at').strftime('%Y-%m-%d') if publisher.get('updated_at') else None,
                'lastLogin': publisher.get('lastLogin').strftime('%Y-%m-%d') if publisher.get('lastLogin') else None,
                'placementStats': {
                    'total': total_placements,
                    'approved': 0,  # Simplified for now
                    'pending': 0,
                    'rejected': 0
                }
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
        import traceback
        traceback.print_exc()
        return jsonify({'error': f'Failed to fetch publishers: {str(e)}'}), 500

@admin_publishers_simple_bp.route('/publishers/<publisher_id>', methods=['GET'])
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
        
        # Get placements for this publisher
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
                'created_at': 1
            }
        ).sort('created_at', -1))
        
        placement_list = []
        for placement in placements:
            placement_data = {
                'id': str(placement['_id']),
                'placementIdentifier': placement.get('placementIdentifier', ''),
                'offerwallTitle': placement.get('offerwallTitle', ''),
                'platformType': placement.get('platformType', ''),
                'currencyName': placement.get('currencyName', ''),
                'exchangeRate': placement.get('exchangeRate', 1),
                'postbackUrl': placement.get('postbackUrl', ''),
                'status': placement.get('status', 'active'),
                'approvalStatus': placement.get('approvalStatus', 'PENDING_APPROVAL'),
                'approvedAt': placement.get('approvedAt').strftime('%Y-%m-%d') if placement.get('approvedAt') else None,
                'createdAt': placement['created_at'].strftime('%Y-%m-%d') if placement.get('created_at') else None
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
            'password': str(publisher.get('password', '')) if publisher.get('password') else '',
            'createdAt': publisher['created_at'].strftime('%Y-%m-%d') if publisher.get('created_at') else None,
            'updatedAt': publisher.get('updated_at').strftime('%Y-%m-%d') if publisher.get('updated_at') else None,
            'lastLogin': publisher.get('lastLogin').strftime('%Y-%m-%d') if publisher.get('lastLogin') else None,
            'placements': placement_list
        }
        
        return jsonify(publisher_data), 200
        
    except Exception as e:
        logger.error(f"Error fetching publisher details: {e}")
        return jsonify({'error': f'Failed to fetch publisher details: {str(e)}'}), 500

@admin_publishers_simple_bp.route('/publishers/<publisher_id>', methods=['PUT'])
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
        
        # Update fields
        update_data = {}
        allowed_fields = ['firstName', 'lastName', 'companyName', 'website', 'postbackUrl', 'email']
        
        for field in allowed_fields:
            if field in data:
                update_data[field] = data[field]
        
        if update_data:
            update_data['updated_at'] = datetime.utcnow()
            user_model.collection.update_one(
                {'_id': ObjectId(publisher_id)},
                {'$set': update_data}
            )
        
        return jsonify({'message': 'Publisher updated successfully'}), 200
        
    except Exception as e:
        logger.error(f"Error updating publisher: {e}")
        return jsonify({'error': f'Failed to update publisher: {str(e)}'}), 500

@admin_publishers_simple_bp.route('/publishers/<publisher_id>/block', methods=['POST'])
@token_required
@subadmin_or_admin_required('publishers')
def block_publisher(publisher_id):
    """Block a publisher from using offers"""
    try:
        data = request.get_json() or {}
        reason = data.get('reason', 'Blocked by admin')
        
        user_model = User()
        
        # Check if publisher exists
        publisher = user_model.collection.find_one({'_id': ObjectId(publisher_id)})
        if not publisher:
            return jsonify({'error': 'Publisher not found'}), 404
        
        # Block the publisher
        user_model.collection.update_one(
            {'_id': ObjectId(publisher_id)},
            {'$set': {
                'status': 'blocked',
                'blockReason': reason,
                'blockedAt': datetime.utcnow(),
                'updated_at': datetime.utcnow()
            }}
        )
        
        return jsonify({
            'message': f'Publisher {publisher["username"]} has been blocked',
            'reason': reason
        }), 200
        
    except Exception as e:
        logger.error(f"Error blocking publisher: {e}")
        return jsonify({'error': f'Failed to block publisher: {str(e)}'}), 500

@admin_publishers_simple_bp.route('/publishers/<publisher_id>/unblock', methods=['POST'])
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
        
        # Unblock the publisher
        user_model.collection.update_one(
            {'_id': ObjectId(publisher_id)},
            {'$set': {
                'status': 'active',
                'updated_at': datetime.utcnow()
            },
            '$unset': {
                'blockReason': '',
                'blockedAt': ''
            }}
        )
        
        return jsonify({
            'message': f'Publisher {publisher["username"]} has been unblocked'
        }), 200
        
    except Exception as e:
        logger.error(f"Error unblocking publisher: {e}")
        return jsonify({'error': f'Failed to unblock publisher: {str(e)}'}), 500

@admin_publishers_simple_bp.route('/publishers/<publisher_id>', methods=['DELETE'])
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
        placement_model.collection.delete_many({'publisherId': ObjectId(publisher_id)})
        
        # Delete the publisher
        user_model.collection.delete_one({'_id': ObjectId(publisher_id)})
        
        return jsonify({
            'message': f'Publisher {publisher["username"]} and all their placements have been deleted'
        }), 200
        
    except Exception as e:
        logger.error(f"Error deleting publisher: {e}")
        return jsonify({'error': f'Failed to delete publisher: {str(e)}'}), 500
