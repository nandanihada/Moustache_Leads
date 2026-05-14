"""
Admin Offerwall Management API
Provides full control over the offerwall display: pinning, hiding, featuring,
reordering offers, theme settings, and announcements.
"""

from flask import Blueprint, request, jsonify
from utils.auth import token_required
from database import db_instance
from services.health_check_service import HealthCheckService
from datetime import datetime
from bson import ObjectId
import logging
import uuid

logger = logging.getLogger(__name__)

admin_offerwall_management_bp = Blueprint('admin_offerwall_management', __name__)


def get_collection(name):
    """Get a MongoDB collection by name."""
    return db_instance.get_collection(name)


def get_default_settings():
    """Return default offerwall settings structure."""
    return {
        "pinned_offers": [],
        "hidden_offers": [],
        "featured_offers": [],
        "display_order": [],
        "theme": {
            "primary_color": "#6366f1",
            "layout": "grid",
            "cards_per_row": 3,
            "show_categories": True,
            "show_search": True
        },
        "announcements": [],
        "updated_at": datetime.utcnow(),
        "updated_by": None
    }


def get_settings_doc():
    """Get the singleton offerwall settings document, creating if not exists."""
    collection = get_collection('offerwall_settings')
    if collection is None:
        return None
    settings = collection.find_one({})
    if not settings:
        default = get_default_settings()
        collection.insert_one(default)
        settings = collection.find_one({})
    return settings


def get_offerwall_base_query(hidden_offers=None):
    """Build the base query filter matching what the actual offerwall uses."""
    # Fetch starter offer IDs so they are always included regardless of status
    starter_offer_ids = []
    try:
        settings_col = get_collection('offerwall_settings')
        if settings_col is not None:
            settings_doc = settings_col.find_one({})
            if settings_doc:
                starter_offer_ids = settings_doc.get('new_user_offer_ids', [])
    except Exception:
        pass

    # Status filter: include 'active' offers + any starter offers (which may be 'running')
    if starter_offer_ids:
        status_condition = {'$or': [{'status': 'active'}, {'offer_id': {'$in': starter_offer_ids}}]}
    else:
        status_condition = {'status': 'active'}

    query_filter = {
        '$and': [
            {'$or': [{'deleted': {'$exists': False}}, {'deleted': False}, {'deleted': None}]},
            {'$or': [{'is_active': True}, {'is_active': {'$exists': False}}]},
            {'$or': [{'show_in_offerwall': True}, {'show_in_offerwall': {'$exists': False}}]},
            status_condition
        ]
    }
    if hidden_offers:
        query_filter['offer_id'] = {'$nin': hidden_offers}
    return query_filter


def count_offerwall_visible():
    """Count offers actually visible on the offerwall (after health check)."""
    offers_collection = get_collection('offers')
    settings_collection = get_collection('offerwall_settings')
    if offers_collection is None:
        return 0

    settings = settings_collection.find_one({}) if settings_collection is not None else {}
    hidden_offers = (settings or {}).get('hidden_offers', [])
    query_filter = get_offerwall_base_query(hidden_offers)

    # Fetch all matching offers for health check (need full docs for evaluation)
    projection = {
        'offer_id': 1, 'name': 1, 'network': 1, 'target_url': 1,
        'image_url': 1, 'countries': 1, 'allowed_countries': 1,
        'payout': 1, 'payout_model': 1, 'offer_type': 1,
        'vertical': 1, 'category': 1
    }
    offers_list = list(offers_collection.find(query_filter, projection))

    # Apply health check filter
    try:
        health_service = HealthCheckService()
        health_results = health_service.evaluate_offers_batch(offers_list)
        healthy_count = sum(1 for o in offers_list if health_results.get(o.get('offer_id'), {}).get('status') == 'healthy')
        return healthy_count
    except Exception as e:
        logger.warning(f"Health check failed in count, returning raw count: {e}")
        return len(offers_list)


def serialize_settings(settings):
    """Serialize settings for JSON response."""
    if not settings:
        return get_default_settings()
    result = {
        "pinned_offers": settings.get("pinned_offers", []),
        "hidden_offers": settings.get("hidden_offers", []),
        "featured_offers": settings.get("featured_offers", []),
        "display_order": settings.get("display_order", []),
        "theme": settings.get("theme", {
            "primary_color": "#6366f1",
            "layout": "grid",
            "cards_per_row": 3,
            "show_categories": True,
            "show_search": True
        }),
        "announcements": settings.get("announcements", []),
        "updated_at": settings.get("updated_at", "").isoformat() + 'Z' if isinstance(settings.get("updated_at"), datetime) else settings.get("updated_at"),
        "updated_by": settings.get("updated_by")
    }
    return result


