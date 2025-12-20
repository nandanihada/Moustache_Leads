from flask import Blueprint, request, jsonify
from database import db_instance
from utils.auth import token_required, subadmin_or_admin_required
import logging
import uuid
from datetime import datetime
import requests

partners_bp = Blueprint('partners', __name__)
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

@partners_bp.route('/partners', methods=['POST'])
@token_required
@subadmin_or_admin_required('partners')
def create_partner():
    """Create a new upward partner and generate a unique postback URL for them"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        # Validate required fields
        if 'partner_name' not in data:
            return jsonify({'error': 'Missing required field: partner_name'}), 400
        
        # Generate unique postback key for this partner
        import secrets
        unique_key = secrets.token_urlsafe(24)
        postback_receiver_url = f"https://moustacheleads-backend.onrender.com/postback/{unique_key}"
        
        # Create partner document
        partner_doc = {
            'partner_id': str(uuid.uuid4()),
            'partner_name': data['partner_name'].strip(),
            'postback_url': data.get('postback_url', 'https://placeholder.com'),  # Not used for upward partners
            'method': data.get('method', 'GET'),
            'status': data.get('status', 'active'),
            'description': data.get('description', '').strip(),
            'unique_postback_key': unique_key,
            'postback_receiver_url': postback_receiver_url,
            'created_by': str(request.current_user['_id']),
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow()
        }
        
        # Insert into database
        partners_collection = db_instance.get_collection('partners')
        result = partners_collection.insert_one(partner_doc)
        partner_doc['_id'] = str(result.inserted_id)
        
        logger.info(f"✅ Upward partner created: {partner_doc['partner_name']} - URL: {postback_receiver_url}")
        
        return jsonify({
            'message': 'Partner created successfully with unique postback URL',
            'partner': partner_doc
        }), 201
        
    except Exception as e:
        logger.error(f"Error creating partner: {str(e)}")
        return jsonify({'error': str(e)}), 500

@partners_bp.route('/partners', methods=['GET'])
@token_required
@subadmin_or_admin_required('partners')
def get_partners():
    """Get all partners"""
    try:
        partners_collection = db_instance.get_collection('partners')
        
        # Get query parameters for filtering
        status = request.args.get('status')
        
        # Build query
        query = {}
        if status:
            query['status'] = status
        
        # Fetch partners
        partners = list(partners_collection.find(query).sort('created_at', -1))
        
        # Convert ObjectId to string
        for partner in partners:
            partner['_id'] = str(partner['_id'])
        
        return jsonify({
            'partners': partners,
            'total': len(partners)
        }), 200
        
    except Exception as e:
        logger.error(f"Error fetching partners: {str(e)}")
        return jsonify({'error': str(e)}), 500

@partners_bp.route('/partners/<partner_id>', methods=['GET'])
@token_required
@subadmin_or_admin_required('partners')
def get_partner(partner_id):
    """Get a single partner by ID"""
    try:
        partners_collection = db_instance.get_collection('partners')
        partner = partners_collection.find_one({'partner_id': partner_id})
        
        if not partner:
            return jsonify({'error': 'Partner not found'}), 404
        
        partner['_id'] = str(partner['_id'])
        
        return jsonify({'partner': partner}), 200
        
    except Exception as e:
        logger.error(f"Error fetching partner: {str(e)}")
        return jsonify({'error': str(e)}), 500

@partners_bp.route('/partners/<partner_id>', methods=['PUT'])
@token_required
@subadmin_or_admin_required('partners')
def update_partner(partner_id):
    """Update a partner"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        partners_collection = db_instance.get_collection('partners')
        
        # Check if partner exists
        partner = partners_collection.find_one({'partner_id': partner_id})
        if not partner:
            return jsonify({'error': 'Partner not found'}), 404
        
        # Validate method if provided
        if 'method' in data and data['method'] not in ['GET', 'POST']:
            return jsonify({'error': 'Method must be GET or POST'}), 400
        
        # Build update document
        update_doc = {
            'updated_at': datetime.utcnow()
        }
        
        # Update allowed fields
        allowed_fields = ['partner_name', 'postback_url', 'method', 'status', 'description']
        for field in allowed_fields:
            if field in data:
                update_doc[field] = data[field].strip() if isinstance(data[field], str) else data[field]
        
        # Update in database
        partners_collection.update_one(
            {'partner_id': partner_id},
            {'$set': update_doc}
        )
        
        # Fetch updated partner
        updated_partner = partners_collection.find_one({'partner_id': partner_id})
        updated_partner['_id'] = str(updated_partner['_id'])
        
        logger.info(f"✅ Partner updated: {partner_id}")
        
        return jsonify({
            'message': 'Partner updated successfully',
            'partner': updated_partner
        }), 200
        
    except Exception as e:
        logger.error(f"Error updating partner: {str(e)}")
        return jsonify({'error': str(e)}), 500

