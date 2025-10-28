"""
Test Helper Routes
Provides endpoints to help with testing the tracking system
"""

from flask import Blueprint, jsonify
from database import db_instance
import logging

logger = logging.getLogger(__name__)

test_helpers_bp = Blueprint('test_helpers', __name__)

@test_helpers_bp.route('/test/available-offers', methods=['GET'])
def get_available_offers():
    """
    Get list of available offers for testing
    Returns offers with their IDs, names, and partner info
    """
    try:
        offers_collection = db_instance.get_collection('offers')
        partners_collection = db_instance.get_collection('partners')
        
        if offers_collection is None:
            return jsonify({'error': 'Database connection not available'}), 500
        
        # Get active offers
        offers = list(offers_collection.find(
            {'status': {'$in': ['Active', 'active']}},
            {
                'offer_id': 1,
                'name': 1,
                'payout': 1,
                'network': 1,
                'partner_id': 1,
                'target_url': 1,
                'status': 1
            }
        ).limit(20))
        
        # Get all partners for reference
        partners = {}
        if partners_collection is not None:
            partner_docs = list(partners_collection.find({}, {
                'partner_id': 1,
                'name': 1,
                'postback_url': 1
            }))
            partners = {p['partner_id']: p for p in partner_docs}
        
        # Enrich offers with partner info
        enriched_offers = []
        for offer in offers:
            offer['_id'] = str(offer['_id'])
            partner_id = offer.get('partner_id')
            if partner_id and partner_id in partners:
                offer['partner_info'] = {
                    'name': partners[partner_id].get('name', 'Unknown'),
                    'has_postback_url': bool(partners[partner_id].get('postback_url'))
                }
            else:
                offer['partner_info'] = {
                    'name': 'No Partner',
                    'has_postback_url': False
                }
            enriched_offers.append(offer)
        
        return jsonify({
            'success': True,
            'offers': enriched_offers,
            'total_partners': len(partners),
            'message': f'Found {len(enriched_offers)} active offers'
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting available offers: {str(e)}")
        return jsonify({'error': f'Internal server error: {str(e)}'}), 500

@test_helpers_bp.route('/test/sample-users', methods=['GET'])
def get_sample_users():
    """
    Get list of sample users for testing affiliate tracking
    """
    try:
        users_collection = db_instance.get_collection('users')
        
        if users_collection is None:
            return jsonify({'error': 'Database connection not available'}), 500
        
        # Get sample users (publishers and regular users)
        users = list(users_collection.find(
            {},
            {
                '_id': 1,
                'username': 1,
                'email': 1,
                'role': 1
            }
        ).limit(10))
        
        # Convert ObjectId to string
        for user in users:
            user['user_id'] = str(user['_id'])
            user['_id'] = str(user['_id'])
        
        return jsonify({
            'success': True,
            'users': users,
            'message': f'Found {len(users)} sample users'
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting sample users: {str(e)}")
        return jsonify({'error': f'Internal server error: {str(e)}'}), 500

@test_helpers_bp.route('/test/create-test-partner', methods=['POST'])
def create_test_partner():
    """
    Create a test partner with postback URL for testing
    """
    try:
        partners_collection = db_instance.get_collection('partners')
        
        if partners_collection is None:
            return jsonify({'error': 'Database connection not available'}), 500
        
        # Check if test partner already exists
        existing_partner = partners_collection.find_one({'partner_id': 'test_partner_001'})
        
        if existing_partner:
            return jsonify({
                'success': True,
                'partner': {
                    'partner_id': existing_partner['partner_id'],
                    'name': existing_partner['name'],
                    'postback_url': existing_partner['postback_url']
                },
                'message': 'Test partner already exists'
            }), 200
        
        # Create test partner
        test_partner = {
            'partner_id': 'test_partner_001',
            'name': 'Test Partner for Tracking',
            'postback_url': 'https://httpbin.org/post?status=approved&payout={payout}&click_id={click_id}&offer_id={offer_id}&conversion_id={conversion_id}',
            'status': 'active',
            'contact_email': 'test@example.com',
            'created_at': 'auto',
            'updated_at': 'auto'
        }
        
        result = partners_collection.insert_one(test_partner)
        test_partner['_id'] = str(result.inserted_id)
        
        return jsonify({
            'success': True,
            'partner': {
                'partner_id': test_partner['partner_id'],
                'name': test_partner['name'],
                'postback_url': test_partner['postback_url']
            },
            'message': 'Test partner created successfully'
        }), 201
        
    except Exception as e:
        logger.error(f"Error creating test partner: {str(e)}")
        return jsonify({'error': f'Internal server error: {str(e)}'}), 500

@test_helpers_bp.route('/test/setup-test-offer', methods=['POST'])
def setup_test_offer():
    """
    Set up the first available offer with test partner for easy testing
    """
    try:
        offers_collection = db_instance.get_collection('offers')
        partners_collection = db_instance.get_collection('partners')
        
        if offers_collection is None or partners_collection is None:
            return jsonify({'error': 'Database connection not available'}), 500
        
        # Create test partner first
        test_partner_response = create_test_partner()
        if test_partner_response[1] not in [200, 201]:
            return test_partner_response
        
        # Get first active offer
        offer = offers_collection.find_one({'status': {'$in': ['Active', 'active']}})
        
        if not offer:
            return jsonify({'error': 'No active offers found. Please create an offer first.'}), 404
        
        # Update offer with test partner
        offers_collection.update_one(
            {'_id': offer['_id']},
            {'$set': {'partner_id': 'test_partner_001'}}
        )
        
        # Get updated offer
        updated_offer = offers_collection.find_one({'_id': offer['_id']})
        
        return jsonify({
            'success': True,
            'offer': {
                'offer_id': updated_offer['offer_id'],
                'name': updated_offer['name'],
                'payout': updated_offer.get('payout', 0),
                'partner_id': updated_offer['partner_id']
            },
            'partner': {
                'partner_id': 'test_partner_001',
                'name': 'Test Partner for Tracking',
                'postback_url': 'https://httpbin.org/post?status=approved&payout={payout}&click_id={click_id}&offer_id={offer_id}&conversion_id={conversion_id}'
            },
            'message': 'Test offer setup completed successfully'
        }), 200
        
    except Exception as e:
        logger.error(f"Error setting up test offer: {str(e)}")
        return jsonify({'error': f'Internal server error: {str(e)}'}), 500

@test_helpers_bp.route('/health')
def health_check():
    """Health check for test helpers"""
    return jsonify({
        'status': 'healthy',
        'service': 'test_helpers',
        'endpoints': [
            '/test/available-offers',
            '/test/sample-users', 
            '/test/create-test-partner',
            '/test/setup-test-offer'
        ]
    }), 200
