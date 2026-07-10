"""
Link Health Admin Routes

Provides endpoints for the admin panel to:
- View broken/unhealthy offer links
- Get health statistics
- Manually re-check specific offers
- Bulk re-check
"""

from flask import Blueprint, jsonify, request
from database import db_instance
from utils.auth import admin_required, token_required

link_health_bp = Blueprint('link_health', __name__)


@link_health_bp.route('/link-health/stats', methods=['GET'])
@token_required
@admin_required
def get_link_health_stats():
    """Get summary statistics for link health."""
    try:
        from services.link_health_service import get_link_health_service
        service = get_link_health_service()
        stats = service.get_stats()
        return jsonify({'success': True, 'stats': stats}), 200
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@link_health_bp.route('/link-health/offers', methods=['GET'])
@token_required
@admin_required
def get_link_health_offers():
    """
    Get offers with their link health status.
    Query params:
      - status: filter by link health status (broken, soft_broken, healthy, error, no_url)
      - page: page number (default 1)
      - limit: items per page (default 50)
      - search: search by offer name or ID
      - network: filter by network
    """
    try:
        offers_col = db_instance.get_collection('offers')
        if offers_col is None:
            return jsonify({'success': False, 'error': 'Database unavailable'}), 500

        # Parse query params
        status_filter = request.args.get('status', '')
        page = max(1, int(request.args.get('page', 1)))
        limit = min(100, max(1, int(request.args.get('limit', 50))))
        search = request.args.get('search', '').strip()
        network_filter = request.args.get('network', '').strip()
        skip = (page - 1) * limit

        # Build query
        query = {
            'status': {'$in': ['running', 'active', 'rotating']},
            'deleted': {'$ne': True},
            'target_url': {'$exists': True, '$ne': ''},
        }

        if status_filter:
            if status_filter == 'never_checked':
                query['link_health'] = {'$exists': False}
            else:
                query['link_health.status'] = status_filter

        if search:
            query['$or'] = [
                {'name': {'$regex': search, '$options': 'i'}},
                {'offer_id': {'$regex': search, '$options': 'i'}},
            ]

        if network_filter:
            query['network'] = {'$regex': network_filter, '$options': 'i'}

        # Fetch offers
        total = offers_col.count_documents(query)
        offers = list(offers_col.find(
            query,
            {
                'offer_id': 1, 'name': 1, 'target_url': 1, 'network': 1,
                'status': 1, 'link_health': 1, 'payout': 1, 'currency': 1,
            }
        ).sort([
            ('link_health.last_checked', 1),
        ]).skip(skip).limit(limit))

        # Serialize
        result = []
        for offer in offers:
            link_health = offer.get('link_health') or {}

            # Safe datetime serialization
            last_checked = link_health.get('last_checked')
            if last_checked and hasattr(last_checked, 'isoformat'):
                last_checked = last_checked.isoformat() + 'Z'
            elif last_checked:
                last_checked = str(last_checked)
            else:
                last_checked = None

            result.append({
                'offer_id': offer.get('offer_id'),
                'name': offer.get('name'),
                'target_url': offer.get('target_url'),
                'network': offer.get('network'),
                'status': offer.get('status'),
                'payout': offer.get('payout'),
                'currency': offer.get('currency', 'USD'),
                'link_health': {
                    'status': link_health.get('status', 'never_checked'),
                    'last_checked': last_checked,
                    'final_url': link_health.get('final_url'),
                    'final_status': link_health.get('final_status'),
                    'failure_reason': link_health.get('failure_reason'),
                    'redirect_count': link_health.get('redirect_count', 0),
                    'matched_keywords': link_health.get('matched_keywords', []),
                    'checked_by': link_health.get('checked_by'),
                },
            })

        return jsonify({
            'success': True,
            'offers': result,
            'total': total,
            'page': page,
            'limit': limit,
            'total_pages': (total + limit - 1) // limit,
        }), 200

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


@link_health_bp.route('/link-health/check/<offer_id>', methods=['POST'])
@token_required
@admin_required
def check_single_offer(offer_id):
    """Manually trigger a health check for a single offer."""
    try:
        from services.link_health_service import get_link_health_service
        service = get_link_health_service()
        result = service.check_offer_manually(offer_id)

        if 'error' in result:
            return jsonify({'success': False, 'error': result['error']}), 400

        return jsonify({'success': True, 'result': result}), 200
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@link_health_bp.route('/link-health/check-bulk', methods=['POST'])
@token_required
@admin_required
def check_bulk_offers():
    """
    Manually trigger health check for multiple offers.
    Body: { "offer_ids": ["ML-00001", "ML-00002", ...] }
    Max 20 at a time to avoid timeout.
    """
    try:
        data = request.get_json() or {}
        offer_ids = data.get('offer_ids', [])

        if not offer_ids:
            return jsonify({'success': False, 'error': 'No offer_ids provided'}), 400

        if len(offer_ids) > 20:
            return jsonify({'success': False, 'error': 'Max 20 offers per bulk check'}), 400

        from services.link_health_service import get_link_health_service
        service = get_link_health_service()

        results = {}
        for oid in offer_ids:
            results[oid] = service.check_offer_manually(oid)

        broken_count = sum(
            1 for r in results.values()
            if isinstance(r, dict) and r.get('status') in ('broken', 'soft_broken')
        )

        return jsonify({
            'success': True,
            'results': results,
            'checked': len(results),
            'broken': broken_count,
        }), 200
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@link_health_bp.route('/link-health/networks', methods=['GET'])
@token_required
@admin_required
def get_networks_with_issues():
    """Get networks. If ?all=true, returns all networks. Otherwise only ones with broken links."""
    try:
        offers_col = db_instance.get_collection('offers')
        if offers_col is None:
            return jsonify({'success': False, 'error': 'Database unavailable'}), 500

        show_all = request.args.get('all', '').lower() == 'true'

        if show_all:
            # Return all distinct networks for active offers
            pipeline = [
                {'$match': {
                    'status': {'$in': ['running', 'active', 'rotating']},
                    'deleted': {'$ne': True},
                    'network': {'$exists': True, '$ne': ''},
                }},
                {'$group': {
                    '_id': '$network',
                    'count': {'$sum': 1},
                }},
                {'$sort': {'count': -1}},
                {'$limit': 50},
            ]
            results = list(offers_col.aggregate(pipeline))
            networks = [{'network': r['_id'], 'count': r['count']} for r in results if r['_id']]
        else:
            pipeline = [
                {'$match': {
                    'status': {'$in': ['running', 'active', 'rotating']},
                    'deleted': {'$ne': True},
                    'link_health.status': {'$in': ['broken', 'soft_broken']},
                }},
                {'$group': {
                    '_id': '$network',
                    'broken_count': {'$sum': 1},
                }},
                {'$sort': {'broken_count': -1}},
                {'$limit': 30},
            ]
            results = list(offers_col.aggregate(pipeline))
            networks = [{'network': r['_id'], 'broken_count': r['broken_count']} for r in results if r['_id']]

        return jsonify({'success': True, 'networks': networks}), 200
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500