@partners_bp.route('/partners/<partner_id>', methods=['DELETE'])
@token_required
@subadmin_or_admin_required('partners')
def delete_partner(partner_id):
    """Delete a partner"""
    try:
        partners_collection = db_instance.get_collection('partners')
        
        # Check if partner exists
        partner = partners_collection.find_one({'partner_id': partner_id})
        if not partner:
            return jsonify({'error': 'Partner not found'}), 404
        
        # Check if partner is linked to any offers
        offers_collection = db_instance.get_collection('offers')
        linked_offers = offers_collection.count_documents({'partner_id': partner_id})
        
        if linked_offers > 0:
            return jsonify({
                'error': f'Cannot delete partner. {linked_offers} offer(s) are linked to this partner.'
            }), 400
        
        # Delete partner
        partners_collection.delete_one({'partner_id': partner_id})
        
        logger.info(f"✅ Partner deleted: {partner_id}")
        
        return jsonify({'message': 'Partner deleted successfully'}), 200
        
    except Exception as e:
        logger.error(f"Error deleting partner: {str(e)}")
        return jsonify({'error': str(e)}), 500

@partners_bp.route('/partners/<partner_id>/test', methods=['POST'])
@token_required
@subadmin_or_admin_required('partners')
def test_partner_postback(partner_id):
    """Test partner postback URL with sample data"""
    try:
        partners_collection = db_instance.get_collection('partners')
        
        # Get partner
        partner = partners_collection.find_one({'partner_id': partner_id})
        if not partner:
            return jsonify({'error': 'Partner not found'}), 404
        
        # Sample test data
        test_data = {
            'click_id': 'test_click_123',
            'payout': '10.50',
            'status': 'approved',
            'offer_id': 'test_offer_456',
            'conversion_id': 'test_conv_789',
            'transaction_id': 'test_txn_abc'
        }
        
        # Replace macros in postback URL
        test_url = partner['postback_url']
        for key, value in test_data.items():
            test_url = test_url.replace(f'{{{key}}}', str(value))
        
        # Send test request
        try:
            if partner['method'] == 'GET':
                response = requests.get(
                    test_url,
                    timeout=10,
                    headers={'User-Agent': 'PepeLeads-Postback-Test/1.0'}
                )
            else:  # POST
                response = requests.post(
                    test_url,
                    json=test_data,
                    timeout=10,
                    headers={'User-Agent': 'PepeLeads-Postback-Test/1.0'}
                )
            
            return jsonify({
                'success': True,
                'test_url': test_url,
                'method': partner['method'],
                'status_code': response.status_code,
                'response_body': response.text[:500],  # Limit response size
                'test_data': test_data
            }), 200
            
        except requests.RequestException as e:
            return jsonify({
                'success': False,
                'test_url': test_url,
                'method': partner['method'],
                'error': str(e),
                'test_data': test_data
            }), 200
        
    except Exception as e:
        logger.error(f"Error testing partner postback: {str(e)}")
        return jsonify({'error': str(e)}), 500

@partners_bp.route('/partners/users', methods=['GET'])
@token_required
@subadmin_or_admin_required('partners')
def get_registered_users():
    """Get all registered users/publishers for partner management"""
    try:
        users_collection = db_instance.get_collection('users')
        
        # Get query parameters for filtering
        status = request.args.get('status')
        role = request.args.get('role')
        
        # Build query - exclude admin users
        query = {'role': {'$ne': 'admin'}}
        
        if status:
            query['status'] = status
        if role:
            query['role'] = role
        
        # Fetch users
        users = list(users_collection.find(query).sort('created_at', -1))
        
        # Convert ObjectId to string and format data
        for user in users:
            user['_id'] = str(user['_id'])
            # Remove sensitive data
            user.pop('password', None)
            user.pop('password_hash', None)
            
            # Add postback configuration if exists
            if 'postback_url' not in user:
                user['postback_url'] = ''
            if 'parameter_mapping' not in user:
                user['parameter_mapping'] = {}
            if 'is_blocked' not in user:
                user['is_blocked'] = False
        
        return jsonify({
            'users': users,
            'total': len(users)
        }), 200
        
    except Exception as e:
        logger.error(f"Error fetching registered users: {str(e)}")
        return jsonify({'error': str(e)}), 500

