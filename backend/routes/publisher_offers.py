#!/usr/bin/env python3
"""
Publisher Offers API - Public offers endpoint for publishers
"""

from flask import Blueprint, request, jsonify
from database import db_instance
from utils.auth import token_required
from services.access_control_service import AccessControlService
from utils.json_serializer import safe_json_response
import logging

publisher_offers_bp = Blueprint('publisher_offers', __name__)
logger = logging.getLogger(__name__)
access_service = AccessControlService()

@publisher_offers_bp.route('/offers/available', methods=['GET'])
@token_required
def get_available_offers():
    """
    Get all active offers available to publishers
    No admin permission required - any authenticated user can view
    """
    try:
        user = request.current_user
        logger.info(f"📦 Publisher {user.get('username')} requesting available offers")
        
        # Get query parameters
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 100))
        status = request.args.get('status', 'active')
        search = request.args.get('search', '')
        
        # Build query for active offers
        offers_collection = db_instance.get_collection('offers')
        
        if offers_collection is None:
            return jsonify({'error': 'Database connection failed'}), 500
        
        query = {
            'status': status,
            'is_active': True,
            '$or': [
                {'approval_status': {'$in': ['active', 'pending']}},  # New offers with approval workflow
                {'approval_status': {'$exists': False}}  # Legacy offers without approval workflow
            ]
        }
        
        # Add search if provided
        if search:
            # Combine approval status filter with search filter using $and
            search_conditions = [
                {'name': {'$regex': search, '$options': 'i'}},
                {'offer_id': {'$regex': search, '$options': 'i'}},
                {'category': {'$regex': search, '$options': 'i'}}
            ]
            
            query = {
                'status': status,
                'is_active': True,
                '$and': [
                    {
                        '$or': [
                            {'approval_status': {'$in': ['active', 'pending']}},
                            {'approval_status': {'$exists': False}}
                        ]
                    },
                    {'$or': search_conditions}
                ]
            }
        
        # Get total count
        total = offers_collection.count_documents(query)
        
        # Get paginated results
        skip = (page - 1) * per_page
        offers = list(offers_collection.find(query).skip(skip).limit(per_page).sort('created_at', -1))
        
        # Process offers for publisher view
        user_id = user.get('_id')
        processed_offers = []
        
        for offer in offers:
            if '_id' in offer:
                offer['_id'] = str(offer['_id'])
            
            # Check user's access to this offer
            has_access, access_reason = access_service.check_offer_access(offer['offer_id'], user_id)
            
            # Get approval settings
            approval_settings = offer.get('approval_settings', {})
            approval_type = approval_settings.get('type', 'auto_approve')
            
            # Check if user has pending request
            requests_collection = db_instance.get_collection('affiliate_requests')
            existing_request = requests_collection.find_one({
                'offer_id': offer['offer_id'],
                'user_id': user_id
            })
            
            # Prepare offer data for publisher
            offer_data = {
                'offer_id': offer['offer_id'],
                'name': offer['name'],
                'description': offer.get('description', ''),
                'category': offer.get('category', 'general'),
                'payout': offer['payout'],
                'currency': offer.get('currency', 'USD'),
                'network': offer['network'],
                'countries': offer.get('countries', []),
                'image_url': offer.get('image_url', ''),
                'thumbnail_url': offer.get('thumbnail_url', ''),
                'preview_url': offer.get('preview_url', ''),
                'created_at': offer.get('created_at'),
                'approval_status': offer.get('approval_status', 'active'),
                'approval_type': approval_type,
                'has_access': has_access,
                'access_reason': access_reason,
                'requires_approval': approval_type != 'auto_approve' or approval_settings.get('require_approval', False),
                # Add promo code info
                'promo_code': offer.get('promo_code'),
                'promo_code_id': offer.get('promo_code_id'),
                'bonus_amount': offer.get('bonus_amount'),
                'bonus_type': offer.get('bonus_type')
            }
            
            # Add request status if exists
            if existing_request:
                offer_data['request_status'] = existing_request.get('status')
                offer_data['requested_at'] = existing_request.get('requested_at')
                if existing_request.get('status') == 'approved':
                    offer_data['approved_at'] = existing_request.get('approved_at')
            
            # Only show tracking URL if user has access
            if has_access:
                offer_data['target_url'] = offer.get('target_url')
                offer_data['masked_url'] = offer.get('masked_url')
            else:
                # Show blurred/preview version
                offer_data['is_preview'] = True
                offer_data['estimated_approval_time'] = access_service._get_estimated_approval_time(
                    approval_type, approval_settings
                )
            
            processed_offers.append(offer_data)
        
        logger.info(f"✅ Returning {len(processed_offers)} offers (total: {total})")
        
        return safe_json_response({
            'success': True,
            'offers': processed_offers,
            'pagination': {
                'page': page,
                'per_page': per_page,
                'total': total,
                'pages': (total + per_page - 1) // per_page
            }
        })
        
    except Exception as e:
        logger.error(f"❌ Error fetching offers: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to fetch offers: {str(e)}'}), 500


@publisher_offers_bp.route('/offers/<offer_id>', methods=['GET'])
@token_required
def get_offer_details(offer_id):
    """
    Get details of a specific offer
    No admin permission required
    """
    try:
        user = request.current_user
        logger.info(f"📦 Publisher {user.get('username')} requesting offer {offer_id}")
        
        offers_collection = db_instance.get_collection('offers')
        
        if offers_collection is None:
            return jsonify({'error': 'Database connection failed'}), 500
        
        # Find the offer
        offer = offers_collection.find_one({'offer_id': offer_id})
        
        if not offer:
            return jsonify({'error': 'Offer not found'}), 404
        
        # Convert ObjectId to string
        if '_id' in offer:
            offer['_id'] = str(offer['_id'])
        
        logger.info(f"✅ Returning offer details: {offer.get('name')}")
        
        return jsonify({
            'success': True,
            'offer': offer
        }), 200
        
    except Exception as e:
        logger.error(f"❌ Error fetching offer details: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to fetch offer: {str(e)}'}), 500


@publisher_offers_bp.route('/offers/<offer_id>/request-access', methods=['POST'])
@token_required
def request_offer_access(offer_id):
    """
    Request access to an offer
    """
    try:
        user = request.current_user
        data = request.get_json() or {}
        message = data.get('message', '')
        
        logger.info(f"📝 Publisher {user.get('username')} requesting access to offer {offer_id}")
        
        # Request access through access control service
        result = access_service.request_offer_access(offer_id, user.get('_id'), message)
        
        if 'error' in result:
            return jsonify(result), 400
        
        logger.info(f"✅ Access request submitted for offer {offer_id}")
        
        return safe_json_response(result)
        
    except Exception as e:
        logger.error(f"❌ Error requesting offer access: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to request access: {str(e)}'}), 500

@publisher_offers_bp.route('/offers/<offer_id>/access-status', methods=['GET'])
@token_required
def get_offer_access_status(offer_id):
    """
    Get access status for a specific offer
    """
    try:
        user = request.current_user
        user_id = user.get('_id')
        
        # Check current access status
        has_access, access_reason = access_service.check_offer_access(offer_id, user_id)
        
        # Get request details if exists
        requests_collection = db_instance.get_collection('affiliate_requests')
        existing_request = requests_collection.find_one({
            'offer_id': offer_id,
            'user_id': user_id
        })
        
        result = {
            'offer_id': offer_id,
            'has_access': has_access,
            'access_reason': access_reason,
            'request_exists': existing_request is not None
        }
        
        if existing_request:
            result['request_status'] = existing_request.get('status')
            result['requested_at'] = existing_request.get('requested_at')
            result['request_id'] = existing_request.get('request_id')
            
            if existing_request.get('status') == 'approved':
                result['approved_at'] = existing_request.get('approved_at')
                result['approved_by'] = existing_request.get('approved_by')
            elif existing_request.get('status') == 'rejected':
                result['rejected_at'] = existing_request.get('rejected_at')
                result['rejection_reason'] = existing_request.get('rejection_reason')
        
        return safe_json_response(result)
        
    except Exception as e:
        logger.error(f"❌ Error getting access status: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to get access status: {str(e)}'}), 500

@publisher_offers_bp.route('/my-requests', methods=['GET'])
@token_required
def get_my_access_requests():
    """
    Get all access requests made by the current user
    """
    try:
        user = request.current_user
        user_id = user.get('_id')
        
        # Get query parameters
        status = request.args.get('status', 'all')
        page = int(request.args.get('page', 1))
        per_page = min(int(request.args.get('per_page', 20)), 100)
        
        # Build query
        query = {'user_id': user_id}
        if status != 'all':
            query['status'] = status
        
        # Get requests
        requests_collection = db_instance.get_collection('affiliate_requests')
        total = requests_collection.count_documents(query)
        
        skip = (page - 1) * per_page
        requests = list(requests_collection.find(query)
                       .sort('requested_at', -1)
                       .skip(skip)
                       .limit(per_page))
        
        # Enrich with offer details
        offers_collection = db_instance.get_collection('offers')
        for req in requests:
            req['_id'] = str(req['_id'])
            
            # Get offer details
            offer = offers_collection.find_one({'offer_id': req['offer_id']})
            if offer:
                req['offer_details'] = {
                    'name': offer.get('name'),
                    'payout': offer.get('payout'),
                    'network': offer.get('network'),
                    'image_url': offer.get('image_url')
                }
        
        return safe_json_response({
            'requests': requests,
            'pagination': {
                'page': page,
                'per_page': per_page,
                'total': total,
                'pages': (total + per_page - 1) // per_page
            }
        })
        
    except Exception as e:
        logger.error(f"❌ Error getting user requests: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to get requests: {str(e)}'}), 500

@publisher_offers_bp.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'service': 'publisher_offers',
        'endpoints': [
            'GET /api/publisher/offers/available',
            'GET /api/publisher/offers/<offer_id>',
            'POST /api/publisher/offers/<offer_id>/request-access',
            'GET /api/publisher/offers/<offer_id>/access-status',
            'GET /api/publisher/my-requests'
        ]
    }), 200
