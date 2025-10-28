"""
Simple Test Routes for Quick Testing
"""

from flask import Blueprint, jsonify, request
from database import db_instance
import uuid
import logging

logger = logging.getLogger(__name__)

simple_test_bp = Blueprint('simple_test', __name__)

@simple_test_bp.route('/quick-test', methods=['GET', 'POST'])
def quick_test():
    """
    Quick test endpoint that works without complex dependencies
    """
    try:
        if request.method == 'GET':
            return jsonify({
                'status': 'success',
                'message': 'Quick test endpoint is working!',
                'method': 'GET',
                'timestamp': str(uuid.uuid4())
            }), 200
        
        # POST method
        data = request.get_json() or {}
        
        return jsonify({
            'status': 'success',
            'message': 'Quick test POST is working!',
            'received_data': data,
            'test_id': str(uuid.uuid4())[:8],
            'steps': [
                {'step': 1, 'action': 'receive_request', 'success': True},
                {'step': 2, 'action': 'process_data', 'success': True},
                {'step': 3, 'action': 'generate_response', 'success': True}
            ]
        }), 200
        
    except Exception as e:
        logger.error(f"Quick test error: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@simple_test_bp.route('/test-db', methods=['GET'])
def test_database():
    """
    Test database connection
    """
    try:
        # Test offers collection
        offers_collection = db_instance.get_collection('offers')
        if offers_collection is None:
            return jsonify({
                'status': 'error',
                'message': 'Cannot connect to offers collection'
            }), 500
        
        # Count offers
        offer_count = offers_collection.count_documents({})
        active_offers = offers_collection.count_documents({'status': {'$in': ['Active', 'active']}})
        
        # Get sample offer
        sample_offer = offers_collection.find_one({'status': {'$in': ['Active', 'active']}})
        
        # Test users collection
        users_collection = db_instance.get_collection('users')
        user_count = 0
        sample_user = None
        
        if users_collection is not None:
            user_count = users_collection.count_documents({})
            sample_user = users_collection.find_one({})
        
        return jsonify({
            'status': 'success',
            'database': {
                'connected': True,
                'offers': {
                    'total': offer_count,
                    'active': active_offers,
                    'sample_offer_id': sample_offer.get('offer_id') if sample_offer else None
                },
                'users': {
                    'total': user_count,
                    'sample_user_id': str(sample_user.get('_id')) if sample_user else None,
                    'sample_username': sample_user.get('username') if sample_user else None
                }
            }
        }), 200
        
    except Exception as e:
        logger.error(f"Database test error: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@simple_test_bp.route('/simple-tracking-test', methods=['POST'])
def simple_tracking_test():
    """
    Simple tracking test that works with manual data
    """
    try:
        data = request.get_json() or {}
        
        offer_id = data.get('offer_id', 'ML-00001')
        affiliate_id = data.get('affiliate_id', 'test_user_123')
        payout = data.get('payout', 5.0)
        
        # Generate fake tracking data
        click_id = str(uuid.uuid4())
        conversion_id = str(uuid.uuid4())
        
        # Simulate the 3 steps
        results = {
            'offer_id': offer_id,
            'affiliate_id': affiliate_id,
            'payout': payout,
            'steps': [
                {
                    'step': 1,
                    'action': 'generate_tracking_link',
                    'success': True,
                    'data': {
                        'tracking_url': f'https://moustacheleads-backend.onrender.com/track/click/{click_id}?offer_id={offer_id}&aff_id={affiliate_id}',
                        'click_id': click_id
                    }
                },
                {
                    'step': 2,
                    'action': 'record_click',
                    'success': True,
                    'data': {
                        'click_id': click_id,
                        'redirect_url': f'https://example.com/offer/{offer_id}'
                    }
                },
                {
                    'step': 3,
                    'action': 'record_conversion',
                    'success': True,
                    'data': {
                        'conversion_id': conversion_id,
                        'payout': payout,
                        'postback_queued': True
                    }
                }
            ]
        }
        
        return jsonify({
            'success': True,
            'message': 'Simple tracking test completed successfully!',
            'results': results
        }), 200
        
    except Exception as e:
        logger.error(f"Simple tracking test error: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@simple_test_bp.route('/check-offer/<offer_id>', methods=['GET'])
def check_offer_postback_setup(offer_id):
    """
    Check if an offer is properly set up for postbacks
    """
    try:
        offers_collection = db_instance.get_collection('offers')
        partners_collection = db_instance.get_collection('partners')
        
        if offers_collection is None:
            return jsonify({'error': 'Cannot connect to offers collection'}), 500
        
        # Get the offer
        offer = offers_collection.find_one({'offer_id': offer_id})
        if not offer:
            return jsonify({
                'status': 'error',
                'message': f'Offer {offer_id} not found'
            }), 404
        
        # Check partner setup
        partner_id = offer.get('partner_id')
        partner_info = None
        
        if partner_id and partners_collection is not None:
            partner_info = partners_collection.find_one({'partner_id': partner_id})
        
        return jsonify({
            'status': 'success',
            'offer': {
                'offer_id': offer['offer_id'],
                'name': offer.get('name'),
                'status': offer.get('status'),
                'partner_id': partner_id,
                'has_partner_id': bool(partner_id)
            },
            'partner': {
                'exists': partner_info is not None,
                'partner_id': partner_info.get('partner_id') if partner_info else None,
                'name': partner_info.get('name') if partner_info else None,
                'postback_url': partner_info.get('postback_url') if partner_info else None,
                'has_postback_url': bool(partner_info.get('postback_url')) if partner_info else False
            },
            'postback_ready': bool(partner_id and partner_info and partner_info.get('postback_url'))
        }), 200
        
    except Exception as e:
        logger.error(f"Check offer error: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@simple_test_bp.route('/health', methods=['GET'])
def health():
    """Health check"""
    return jsonify({
        'status': 'healthy',
        'service': 'simple_test',
        'endpoints': [
            '/quick-test',
            '/test-db', 
            '/simple-tracking-test',
            '/check-offer/<offer_id>'
        ]
    }), 200