@admin_offerwall_management_bp.route('/offerwall-management/settings', methods=['GET'])
@token_required
def get_settings():
    """Get current offerwall management settings."""
    try:
        current_user = request.current_user
        if current_user.get('role') != 'admin':
            return jsonify({'error': 'Admin access required'}), 403

        settings = get_settings_doc()
        if settings is None:
            return jsonify({'error': 'Database connection failed'}), 500

        return jsonify({'settings': serialize_settings(settings)}), 200
    except Exception as e:
        logger.error(f"Error getting offerwall settings: {str(e)}")
        return jsonify({'error': 'Failed to fetch settings'}), 500


@admin_offerwall_management_bp.route('/offerwall-management/display-settings', methods=['GET'])
def get_display_settings():
    """Public endpoint - returns display settings for the offerwall (no auth needed)."""
    try:
        settings = get_settings_doc()
        if settings is None:
            # Return defaults if no settings exist
            return jsonify({
                'theme': {
                    'primary_color': '#6366f1',
                    'background_color': '#0f172a',
                    'layout': 'grid',
                    'cards_per_row': 3,
                    'show_categories': True,
                    'show_search': True
                },
                'announcements': []
            }), 200

        theme = settings.get('theme', {
            'primary_color': '#6366f1',
            'background_color': '#0f172a',
            'layout': 'grid',
            'cards_per_row': 3,
            'show_categories': True,
            'show_search': True
        })
        # Ensure background_color has a default
        if 'background_color' not in theme:
            theme['background_color'] = '#0f172a'
        announcements = [a for a in settings.get('announcements', []) if a.get('active')]

        return jsonify({
            'theme': theme,
            'announcements': announcements
        }), 200
    except Exception as e:
        logger.error(f"Error getting display settings: {str(e)}")
        return jsonify({
            'theme': {
                'primary_color': '#6366f1',
                'background_color': '#0f172a',
                'layout': 'grid',
                'cards_per_row': 3,
                'show_categories': True,
                'show_search': True
            },
            'announcements': []
        }), 200


@admin_offerwall_management_bp.route('/offerwall-management/settings', methods=['PUT'])
@token_required
def update_settings():
    """Update offerwall management settings (theme, layout, etc.)."""
    try:
        current_user = request.current_user
        if current_user.get('role') != 'admin':
            return jsonify({'error': 'Admin access required'}), 403

        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400

        collection = get_collection('offerwall_settings')
        if collection is None:
            return jsonify({'error': 'Database connection failed'}), 500

        # Build update dict from allowed fields
        update_fields = {}
        allowed_keys = ['theme', 'announcements', 'pinned_offers', 'hidden_offers', 'featured_offers', 'display_order']
        for key in allowed_keys:
            if key in data:
                update_fields[key] = data[key]

        update_fields['updated_at'] = datetime.utcnow()
        update_fields['updated_by'] = str(current_user.get('_id', current_user.get('user_id', '')))

        # Upsert the singleton settings document
        collection.update_one({}, {'$set': update_fields}, upsert=True)

        return jsonify({'message': 'Settings updated successfully'}), 200
    except Exception as e:
        logger.error(f"Error updating offerwall settings: {str(e)}")
        return jsonify({'error': 'Failed to update settings'}), 500


@admin_offerwall_management_bp.route('/offerwall-management/pin', methods=['POST'])
@token_required
def pin_offers():
    """Pin or unpin offers to the top of the offerwall."""
    try:
        current_user = request.current_user
        if current_user.get('role') != 'admin':
            return jsonify({'error': 'Admin access required'}), 403

        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400

        offer_ids = data.get('offer_ids', [])
        action = data.get('action', 'pin')  # 'pin' or 'unpin'

        if not offer_ids:
            return jsonify({'error': 'offer_ids required'}), 400
        if action not in ('pin', 'unpin'):
            return jsonify({'error': 'action must be pin or unpin'}), 400

        collection = get_collection('offerwall_settings')
        if collection is None:
            return jsonify({'error': 'Database connection failed'}), 500

        if action == 'pin':
            collection.update_one(
                {},
                {
                    '$addToSet': {'pinned_offers': {'$each': offer_ids}},
                    '$set': {
                        'updated_at': datetime.utcnow(),
                        'updated_by': str(current_user.get('_id', current_user.get('user_id', '')))
                    }
                },
                upsert=True
            )
        else:
            collection.update_one(
                {},
                {
                    '$pull': {'pinned_offers': {'$in': offer_ids}},
                    '$set': {
                        'updated_at': datetime.utcnow(),
                        'updated_by': str(current_user.get('_id', current_user.get('user_id', '')))
                    }
                },
                upsert=True
            )

        return jsonify({'message': f'Offers {action}ned successfully'}), 200
    except Exception as e:
        logger.error(f"Error pinning offers: {str(e)}")
        return jsonify({'error': 'Failed to pin/unpin offers'}), 500


