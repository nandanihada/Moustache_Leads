#!/usr/bin/env python3
"""
Publisher Offers API - Public offers endpoint for publishers
"""

from flask import Blueprint, request, jsonify
from database import db_instance
from utils.auth import token_required
from services.access_control_service import AccessControlService
from services.offer_visibility_service import offer_visibility_service
from utils.json_serializer import safe_json_response
import logging

publisher_offers_bp = Blueprint('publisher_offers', __name__)
logger = logging.getLogger(__name__)
access_service = AccessControlService()

@publisher_offers_bp.route('/offers/available', methods=['GET', 'OPTIONS'])
@token_required
def get_available_offers():
    """
    Get all active offers available to publishers
    No admin permission required - any authenticated user can view
    
    OPTIMIZED: Batch fetches all data upfront to avoid N+1 query problem
    """
    try:
        # DEBUG: Log request details
        logger.info(f"🔍 GET /offers/available - Method: {request.method}")
        logger.info(f"🔍 Origin: {request.headers.get('Origin')}")
        
        user = request.current_user
        user_id = user.get('_id')
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
                {'approval_status': {'$in': ['active', 'pending']}},
                {'approval_status': {'$exists': False}}
            ],
            # Only show offers marked for offerwall (or not explicitly hidden)
            '$and': [
                {'$or': [
                    {'show_in_offerwall': True},
                    {'show_in_offerwall': {'$exists': False}}
                ]}
            ]
        }
        
        # Add search if provided
        if search:
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
                    {'$or': search_conditions},
                    # Only show offers marked for offerwall (or not explicitly hidden)
                    {'$or': [
                        {'show_in_offerwall': True},
                        {'show_in_offerwall': {'$exists': False}}
                    ]}
                ]
            }
        
        # Get total count
        total = offers_collection.count_documents(query)
        
        # Get paginated results
        skip = (page - 1) * per_page
        offers = list(offers_collection.find(query).skip(skip).limit(per_page).sort('created_at', -1))
        
        if not offers:
            return safe_json_response({
                'success': True,
                'offers': [],
                'pagination': {'page': page, 'per_page': per_page, 'total': 0, 'pages': 0}
            })
        
        # ============================================
        # OPTIMIZATION: Batch fetch all related data
        # ============================================
        
        # Get all offer IDs for batch queries
        offer_ids = [offer['offer_id'] for offer in offers]
        
        # BATCH QUERY 1: Get all affiliate_requests for this user and these offers (single query)
        requests_collection = db_instance.get_collection('affiliate_requests')
        
        # Build query to match both string and ObjectId formats for user_id
        user_id_str = str(user_id)
        user_query_conditions = [
            {'user_id': user_id_str},
            {'user_id': user_id},
            {'publisher_id': user_id_str},
            {'publisher_id': user_id}
        ]
        try:
            from bson import ObjectId
            if ObjectId.is_valid(user_id_str):
                user_obj_id = ObjectId(user_id_str)
                user_query_conditions.extend([
                    {'user_id': user_obj_id},
                    {'publisher_id': user_obj_id}
                ])
        except:
            pass
        
        user_requests = list(requests_collection.find({
            'offer_id': {'$in': offer_ids},
            '$or': user_query_conditions
        }))
        # Create a lookup dict for O(1) access
        requests_by_offer = {req['offer_id']: req for req in user_requests}
        
        logger.info(f"📊 Batch loaded {len(user_requests)} requests for user {user_id_str} across {len(offers)} offers")
        
        # BATCH QUERY 2: Get user data once (already have it from token, but verify active status)
        users_collection = db_instance.get_collection('users')
        user_data = users_collection.find_one({'_id': user_id})
        user_is_active = user_data.get('is_active', True) if user_data else True
        user_is_premium = (user_data.get('account_type') == 'premium' or user_data.get('is_premium', False)) if user_data else False
        
        # Process offers for publisher view (no more DB queries in loop!)
        processed_offers = []
        
        for offer in offers:
            if '_id' in offer:
                offer['_id'] = str(offer['_id'])
            
            # Get approval settings
            approval_settings = offer.get('approval_settings', {})
            approval_type = approval_settings.get('type', 'auto_approve')
            
            # Check access using cached data (no DB query)
            has_access, access_reason = _check_offer_access_fast(
                offer, user_id, user_is_active, user_is_premium, requests_by_offer
            )
            
            # Check if user has pending request (from cache)
            existing_request = requests_by_offer.get(offer['offer_id'])
            
            # Calculate publisher payout (80% of original - 20% platform cut)
            original_payout = float(offer.get('payout', 0))
            publisher_payout = round(original_payout * 0.8, 2)
            
            # Prepare offer data for publisher
            offer_data = {
                'offer_id': offer['offer_id'],
                'name': offer['name'],
                'description': offer.get('description', ''),
                'category': offer.get('category', 'general'),
                'vertical': offer.get('vertical', offer.get('category', 'OTHER')),
                'payout': publisher_payout,
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
                'promo_code': offer.get('promo_code'),
                'promo_code_id': offer.get('promo_code_id'),
                'bonus_amount': offer.get('bonus_amount'),
                'bonus_type': offer.get('bonus_type'),
                # Traffic source rules
                'allowed_traffic_sources': offer.get('allowed_traffic_sources', []),
                'risky_traffic_sources': offer.get('risky_traffic_sources', []),
                'disallowed_traffic_sources': offer.get('disallowed_traffic_sources', [])
            }
            
            # 🔒 ADD VISIBILITY/LOCK INFORMATION using visibility service
            visibility = offer_visibility_service.get_offer_visibility_status(offer, user_id)
            offer_data['is_locked'] = visibility.get('is_locked', False)
            offer_data['lock_reason'] = visibility.get('lock_reason')
            offer_data['estimated_approval_time'] = visibility.get('estimated_approval_time', 'Immediate')
            
            # Override has_access with visibility service result
            if visibility.get('is_locked'):
                offer_data['has_access'] = False
                offer_data['is_preview'] = True
            
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
                offer_data['is_preview'] = True
                offer_data['estimated_approval_time'] = _get_estimated_approval_time_fast(
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


def _check_offer_access_fast(offer, user_id, user_is_active, user_is_premium, requests_by_offer):
    """
    Fast access check using pre-fetched data (no DB queries).
    This is an optimized version of access_service.check_offer_access()
    """
    try:
        # Check offer status (we already have the offer)
        if offer.get('status') != 'active':
            return False, f"Offer is {offer.get('status', 'inactive')}"
        
        # Check user status
        if not user_is_active:
            return False, "User account is inactive"
        
        # Check affiliate access level
        affiliate_access = offer.get('affiliates', 'all')
        
        if affiliate_access == 'all':
            return True, "Public access allowed"
        
        elif affiliate_access == 'premium':
            if user_is_premium:
                return True, "Premium access granted"
            else:
                return False, "Premium account required"
        
        elif affiliate_access == 'selected':
            selected_users = offer.get('selected_users', [])
            if user_id in selected_users:
                return True, "Selected affiliate access granted"
            else:
                return False, "Not in selected affiliates list"
        
        elif affiliate_access == 'request':
            # Check cached request status
            existing_request = requests_by_offer.get(offer['offer_id'])
            if existing_request:
                status = existing_request.get('status', 'pending')
                if status == 'approved':
                    return True, "Request-based access approved"
                elif status == 'pending':
                    return False, "Access request pending approval"
            return False, "Access request required"
        
        else:
            return False, f"Unknown access type: {affiliate_access}"
        
    except Exception as e:
        logger.error(f"Error in fast access check: {str(e)}")
        return False, f"Access check error: {str(e)}"


def _get_estimated_approval_time_fast(approval_type, approval_settings):
    """Get estimated approval time without DB query"""
    if approval_type == 'auto_approve':
        return 'Instant'
    elif approval_type == 'auto_approve_delayed':
        delay = approval_settings.get('delay_minutes', 60)
        if delay < 60:
            return f'{delay} minutes'
        elif delay < 1440:
            return f'{delay // 60} hours'
        else:
            return f'{delay // 1440} days'
    elif approval_type == 'manual':
        return '24-48 hours'
    else:
        return 'Unknown'


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
        
        # Calculate publisher payout (80% of original - 20% platform cut)
        original_payout = float(offer.get('payout', 0))
        offer['payout'] = round(original_payout * 0.8, 2)
        
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