@partners_bp.route('/partners/users/<user_id>/postback', methods=['PUT'])
@token_required
@subadmin_or_admin_required('partners')
def update_user_postback(user_id):
    """Update postback URL for a user/publisher"""
    try:
        data = request.get_json()
        
        if not data or 'postback_url' not in data:
            return jsonify({'error': 'postback_url is required'}), 400
        
        users_collection = db_instance.get_collection('users')
        
        # Check if user exists
        user = users_collection.find_one({'_id': db_instance.to_object_id(user_id)})
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        # Update postback URL
        users_collection.update_one(
            {'_id': db_instance.to_object_id(user_id)},
            {'$set': {
                'postback_url': data['postback_url'].strip(),
                'updated_at': datetime.utcnow()
            }}
        )
        
        logger.info(f"✅ Postback URL updated for user: {user_id}")
        
        return jsonify({'message': 'Postback URL updated successfully'}), 200
        
    except Exception as e:
        logger.error(f"Error updating user postback: {str(e)}")
        return jsonify({'error': str(e)}), 500

@partners_bp.route('/partners/users/<user_id>/parameter-mapping', methods=['PUT'])
@token_required
@subadmin_or_admin_required('partners')
def update_user_parameter_mapping(user_id):
    """Update parameter mapping for a user/publisher"""
    try:
        data = request.get_json()
        
        if not data or 'parameter_mapping' not in data:
            return jsonify({'error': 'parameter_mapping is required'}), 400
        
        users_collection = db_instance.get_collection('users')
        
        # Check if user exists
        user = users_collection.find_one({'_id': db_instance.to_object_id(user_id)})
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        # Update parameter mapping
        users_collection.update_one(
            {'_id': db_instance.to_object_id(user_id)},
            {'$set': {
                'parameter_mapping': data['parameter_mapping'],
                'updated_at': datetime.utcnow()
            }}
        )
        
        logger.info(f"✅ Parameter mapping updated for user: {user_id}")
        
        return jsonify({'message': 'Parameter mapping updated successfully'}), 200
        
    except Exception as e:
        logger.error(f"Error updating parameter mapping: {str(e)}")
        return jsonify({'error': str(e)}), 500

@partners_bp.route('/partners/users/<user_id>/block', methods=['POST'])
@token_required
@subadmin_or_admin_required('partners')
def block_user(user_id):
    """Block a user/publisher"""
    try:
        data = request.get_json() or {}
        reason = data.get('reason', 'No reason provided')
        
        users_collection = db_instance.get_collection('users')
        
        # Check if user exists
        user = users_collection.find_one({'_id': db_instance.to_object_id(user_id)})
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        # Block user
        users_collection.update_one(
            {'_id': db_instance.to_object_id(user_id)},
            {'$set': {
                'is_blocked': True,
                'blocked_reason': reason,
                'blocked_at': datetime.utcnow(),
                'updated_at': datetime.utcnow()
            }}
        )
        
        logger.info(f"✅ User blocked: {user_id} - Reason: {reason}")
        
        return jsonify({'message': 'User blocked successfully'}), 200
        
    except Exception as e:
        logger.error(f"Error blocking user: {str(e)}")
        return jsonify({'error': str(e)}), 500

@partners_bp.route('/partners/users/<user_id>/unblock', methods=['POST'])
@token_required
@subadmin_or_admin_required('partners')
def unblock_user(user_id):
    """Unblock a user/publisher"""
    try:
        users_collection = db_instance.get_collection('users')
        
        # Check if user exists
        user = users_collection.find_one({'_id': db_instance.to_object_id(user_id)})
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        # Unblock user
        users_collection.update_one(
            {'_id': db_instance.to_object_id(user_id)},
            {'$set': {
                'is_blocked': False,
                'updated_at': datetime.utcnow()
            },
            '$unset': {
                'blocked_reason': '',
                'blocked_at': ''
            }}
        )
        
        logger.info(f"✅ User unblocked: {user_id}")
        
        return jsonify({'message': 'User unblocked successfully'}), 200
        
    except Exception as e:
        logger.error(f"Error unblocking user: {str(e)}")
        return jsonify({'error': str(e)}), 500