@admin_offerwall_management_bp.route('/offerwall-management/visibility', methods=['POST'])
@token_required
def set_visibility():
    """Show or hide specific offers from the offerwall."""
    try:
        current_user = request.current_user
        if current_user.get('role') != 'admin':
            return jsonify({'error': 'Admin access required'}), 403

        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400

        offer_ids = data.get('offer_ids', [])
        action = data.get('action', 'hide')  # 'show' or 'hide'

        if not offer_ids:
            return jsonify({'error': 'offer_ids required'}), 400
        if action not in ('show', 'hide'):
            return jsonify({'error': 'action must be show or hide'}), 400

        collection = get_collection('offerwall_settings')
        if collection is None:
            return jsonify({'error': 'Database connection failed'}), 500

        if action == 'hide':
            collection.update_one(
                {},
                {
                    '$addToSet': {'hidden_offers': {'$each': offer_ids}},
                    '$set': {
                        'updated_at': datetime.utcnow(),
                        'updated_by': str(current_user.get('_id', current_user.get('user_id', '')))
                    }
                },
                upsert=True
            )
        else:
            collection.update_one(
                {},
                {
                    '$pull': {'hidden_offers': {'$in': offer_ids}},
                    '$set': {
                        'updated_at': datetime.utcnow(),
                        'updated_by': str(current_user.get('_id', current_user.get('user_id', '')))
                    }
                },
                upsert=True
            )

        return jsonify({'message': f'Offers visibility updated ({action})'}), 200
    except Exception as e:
        logger.error(f"Error updating visibility: {str(e)}")
        return jsonify({'error': 'Failed to update visibility'}), 500


@admin_offerwall_management_bp.route('/offerwall-management/reorder', methods=['PUT'])
@token_required
def reorder_offers():
    """Change the display order of offers on the offerwall."""
    try:
        current_user = request.current_user
        if current_user.get('role') != 'admin':
            return jsonify({'error': 'Admin access required'}), 403

        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400

        order = data.get('order', [])
        if not order:
            return jsonify({'error': 'order array required'}), 400

        collection = get_collection('offerwall_settings')
        if collection is None:
            return jsonify({'error': 'Database connection failed'}), 500

        collection.update_one(
            {},
            {
                '$set': {
                    'display_order': order,
                    'updated_at': datetime.utcnow(),
                    'updated_by': str(current_user.get('_id', current_user.get('user_id', '')))
                }
            },
            upsert=True
        )

        return jsonify({'message': 'Offer order updated successfully'}), 200
    except Exception as e:
        logger.error(f"Error reordering offers: {str(e)}")
        return jsonify({'error': 'Failed to reorder offers'}), 500


@admin_offerwall_management_bp.route('/offerwall-management/offerwall-offers', methods=['GET'])
@token_required
def get_offerwall_offers():
    """Get only the offers that are currently visible on the offerwall (with health check)."""
    try:
        current_user = request.current_user
        if current_user.get('role') != 'admin':
            return jsonify({'error': 'Admin access required'}), 403

        search = request.args.get('search', '')
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 50))

        offers_collection = get_collection('offers')
        settings_collection = get_collection('offerwall_settings')

        if offers_collection is None:
            return jsonify({'error': 'Database connection failed'}), 500

        # Get hidden offers from settings to exclude them
        settings = settings_collection.find_one({}) if settings_collection is not None else None
        hidden_offers = (settings or {}).get('hidden_offers', [])

        # Same filter as the actual offerwall uses
        query_filter = get_offerwall_base_query(hidden_offers)

        # Add search filter
        if search:
            query_filter['$and'].append({
                '$or': [
                    {'name': {'$regex': search, '$options': 'i'}},
                    {'offer_id': {'$regex': search, '$options': 'i'}}
                ]
            })

        # Fetch ALL matching offers (we need to health-check them before paginating)
        projection = {
            'offer_id': 1, 'name': 1, 'status': 1, 'category': 1, 'vertical': 1,
            'payout': 1, 'network': 1, 'image_url': 1, 'countries': 1, 'allowed_countries': 1,
            'created_at': 1, 'target_url': 1, 'payout_model': 1, 'offer_type': 1
        }

        all_offers = list(offers_collection.find(query_filter, projection).sort('created_at', -1))

        # Apply health check filter (same as offerwall does)
        try:
            health_service = HealthCheckService()
            health_results = health_service.evaluate_offers_batch(all_offers)
            healthy_offers = [o for o in all_offers if health_results.get(o.get('offer_id'), {}).get('status') == 'healthy']
        except Exception as e:
            logger.warning(f"Health check failed, returning all matching offers: {e}")
            healthy_offers = all_offers

        # Now paginate the healthy offers
        total = len(healthy_offers)
        skip = (page - 1) * per_page
        paginated_offers = healthy_offers[skip:skip + per_page]

        # Serialize
        serialized = []
        for offer in paginated_offers:
            serialized.append({
                'offer_id': offer.get('offer_id', ''),
                'name': offer.get('name', ''),
                'status': offer.get('status', 'active'),
                'category': offer.get('vertical') or offer.get('category', 'OTHER'),
                'payout': offer.get('payout', 0),
                'network': offer.get('network', ''),
                'image_url': offer.get('image_url', ''),
                'countries': offer.get('countries', []),
            })

        return jsonify({
            'offers': serialized,
            'pagination': {
                'page': page,
                'per_page': per_page,
                'total': total,
                'pages': (total + per_page - 1) // per_page if total > 0 else 1
            }
        }), 200
    except Exception as e:
        logger.error(f"Error getting offerwall offers: {str(e)}")
        return jsonify({'error': 'Failed to fetch offerwall offers'}), 500


