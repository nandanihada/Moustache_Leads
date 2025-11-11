#!/usr/bin/env python3
"""
Publisher Offers API - Public offers endpoint for publishers
"""

from flask import Blueprint, request, jsonify
from database import db_instance
from utils.auth import token_required
import logging

publisher_offers_bp = Blueprint('publisher_offers', __name__)
logger = logging.getLogger(__name__)

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
        
        query = {'status': status}
        
        # Add search if provided
        if search:
            query['$or'] = [
                {'name': {'$regex': search, '$options': 'i'}},
                {'offer_id': {'$regex': search, '$options': 'i'}},
                {'category': {'$regex': search, '$options': 'i'}}
            ]
        
        # Get total count
        total = offers_collection.count_documents(query)
        
        # Get paginated results
        skip = (page - 1) * per_page
        offers = list(offers_collection.find(query).skip(skip).limit(per_page).sort('created_at', -1))
        
        # Convert ObjectId to string for JSON serialization
        for offer in offers:
            if '_id' in offer:
                offer['_id'] = str(offer['_id'])
        
        logger.info(f"✅ Returning {len(offers)} offers (total: {total})")
        
        return jsonify({
            'success': True,
            'offers': offers,
            'pagination': {
                'page': page,
                'per_page': per_page,
                'total': total,
                'pages': (total + per_page - 1) // per_page
            }
        }), 200
        
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


@publisher_offers_bp.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'service': 'publisher_offers',
        'endpoints': [
            'GET /api/publisher/offers/available',
            'GET /api/publisher/offers/<offer_id>'
        ]
    }), 200
