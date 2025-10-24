from flask import Blueprint, request, jsonify
from database import db_instance
from utils.auth import token_required
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
@admin_required
def create_partner():
    """Create a new partner with postback configuration"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        # Validate required fields
        required_fields = ['partner_name', 'postback_url', 'method']
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'Missing required field: {field}'}), 400
        
        # Validate method
        if data['method'] not in ['GET', 'POST']:
            return jsonify({'error': 'Method must be GET or POST'}), 400
        
        # Create partner document
        partner_doc = {
            'partner_id': str(uuid.uuid4()),
            'partner_name': data['partner_name'].strip(),
            'postback_url': data['postback_url'].strip(),
            'method': data['method'],
            'status': data.get('status', 'active'),
            'description': data.get('description', '').strip(),
            'created_by': str(request.current_user['_id']),
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow()
        }
        
        # Insert into database
        partners_collection = db_instance.get_collection('partners')
        result = partners_collection.insert_one(partner_doc)
        partner_doc['_id'] = str(result.inserted_id)
        
        logger.info(f"✅ Partner created: {partner_doc['partner_name']} ({partner_doc['partner_id']})")
        
        return jsonify({
            'message': 'Partner created successfully',
            'partner': partner_doc
        }), 201
        
    except Exception as e:
        logger.error(f"Error creating partner: {str(e)}")
        return jsonify({'error': str(e)}), 500

@partners_bp.route('/partners', methods=['GET'])
@token_required
@admin_required
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
@admin_required
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
@admin_required
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
@admin_required
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
@admin_required
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
