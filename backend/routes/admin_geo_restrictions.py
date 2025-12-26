"""
Admin Geo-Restriction Routes
Manage and view geo-restriction logs and statistics
"""

from flask import Blueprint, request, jsonify
from services.geo_restriction_service import get_geo_restriction_service
from utils.auth import token_required, admin_required
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

# Create blueprint
admin_geo_restriction_bp = Blueprint('admin_geo_restriction', __name__)

# Initialize service
geo_restriction_service = get_geo_restriction_service()


@admin_geo_restriction_bp.route('/admin/geo-restrictions/logs', methods=['GET'])
@token_required
@admin_required
def get_geo_restriction_logs(current_user):
    """
    Get geo-restriction access logs
    
    Query Parameters:
        - offer_id: Filter by offer ID (optional)
        - country_code: Filter by country code (optional)
        - limit: Number of logs to return (default: 100)
        - skip: Number of logs to skip for pagination (default: 0)
    """
    try:
        offer_id = request.args.get('offer_id')
        country_code = request.args.get('country_code')
        limit = int(request.args.get('limit', 100))
        skip = int(request.args.get('skip', 0))
        
        logs = geo_restriction_service.get_blocked_access_logs(
            offer_id=offer_id,
            country_code=country_code,
            limit=limit,
            skip=skip
        )
        
        return jsonify({
            'success': True,
            'logs': logs,
            'count': len(logs),
            'filters': {
                'offer_id': offer_id,
                'country_code': country_code
            },
            'pagination': {
                'limit': limit,
                'skip': skip
            }
        }), 200
        
    except Exception as e:
        logger.error(f"Error retrieving geo-restriction logs: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@admin_geo_restriction_bp.route('/admin/geo-restrictions/stats', methods=['GET'])
@token_required
@admin_required
def get_geo_restriction_stats(current_user):
    """
    Get geo-restriction statistics
    
    Query Parameters:
        - offer_id: Filter by offer ID (optional)
        - days: Number of days to look back (default: 7)
    """
    try:
        offer_id = request.args.get('offer_id')
        days = int(request.args.get('days', 7))
        
        stats = geo_restriction_service.get_blocked_access_stats(
            offer_id=offer_id,
            days=days
        )
        
        return jsonify({
            'success': True,
            'stats': stats
        }), 200
        
    except Exception as e:
        logger.error(f"Error retrieving geo-restriction stats: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@admin_geo_restriction_bp.route('/admin/geo-restrictions/test', methods=['POST'])
@token_required
@admin_required
def test_geo_restriction(current_user):
    """
    Test geo-restriction for a specific IP and offer
    
    Request Body:
        {
            "offer_id": "ML-00001",
            "ip_address": "8.8.8.8"
        }
    """
    try:
        data = request.get_json()
        
        if not data or not data.get('offer_id') or not data.get('ip_address'):
            return jsonify({
                'success': False,
                'error': 'offer_id and ip_address are required'
            }), 400
        
        offer_id = data['offer_id']
        ip_address = data['ip_address']
        
        # Get the offer
        from models.offer import Offer
        offer_model = Offer()
        offer = offer_model.get_offer_by_id(offer_id)
        
        if not offer:
            return jsonify({
                'success': False,
                'error': f'Offer {offer_id} not found'
            }), 404
        
        # Test the geo-restriction
        access_check = geo_restriction_service.check_country_access(
            offer=offer,
            user_ip=ip_address,
            user_context={'test': True}
        )
        
        return jsonify({
            'success': True,
            'offer_id': offer_id,
            'ip_address': ip_address,
            'access_check': access_check,
            'offer_settings': {
                'allowed_countries': offer.get('allowed_countries', []),
                'non_access_url': offer.get('non_access_url', '')
            }
        }), 200
        
    except Exception as e:
        logger.error(f"Error testing geo-restriction: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500