@admin_offerwall_management_bp.route('/offerwall-management/new-user-offers', methods=['GET'])
def get_new_user_offers():
    """GET: returns the list of new_user_offer_ids (public)."""
    try:
        collection = get_collection('offerwall_settings')
        if collection is None:
            return jsonify({'offer_ids': []}), 200

        settings = collection.find_one({})
        offer_ids = (settings or {}).get('new_user_offer_ids', [])
        return jsonify({'offer_ids': offer_ids, 'new_user_offer_ids': offer_ids}), 200
    except Exception as e:
        logger.error(f"Error getting new user offers: {str(e)}")
        return jsonify({'offer_ids': []}), 200


@admin_offerwall_management_bp.route('/offerwall-management/new-user-offers', methods=['PUT'])
@token_required
def update_new_user_offers():
    """PUT: updates the list of starter offer IDs (admin only)."""
    try:
        current_user = request.current_user
        if current_user.get('role') not in ('admin', 'subadmin'):
            return jsonify({'error': 'Admin access required'}), 403

        collection = get_collection('offerwall_settings')
        if collection is None:
            return jsonify({'error': 'Database connection failed'}), 500

        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400

        offer_ids = data.get('offer_ids', [])
        collection.update_one(
            {},
            {'$set': {
                'new_user_offer_ids': offer_ids,
                'updated_at': datetime.utcnow()
            }},
            upsert=True
        )

        # Also set show_in_offerwall=True and status=running for these offers so they appear in the offerwall
        offers_collection = get_collection('offers')
        if offers_collection is not None and offer_ids:
            offers_collection.update_many(
                {'offer_id': {'$in': offer_ids}},
                {'$set': {'show_in_offerwall': True, 'status': 'running'}}
            )

        return jsonify({'success': True, 'message': f'{len(offer_ids)} starter offers saved'}), 200
    except Exception as e:
        logger.error(f"Error updating new user offers: {str(e)}")
        return jsonify({'error': str(e)}), 500


@admin_offerwall_management_bp.route('/offerwall-management/stats', methods=['GET'])
@token_required
def get_stats():
    """Get offerwall statistics: total active, visible (actual offerwall count), pinned, featured."""
    try:
        current_user = request.current_user
        if current_user.get('role') != 'admin':
            return jsonify({'error': 'Admin access required'}), 403

        offers_collection = get_collection('offers')
        settings_collection = get_collection('offerwall_settings')

        if offers_collection is None or settings_collection is None:
            return jsonify({'error': 'Database connection failed'}), 500

        # Count active offers
        total_active = offers_collection.count_documents({'status': {'$in': ['active', 'running']}})

        # Get settings for hidden/pinned/featured counts
        settings = settings_collection.find_one({}) or {}
        hidden_offers = settings.get('hidden_offers', [])
        pinned_offers = settings.get('pinned_offers', [])
        featured_offers = settings.get('featured_offers', [])

        hidden_count = len(hidden_offers)
        pinned_count = len(pinned_offers)
        featured_count = len(featured_offers)

        # Get actual offerwall-visible count (same query + health check as the real offerwall)
        total_visible = count_offerwall_visible()

        stats = {
            'total_active': total_active,
            'total_visible': total_visible,
            'pinned_count': pinned_count,
            'featured_count': featured_count,
            'hidden_count': hidden_count
        }

        return jsonify({'stats': stats}), 200
    except Exception as e:
        logger.error(f"Error getting offerwall stats: {str(e)}")
        return jsonify({'error': 'Failed to fetch stats'}), 500
