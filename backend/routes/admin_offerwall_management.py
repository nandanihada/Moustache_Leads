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


def _get_offerwall_source(offer: dict) -> dict:
    """
    Determine why/how an offer is in the offerwall and return source info.
    Returns: { reason: str, date: str|None, by: str|None }
    """
    source = offer.get('show_in_offerwall_source', '')
    added_at = offer.get('show_in_offerwall_added_at')
    added_by = offer.get('show_in_offerwall_added_by', '')
    added_at_str = added_at.isoformat() + 'Z' if isinstance(added_at, datetime) else str(added_at or '')

    # Check specific source field first
    if source:
        return {'reason': source, 'date': added_at_str, 'by': added_by}

    # Infer reason from offer fields
    if offer.get('offerwall_exclusive'):
        since = offer.get('offerwall_exclusive_since')
        since_str = since.isoformat() + 'Z' if isinstance(since, datetime) else str(since or '')
        return {'reason': 'Offerwall Exclusive', 'date': since_str, 'by': 'admin'}

    if offer.get('is_pinned'):
        return {'reason': 'Pinned by admin', 'date': added_at_str, 'by': 'admin'}

    # Default: imported with show_in_offerwall=true
    created = offer.get('created_at')
    created_str = created.isoformat() + 'Z' if isinstance(created, datetime) else str(created or '')
    return {'reason': 'Added on import', 'date': created_str, 'by': 'system'}


@admin_offerwall_management_bp.route('/offerwall-management/offerwall-offers', methods=['GET'])
@token_required
def get_offerwall_offers():
    """Get all offers that have show_in_offerwall=True (admin view — not filtered by status/health)."""
    try:
        current_user = request.current_user
        if current_user.get('role') != 'admin':
            return jsonify({'error': 'Admin access required'}), 403

        search = request.args.get('search', '')
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 50))
        refined_filter = request.args.get('refined', '')  # 'yes', 'no', or ''

        offers_collection = get_collection('offers')
        settings_collection = get_collection('offerwall_settings')

        if offers_collection is None:
            return jsonify({'error': 'Database connection failed'}), 500

        # Get hidden offers from settings to exclude them
        settings = settings_collection.find_one({}) if settings_collection is not None else None
        hidden_offers = (settings or {}).get('hidden_offers', [])

        # Use the same base query as the actual offerwall (active + show_in_offerwall + not deleted)
        # This ensures Offer Controls shows exactly what's live in the offerwall
        query_filter = get_offerwall_base_query(hidden_offers)

        # Add search filter
        if search:
            query_filter['$and'].append({
                '$or': [
                    {'name': {'$regex': search, '$options': 'i'}},
                    {'offer_id': {'$regex': search, '$options': 'i'}}
                ]
            })

        # Add refined filter — only match offers refined via admin dialog
        if refined_filter == 'yes':
            query_filter['$and'].append({'refined_via_admin': True})
        elif refined_filter == 'no':
            query_filter['$and'].append({'$or': [
                {'refined_via_admin': {'$exists': False}},
                {'refined_via_admin': False},
                {'refined_via_admin': None},
            ]})

        # Fetch ALL matching offers (no health check — admin needs to see ALL show_in_offerwall offers)
        projection = {
            'offer_id': 1, 'name': 1, 'original_name': 1, 'status': 1, 'category': 1, 'vertical': 1,
            'payout': 1, 'network': 1, 'image_url': 1, 'thumbnail_url': 1,
            'description': 1, 'countries': 1, 'allowed_countries': 1,
            'created_at': 1, 'updated_at': 1, 'refined_at': 1, 'renamed_at': 1,
            'target_url': 1, 'payout_model': 1, 'offer_type': 1, 'payout_type': 1,
            'offerwall_position': 1, 'price_boost': 1, 'publisher_payout_override': 1,
            'refined_description': 1, 'refined_via_admin': 1,
            'show_in_offerwall_source': 1, 'show_in_offerwall_added_at': 1,
            'offerwall_exclusive': 1, 'offerwall_exclusive_since': 1,
            'auto_deactivated': 1, 'auto_deactivated_at': 1,
            'is_pinned': 1, 'pinnedPosition': 1,
        }

        all_offers = list(offers_collection.find(query_filter, projection).sort('created_at', -1))

        # Apply health check — Offer Controls shows only what's actually live in the offerwall
        try:
            health_service = HealthCheckService()
            health_results = health_service.evaluate_offers_batch(all_offers)
            all_offers = [o for o in all_offers if health_results.get(o.get('offer_id'), {}).get('status') == 'healthy']
        except Exception as e:
            logger.warning(f"Health check failed in offer controls, returning all: {e}")

        # Paginate after health filter
        total = len(all_offers)
        skip = (page - 1) * per_page
        paginated_offers = all_offers[skip:skip + per_page]

        # Serialize
        serialized = []
        for offer in paginated_offers:
            boost = offer.get('price_boost')
            is_boosted = False
            if boost and isinstance(boost, dict):
                expires_at = boost.get('expires_at')
                if expires_at and isinstance(expires_at, datetime) and expires_at > datetime.utcnow():
                    is_boosted = True

            created_at = offer.get('created_at')
            created_at_str = created_at.isoformat() + 'Z' if isinstance(created_at, datetime) else str(created_at or '')

            serialized.append({
                'offer_id': offer.get('offer_id', ''),
                'name': offer.get('name', ''),
                'original_name': offer.get('original_name'),
                'status': offer.get('status', 'active'),
                'category': offer.get('vertical') or offer.get('category', 'OTHER'),
                'payout': offer.get('payout', 0),
                'payout_type': offer.get('payout_type', 'cpa'),
                'publisher_payout_override': offer.get('publisher_payout_override'),
                'network': offer.get('network', ''),
                'image_url': offer.get('image_url', '') or offer.get('thumbnail_url', ''),
                'description': offer.get('description', ''),
                'countries': offer.get('countries', []) or offer.get('allowed_countries', []) or [],
                'offerwall_position': offer.get('offerwall_position'),
                'created_at': created_at_str,
                'updated_at': offer.get('updated_at', '').isoformat() + 'Z' if isinstance(offer.get('updated_at'), datetime) else str(offer.get('updated_at') or ''),
                'refined_at': offer.get('refined_at', '').isoformat() + 'Z' if isinstance(offer.get('refined_at'), datetime) else str(offer.get('refined_at') or ''),
                'renamed_at': offer.get('renamed_at', '').isoformat() + 'Z' if isinstance(offer.get('renamed_at'), datetime) else str(offer.get('renamed_at') or ''),
                'refined_description': offer.get('refined_description'),
                'is_boosted': is_boosted,
                'has_refined': bool(offer.get('refined_via_admin')),
                'offerwall_source': _get_offerwall_source(offer),
                'show_in_offerwall_added_at': offer.get('show_in_offerwall_added_at', '').isoformat() + 'Z' if isinstance(offer.get('show_in_offerwall_added_at'), datetime) else str(offer.get('show_in_offerwall_added_at') or ''),
                'price_boost': {
                    'percentage': boost.get('percentage', 0),
                    'direction': boost.get('direction', 'increase'),
                    'expires_at': boost['expires_at'].isoformat() + 'Z' if isinstance(boost.get('expires_at'), datetime) else str(boost.get('expires_at', '')),
                    'original_payout': boost.get('original_payout', 0),
                    'boosted_payout': boost.get('boosted_payout', 0),
                } if is_boosted and boost else None,
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


@admin_offerwall_management_bp.route('/offerwall-management/tracking-logs', methods=['GET'])
@token_required
def get_tracking_logs():
    """
    Admin: Get all offerwall tracking logs across all placements/users.
    Includes: iframe (placement), publisher, end_user, offer, status, time.
    Filterable by status: clicked | pending | completed | all
    """
    try:
        current_user = request.current_user
        if current_user.get('role') not in ('admin', 'subadmin'):
            return jsonify({'error': 'Admin access required'}), 403

        status_filter = request.args.get('status', 'all')  # all | clicked | pending | completed
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 50))
        search = request.args.get('search', '').strip()

        clicks_col = db_instance.get_collection('offerwall_clicks')
        clicks_detailed_col = db_instance.get_collection('offerwall_clicks_detailed')
        conversions_col = db_instance.get_collection('offerwall_conversions')
        placements_col = db_instance.get_collection('placements')

        logs = []

        # Only show tracking data from the last 90 days to avoid stale records
        from datetime import timedelta
        ninety_days_ago = datetime.utcnow() - timedelta(days=90)
        date_filter = {'timestamp': {'$gte': ninety_days_ago}}

        # Build placement lookup cache for iframe/publisher info
        placement_cache = {}
        try:
            if placements_col:
                for p in placements_col.find({}, {'placementIdentifier': 1, 'publisherId': 1, 'offerwallTitle': 1, 'publisher_name': 1}):
                    pid = p.get('placementIdentifier', '')
                    if pid:
                        placement_cache[pid] = {
                            'placement_id': pid,
                            'publisher_id': str(p.get('publisherId', p.get('publisher_id', ''))),
                            'publisher_name': p.get('publisher_name', p.get('offerwallTitle', 'Unknown')),
                            'iframe_title': p.get('offerwallTitle', pid)
                        }
        except Exception as pe:
            logger.warning(f"Could not load placement cache: {pe}")

        # 1. Pull clicks from BOTH collections (detailed = newer data, clicks = older)
        if status_filter in ('all', 'clicked', 'pending'):
            try:
                click_query = {}
                if status_filter == 'clicked':
                    click_query['status'] = {'$in': ['clicked', 'valid', None]}
                elif status_filter == 'pending':
                    click_query['status'] = 'pending'
                if search:
                    click_query['$or'] = [
                        {'offer_name': {'$regex': search, '$options': 'i'}},
                        {'data.offer_name': {'$regex': search, '$options': 'i'}},
                        {'user_id': {'$regex': search, '$options': 'i'}},
                        {'placement_id': {'$regex': search, '$options': 'i'}}
                    ]

                def process_click_doc(c, source='clicks'):
                    pid = c.get('placement_id', '')
                    pinfo = placement_cache.get(pid, {})
                    ts = c.get('timestamp') or c.get('started_at') or c.get('click_timestamp')
                    raw_status = c.get('status') or ''
                    display_status = 'pending' if raw_status == 'pending' else 'clicked'
                    offer_name = (c.get('offer_name') or 
                                  c.get('data', {}).get('offer_name') or
                                  c.get('click_data', {}).get('offer_name', 'Unknown Offer'))
                    return {
                        'id': str(c.get('_id', '')),
                        'offer_name': offer_name,
                        'offer_id': c.get('offer_id', ''),
                        'user_id': c.get('user_id', ''),
                        'placement_id': pid,
                        'publisher_id': pinfo.get('publisher_id', c.get('publisher_id', '')),
                        'publisher_name': pinfo.get('publisher_name', ''),
                        'iframe_title': pinfo.get('iframe_title', pid),
                        'status': display_status,
                        'reward': 0,
                        'timestamp': ts.isoformat() if isinstance(ts, datetime) else str(ts or ''),
                        'user_agent': (c.get('user_agent', '') or 
                                       c.get('data', {}).get('user_agent', '') or
                                       c.get('click_data', {}).get('user_agent', '')),
                        '_source': source,
                    }

                seen_ids = set()
                raw_clicks = []

                # Try detailed collection first (newer data — June 9+)
                if clicks_detailed_col:
                    det_query = dict(click_query)
                    det_query.update(date_filter)  # Only last 90 days
                    if search:
                        det_query['$or'] = [
                            {'offer_name': {'$regex': search, '$options': 'i'}},
                            {'click_data.offer_name': {'$regex': search, '$options': 'i'}},
                            {'user_id': {'$regex': search, '$options': 'i'}},
                            {'placement_id': {'$regex': search, '$options': 'i'}}
                        ]
                    for c in clicks_detailed_col.find(det_query).sort('timestamp', -1).limit(500):
                        doc = process_click_doc(c, 'detailed')
                        dedup_key = f"{c.get('offer_id', '')}_{c.get('user_id', '')}_{doc['timestamp'][:16]}"
                        if dedup_key not in seen_ids:
                            seen_ids.add(dedup_key)
                            raw_clicks.append(doc)

                # Also pull from legacy collection (older data — before June 9)
                if clicks_col:
                    legacy_query = dict(click_query)
                    legacy_query.update(date_filter)  # Only last 90 days
                    for c in clicks_col.find(legacy_query).sort('timestamp', -1).limit(500):
                        doc = process_click_doc(c, 'clicks')
                        dedup_key = f"{c.get('offer_id', '')}_{c.get('user_id', '')}_{doc['timestamp'][:16]}"
                        if dedup_key not in seen_ids:
                            seen_ids.add(dedup_key)
                            raw_clicks.append(doc)

                # Sort merged results by timestamp descending
                raw_clicks.sort(key=lambda x: x['timestamp'], reverse=True)
                logs.extend(raw_clicks[:500])

            except Exception as ce:
                logger.warning(f"Error fetching clicks: {ce}")

        # 2. Pull conversions (status: completed or pending)
        if status_filter in ('all', 'completed', 'pending'):
            try:
                conv_query = {}
                if status_filter == 'completed':
                    conv_query['status'] = {'$in': ['credited', 'approved', 'completed']}
                elif status_filter == 'pending':
                    conv_query['status'] = {'$in': ['pending', 'processing']}
                if search:
                    conv_query['$or'] = [
                        {'offer_name': {'$regex': search, '$options': 'i'}},
                        {'user_id': {'$regex': search, '$options': 'i'}},
                        {'placement_id': {'$regex': search, '$options': 'i'}}
                    ]

                for c in conversions_col.find({**conv_query, **date_filter}).sort('timestamp', -1).limit(500):
                    pid = c.get('placement_id', '')
                    pinfo = placement_cache.get(pid, {})
                    ts = c.get('timestamp')
                    raw_status = c.get('status', 'pending')
                    display_status = 'completed' if raw_status in ('credited', 'approved', 'completed') else 'pending'
                    logs.append({
                        'id': str(c.get('_id', '')),
                        'offer_name': c.get('offer_name', 'Unknown Offer'),
                        'offer_id': c.get('offer_id', ''),
                        'user_id': c.get('user_id', ''),
                        'placement_id': pid,
                        'publisher_id': pinfo.get('publisher_id', c.get('publisher_id', '')),
                        'publisher_name': pinfo.get('publisher_name', ''),
                        'iframe_title': pinfo.get('iframe_title', pid),
                        'status': display_status,
                        'reward': c.get('payout_amount', c.get('reward', 0)),
                        'timestamp': ts.isoformat() if isinstance(ts, datetime) else str(ts or ''),
                        'user_agent': c.get('user_agent', ''),
                    })
            except Exception as cve:
                logger.warning(f"Error fetching conversions: {cve}")

        # Sort all by timestamp desc, then paginate
        logs.sort(key=lambda x: x.get('timestamp', ''), reverse=True)
        total = len(logs)
        skip = (page - 1) * per_page
        paginated = logs[skip:skip + per_page]

        # Summary counts
        all_statuses = [l['status'] for l in logs]
        summary = {
            'total': total,
            'clicked': sum(1 for s in all_statuses if s == 'clicked'),
            'pending': sum(1 for s in all_statuses if s == 'pending'),
            'completed': sum(1 for s in all_statuses if s == 'completed'),
        }

        return jsonify({
            'logs': paginated,
            'summary': summary,
            'pagination': {
                'page': page,
                'per_page': per_page,
                'total': total,
                'pages': max(1, (total + per_page - 1) // per_page)
            }
        }), 200

    except Exception as e:
        logger.error(f"Error getting tracking logs: {e}", exc_info=True)
        return jsonify({'error': 'Internal server error'}), 500


# ===================== PRICE BOOST ENDPOINTS =====================

@admin_offerwall_management_bp.route('/offerwall-management/price-boost', methods=['POST'])
@token_required
def apply_price_boost():
    """Apply a time-limited price boost to selected offers."""
    try:
        current_user = request.current_user
        if current_user.get('role') != 'admin':
            return jsonify({'error': 'Admin access required'}), 403

        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400

        offer_ids = data.get('offer_ids', [])
        percentage = data.get('percentage', 10)
        direction = data.get('direction', 'increase')  # 'increase' or 'decrease'
        duration_hours = data.get('duration_hours', 0)
        duration_minutes = data.get('duration_minutes', 0)

        # At least one of hours/minutes must be provided
        if not duration_hours and not duration_minutes:
            duration_hours = 24  # Default to 24 hours if nothing specified

        if not offer_ids:
            return jsonify({'error': 'offer_ids required'}), 400
        if direction not in ('increase', 'decrease'):
            return jsonify({'error': 'direction must be increase or decrease'}), 400
        if not isinstance(percentage, (int, float)) or percentage <= 0 or percentage > 100:
            return jsonify({'error': 'percentage must be between 1 and 100'}), 400

        from services.price_boost_service import price_boost_service
        result = price_boost_service.apply_boost(offer_ids, percentage, direction, duration_hours, duration_minutes)

        return jsonify({
            'message': f'Price boost applied to {result["success"]} offers',
            'success_count': result['success'],
            'errors': result['errors'],
            'expires_at': result['expires_at']
        }), 200

    except Exception as e:
        logger.error(f"Error applying price boost: {e}")
        return jsonify({'error': 'Failed to apply price boost'}), 500


@admin_offerwall_management_bp.route('/offerwall-management/price-boost/active', methods=['GET'])
@token_required
def get_active_boosts():
    """Get all offers with currently active price boosts."""
    try:
        current_user = request.current_user
        if current_user.get('role') != 'admin':
            return jsonify({'error': 'Admin access required'}), 403

        from services.price_boost_service import price_boost_service
        boosted = price_boost_service.get_boosted_offers()

        return jsonify({'boosted_offers': boosted, 'count': len(boosted)}), 200

    except Exception as e:
        logger.error(f"Error getting active boosts: {e}")
        return jsonify({'error': 'Failed to get active boosts'}), 500


@admin_offerwall_management_bp.route('/offerwall-management/price-boost/remove', methods=['POST'])
@token_required
def remove_price_boost():
    """Remove active price boost from selected offers (revert immediately)."""
    try:
        current_user = request.current_user
        if current_user.get('role') != 'admin':
            return jsonify({'error': 'Admin access required'}), 403

        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400

        offer_ids = data.get('offer_ids', [])
        if not offer_ids:
            return jsonify({'error': 'offer_ids required'}), 400

        offers_col = get_collection('offers')
        if offers_col is None:
            return jsonify({'error': 'Database connection failed'}), 500

        reverted = 0
        for offer_id in offer_ids:
            offer = offers_col.find_one({'offer_id': offer_id}, {'price_boost': 1})
            if offer and offer.get('price_boost'):
                original = offer['price_boost'].get('original_payout')
                update = {'$unset': {'price_boost': ''}}
                if original is not None:
                    update['$set'] = {'publisher_payout_override': original}
                offers_col.update_one({'offer_id': offer_id}, update)
                reverted += 1

        return jsonify({'message': f'Removed boost from {reverted} offers', 'reverted': reverted}), 200

    except Exception as e:
        logger.error(f"Error removing price boost: {e}")
        return jsonify({'error': 'Failed to remove price boost'}), 500


# ===================== POSITION ORDERING ENDPOINTS =====================

@admin_offerwall_management_bp.route('/offerwall-management/set-positions', methods=['POST'])
@token_required
def set_positions():
    """Set manual position ordering for offers on the offerwall."""
    try:
        current_user = request.current_user
        if current_user.get('role') != 'admin':
            return jsonify({'error': 'Admin access required'}), 403

        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400

        positions = data.get('positions', [])
        if not positions:
            return jsonify({'error': 'positions array required'}), 400

        offers_col = get_collection('offers')
        if offers_col is None:
            return jsonify({'error': 'Database connection failed'}), 500

        updated = 0
        for item in positions:
            offer_id = item.get('offer_id')
            position = item.get('position')
            if offer_id and position is not None:
                offers_col.update_one(
                    {'offer_id': offer_id},
                    {'$set': {'offerwall_position': int(position)}}
                )
                updated += 1

        return jsonify({'message': f'Updated positions for {updated} offers', 'updated': updated}), 200

    except Exception as e:
        logger.error(f"Error setting positions: {e}")
        return jsonify({'error': 'Failed to set positions'}), 500


@admin_offerwall_management_bp.route('/offerwall-management/remove-position', methods=['POST'])
@token_required
def remove_position():
    """Remove position ordering from an offer (revert to default sort)."""
    try:
        current_user = request.current_user
        if current_user.get('role') != 'admin':
            return jsonify({'error': 'Admin access required'}), 403

        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400

        offer_ids = data.get('offer_ids', [])
        if not offer_ids:
            return jsonify({'error': 'offer_ids required'}), 400

        offers_col = get_collection('offers')
        if offers_col is None:
            return jsonify({'error': 'Database connection failed'}), 500

        offers_col.update_many(
            {'offer_id': {'$in': offer_ids}},
            {'$unset': {'offerwall_position': ''}}
        )

        return jsonify({'message': f'Removed positions from {len(offer_ids)} offers'}), 200

    except Exception as e:
        logger.error(f"Error removing positions: {e}")
        return jsonify({'error': 'Failed to remove positions'}), 500


# ===================== BULK REMOVE FROM OFFERWALL =====================

@admin_offerwall_management_bp.route('/offerwall-management/bulk-remove', methods=['POST'])
@token_required
def bulk_remove_from_offerwall():
    """Bulk remove offers from the offerwall by setting show_in_offerwall: false."""
    try:
        current_user = request.current_user
        if current_user.get('role') != 'admin':
            return jsonify({'error': 'Admin access required'}), 403

        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400

        offer_ids = data.get('offer_ids', [])
        if not offer_ids:
            return jsonify({'error': 'offer_ids required'}), 400

        offers_col = get_collection('offers')
        if offers_col is None:
            return jsonify({'error': 'Database connection failed'}), 500

        # Set show_in_offerwall: false on selected offers
        result = offers_col.update_many(
            {'offer_id': {'$in': offer_ids}},
            {'$set': {'show_in_offerwall': False}}
        )

        # Also add them to hidden_offers in settings for the admin view
        settings_col = get_collection('offerwall_settings')
        if settings_col:
            settings_col.update_one(
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

        return jsonify({
            'message': f'Removed {result.modified_count} offers from offerwall',
            'removed_count': result.modified_count
        }), 200

    except Exception as e:
        logger.error(f"Error bulk removing offers: {e}")
        return jsonify({'error': 'Failed to remove offers from offerwall'}), 500


# ===================== AI DESCRIPTION REFINER =====================

@admin_offerwall_management_bp.route('/offerwall-management/refine-description', methods=['POST'])
@token_required
def refine_offer_description_endpoint():
    """
    AI-powered description refiner for a single offer.
    Sends the raw description to Groq, which parses and structures:
    - event_flow: first-line subtitle (e.g. "Register → Deposit → Trade")
    - steps: detailed step list
    - countries: extracted country codes from description
    - restrictions: rules/limitations
    - difficulty: Easy/Medium/Hard
    - estimated_time
    Admin can preview the result before saving.
    """
    try:
        current_user = request.current_user
        if current_user.get('role') != 'admin':
            return jsonify({'error': 'Admin access required'}), 403

        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400

        offer_id = data.get('offer_id')
        if not offer_id:
            return jsonify({'error': 'offer_id is required'}), 400

        offers_col = get_collection('offers')
        if offers_col is None:
            return jsonify({'error': 'Database connection failed'}), 500

        offer = offers_col.find_one({'offer_id': offer_id})
        if not offer:
            return jsonify({'error': 'Offer not found'}), 404

        name = offer.get('name', '')
        description = offer.get('description', '')
        payout = float(offer.get('payout', 0) or 0)
        payout_type = offer.get('payout_type', 'cpa')
        existing_countries = offer.get('countries', []) or offer.get('allowed_countries', []) or []

        if not description or len(description.strip()) < 5:
            return jsonify({'error': 'Offer has no description to refine'}), 400

        # Call Groq AI
        from config import Config
        from groq import Groq
        import json as json_module

        keys = Config.get_groq_api_keys()
        api_key = keys[0] if keys else Config.GROQ_API_KEY
        if not api_key:
            return jsonify({'error': 'GROQ_API_KEY not configured'}), 500

        client = Groq(api_key=api_key)

        prompt = f"""You are an offer description refiner for an affiliate marketing platform.
Given a raw offer description (often messy with campaign/tracking data), produce a clean structured JSON output.

RULES:
- Write for END USERS who will complete the offer (not advertisers)
- Keep it simple, friendly, professional
- "event_flow" is a SHORT subtitle showing the conversion flow, e.g. "Register → Deposit $25 → Get Bonus" or "Install → Open App → Complete Tutorial". Max 60 chars.
- "steps" should list the CONVERSION EVENTS (what actions trigger payout), not generic instructions. E.g. "Registration", "First Deposit", "App Activation" — not "Sign up for the app".
- Extract COUNTRY CODES (ISO 2-letter) mentioned in the description (e.g. US, UK, CA, DE, AU). Look for country names, GEO mentions, geo-targeting info. Return as array of uppercase 2-letter codes.
- Extract any restrictions (device, VPN, new users only, age, etc.)
- Estimate difficulty and time based on the conversion events
- If the description mentions multiple payout levels/events, extract them into payout_levels

OFFER NAME: {name}
OFFER PAYOUT: ${payout} ({payout_type})
RAW DESCRIPTION:
{description}

Return ONLY valid JSON (no markdown, no explanation):
{{
  "event_flow": "Short flow subtitle max 60 chars",
  "summary": "1-2 sentence user-friendly description",
  "steps": ["Event 1: Registration", "Event 2: First Deposit $25"],
  "countries": ["US", "UK"],
  "payout_levels": [{{"event": "Event Name", "payout": "$X.XX"}}],
  "restrictions": ["restriction 1", "restriction 2"],
  "difficulty": "Easy|Medium|Hard",
  "estimated_time": "X min"
}}"""

        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
            max_tokens=800,
            response_format={"type": "json_object"}
        )

        result_text = response.choices[0].message.content.strip()
        result = json_module.loads(result_text)

        # Validate and clean
        refined = {
            "event_flow": str(result.get("event_flow", "")).strip()[:60] or None,
            "summary": str(result.get("summary", "")).strip() or description[:200],
            "steps": result.get("steps", []) if isinstance(result.get("steps"), list) else [],
            "countries": [],
            "payout_levels": [],
            "restrictions": result.get("restrictions", []) if isinstance(result.get("restrictions"), list) else [],
            "difficulty": result.get("difficulty", "Medium") if result.get("difficulty") in ("Easy", "Medium", "Hard") else "Medium",
            "estimated_time": str(result.get("estimated_time", "5 min")).strip()
        }

        # Validate countries - must be 2-letter uppercase codes
        raw_countries = result.get("countries", [])
        if isinstance(raw_countries, list):
            valid_countries = []
            for c in raw_countries:
                code = str(c).strip().upper()
                if len(code) == 2 and code.isalpha():
                    valid_countries.append(code)
            refined["countries"] = valid_countries

        # Validate payout_levels
        raw_levels = result.get("payout_levels", [])
        if isinstance(raw_levels, list):
            for level in raw_levels:
                if isinstance(level, dict) and "event" in level and "payout" in level:
                    refined["payout_levels"].append({"event": str(level["event"]), "payout": str(level["payout"])})

        # Include existing countries for comparison
        refined["existing_countries"] = existing_countries

        return jsonify({
            'success': True,
            'refined': refined,
            'offer_id': offer_id,
            'offer_name': name
        }), 200

    except Exception as e:
        logger.error(f"Error refining description: {e}", exc_info=True)
        return jsonify({'error': f'Failed to refine description: {str(e)}'}), 500


@admin_offerwall_management_bp.route('/offerwall-management/save-refined-description', methods=['POST'])
@token_required
def save_refined_description():
    """Save the refined description and optionally update the offer's countries field."""
    try:
        current_user = request.current_user
        if current_user.get('role') != 'admin':
            return jsonify({'error': 'Admin access required'}), 403

        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400

        offer_id = data.get('offer_id')
        refined = data.get('refined')
        update_countries = data.get('update_countries', False)

        if not offer_id or not refined:
            return jsonify({'error': 'offer_id and refined data required'}), 400

        offers_col = get_collection('offers')
        if offers_col is None:
            return jsonify({'error': 'Database connection failed'}), 500

        # Build update
        update_fields = {
            'refined_description': {
                'event_flow': refined.get('event_flow'),
                'summary': refined.get('summary', ''),
                'steps': refined.get('steps', []),
                'payout_levels': refined.get('payout_levels', []),
                'restrictions': refined.get('restrictions', []),
                'difficulty': refined.get('difficulty', 'Medium'),
                'estimated_time': refined.get('estimated_time', '5 min'),
            },
            'refined_at': datetime.utcnow(),
            'refined_via_admin': True  # Marker: refined from admin dialog
        }

        # Optionally update countries from AI extraction
        if update_countries and refined.get('countries'):
            update_fields['countries'] = refined['countries']
            update_fields['allowed_countries'] = refined['countries']

        result = offers_col.update_one(
            {'offer_id': offer_id},
            {'$set': update_fields}
        )

        if result.modified_count == 0:
            return jsonify({'error': 'Offer not found or not modified'}), 404

        return jsonify({
            'success': True,
            'message': 'Refined description saved successfully',
            'countries_updated': update_countries and bool(refined.get('countries'))
        }), 200

    except Exception as e:
        logger.error(f"Error saving refined description: {e}", exc_info=True)
        return jsonify({'error': 'Failed to save refined description'}), 500


@admin_offerwall_management_bp.route('/offerwall-management/remove-refined-description', methods=['POST'])
@token_required
def remove_refined_description():
    """Remove the refined description from an offer."""
    try:
        current_user = request.current_user
        if current_user.get('role') != 'admin':
            return jsonify({'error': 'Admin access required'}), 403

        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400

        offer_id = data.get('offer_id')
        if not offer_id:
            return jsonify({'error': 'offer_id is required'}), 400

        offers_col = get_collection('offers')
        if offers_col is None:
            return jsonify({'error': 'Database connection failed'}), 500

        result = offers_col.update_one(
            {'offer_id': offer_id},
            {'$unset': {'refined_description': '', 'refined_at': ''}}
        )

        if result.modified_count == 0:
            return jsonify({'error': 'Offer not found or has no refined description'}), 404

        return jsonify({'success': True, 'message': 'Refined description removed'}), 200

    except Exception as e:
        logger.error(f"Error removing refined description: {e}", exc_info=True)
        return jsonify({'error': 'Failed to remove refined description'}), 500


@admin_offerwall_management_bp.route('/offerwall-management/get-offer-description', methods=['GET'])
@token_required
def get_offer_description():
    """Get the raw and refined description for an offer (for manual editing)."""
    try:
        current_user = request.current_user
        if current_user.get('role') != 'admin':
            return jsonify({'error': 'Admin access required'}), 403

        offer_id = request.args.get('offer_id')
        if not offer_id:
            return jsonify({'error': 'offer_id is required'}), 400

        offers_col = get_collection('offers')
        if offers_col is None:
            return jsonify({'error': 'Database connection failed'}), 500

        offer = offers_col.find_one(
            {'offer_id': offer_id},
            {'offer_id': 1, 'name': 1, 'description': 1, 'refined_description': 1, 'countries': 1, 'allowed_countries': 1, 'payout': 1, 'payout_type': 1}
        )
        if not offer:
            return jsonify({'error': 'Offer not found'}), 404

        return jsonify({
            'success': True,
            'offer_id': offer.get('offer_id', ''),
            'offer_name': offer.get('name', ''),
            'raw_description': offer.get('description', ''),
            'refined': offer.get('refined_description'),
            'countries': offer.get('countries', []) or offer.get('allowed_countries', []) or [],
        }), 200

    except Exception as e:
        logger.error(f"Error getting offer description: {e}", exc_info=True)
        return jsonify({'error': 'Failed to get offer description'}), 500


@admin_offerwall_management_bp.route('/offerwall-management/hide-by-id', methods=['POST'])
@token_required
def hide_offer_by_id():
    """Force-hide any offer from the offerwall by offer_id, regardless of status."""
    try:
        current_user = request.current_user
        if current_user.get('role') != 'admin':
            return jsonify({'error': 'Admin access required'}), 403

        data = request.get_json()
        offer_id = data.get('offer_id', '').strip()
        if not offer_id:
            return jsonify({'error': 'offer_id is required'}), 400

        offers_col = get_collection('offers')
        if offers_col is None:
            return jsonify({'error': 'Database connection failed'}), 500

        # Try to find by offer_id OR campaign_id (handles network-imported offers)
        offer = offers_col.find_one({'$or': [
            {'offer_id': offer_id},
            {'campaign_id': offer_id}
        ]})

        if not offer:
            return jsonify({'error': f'No offer found with id: {offer_id}'}), 404

        # Hide from offerwall and mark deleted
        result = offers_col.update_one(
            {'_id': offer['_id']},
            {'$set': {
                'show_in_offerwall': False,
                'deleted': True,
                'deleted_at': datetime.utcnow(),
                'deleted_reason': f'Force-hidden by admin (duplicate/cleanup)'
            }}
        )

        # Also add to hidden_offers in settings
        settings_col = get_collection('offerwall_settings')
        if settings_col:
            settings_col.update_one(
                {},
                {'$addToSet': {'hidden_offers': offer_id}},
                upsert=True
            )

        return jsonify({
            'success': True,
            'message': f'Offer {offer_id} hidden from offerwall and deleted',
            'offer_name': offer.get('name', ''),
            'modified': result.modified_count
        }), 200

    except Exception as e:
        logger.error(f"Error hiding offer: {e}", exc_info=True)
        return jsonify({'error': 'Failed to hide offer'}), 500


# ===================== PER-FIELD AI REFINE =====================

FIELD_PROMPTS = {
    'event_flow': """Extract a SHORT conversion flow subtitle from this offer. 
Max 60 chars. Format: "Action → Action → Result" or similar arrow-connected flow.
Examples: "Register → Deposit $25 → Get Bonus", "Install App → Complete Tutorial", "Sign Up → Subscribe"
Return JSON: {{"event_flow": "...flow text..."}}""",

    'summary': """Write a 1-2 sentence user-friendly description of this offer for end users.
Keep it simple, honest, and clear. No hype. Focus on what the user does and what they get.
Return JSON: {{"summary": "...summary text..."}}""",

    'steps': """List the CONVERSION EVENTS (what actions trigger payout) for this offer.
These are milestones, not instructions. E.g. ["Registration", "First Deposit", "App Activation"].
Return JSON: {{"steps": ["Event 1", "Event 2"]}}""",

    'restrictions': """Extract any restrictions or requirements from this offer description.
Look for: device restrictions, VPN bans, new users only, age requirements, geo exclusions.
Return JSON: {{"restrictions": ["restriction 1", "restriction 2"]}}""",

    'difficulty': """Based on this offer's conversion events and requirements, estimate difficulty.
Return ONLY one of: Easy, Medium, Hard.
Return JSON: {{"difficulty": "Easy|Medium|Hard"}}""",

    'estimated_time': """Estimate how long it takes a user to complete this offer.
Examples: "2 min", "5 min", "10-30 min", "1-2 hours".
Return JSON: {{"estimated_time": "X min"}}""",

    'countries': """Extract COUNTRY CODES (ISO 2-letter uppercase) mentioned in this offer description.
Look for: country names, GEO mentions, geo-targeting, allowed/excluded countries.
Return JSON: {{"countries": ["US", "UK", "CA"]}}""",
}


@admin_offerwall_management_bp.route('/offerwall-management/refine-field', methods=['POST'])
@token_required
def refine_single_field():
    """
    Regenerate a single field of the refined description using Groq AI.
    field can be: event_flow, summary, steps, restrictions, difficulty, estimated_time, countries
    """
    try:
        current_user = request.current_user
        if current_user.get('role') != 'admin':
            return jsonify({'error': 'Admin access required'}), 403

        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400

        offer_id = data.get('offer_id')
        field = data.get('field')

        if not offer_id:
            return jsonify({'error': 'offer_id is required'}), 400
        if not field or field not in FIELD_PROMPTS:
            return jsonify({'error': f'field must be one of: {", ".join(FIELD_PROMPTS.keys())}'}), 400

        offers_col = get_collection('offers')
        if offers_col is None:
            return jsonify({'error': 'Database connection failed'}), 500

        offer = offers_col.find_one({'offer_id': offer_id})
        if not offer:
            return jsonify({'error': 'Offer not found'}), 404

        name = offer.get('name', '')
        description = offer.get('description', '')
        payout = float(offer.get('payout', 0) or 0)

        if not description and not name:
            return jsonify({'error': 'Offer has no content to refine'}), 400

        from config import Config
        from groq import Groq
        import json as json_module

        keys = Config.get_groq_api_keys()
        api_key = keys[0] if keys else Config.GROQ_API_KEY
        if not api_key:
            return jsonify({'error': 'GROQ_API_KEY not configured'}), 500

        client = Groq(api_key=api_key)

        system_prompt = FIELD_PROMPTS[field]
        user_content = f"OFFER NAME: {name}\nOFFER PAYOUT: ${payout}\nRAW DESCRIPTION:\n{description}"

        response = client.chat.completions.create(
            model="llama-3.1-8b-instant",  # Faster model for single-field
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content}
            ],
            temperature=0.3,
            max_tokens=300,
            response_format={"type": "json_object"}
        )

        result = json_module.loads(response.choices[0].message.content.strip())

        # Validate and return the specific field
        value = result.get(field)

        # Field-specific validation
        if field == 'event_flow' and value:
            value = str(value).strip()[:60] or None
        elif field == 'difficulty':
            value = value if value in ('Easy', 'Medium', 'Hard') else 'Medium'
        elif field in ('steps', 'restrictions', 'countries'):
            value = value if isinstance(value, list) else []
            if field == 'countries':
                value = [str(c).strip().upper() for c in value if len(str(c).strip()) == 2 and str(c).strip().isalpha()]
        elif field == 'summary':
            value = str(value).strip() if value else ''
        elif field == 'estimated_time':
            value = str(value).strip() if value else '5 min'

        return jsonify({
            'success': True,
            'field': field,
            'value': value,
            'offer_id': offer_id
        }), 200

    except Exception as e:
        logger.error(f"Error refining field {field}: {e}", exc_info=True)
        return jsonify({'error': f'Failed to refine field: {str(e)}'}), 500


@admin_offerwall_management_bp.route('/offerwall-management/update-offer-image', methods=['POST'])
@token_required
def update_offer_image():
    """Update the image URL for an offer directly from Offerwall Manager."""
    try:
        current_user = request.current_user
        if current_user.get('role') != 'admin':
            return jsonify({'error': 'Admin access required'}), 403

        data = request.get_json()
        offer_id = data.get('offer_id', '').strip()
        image_url = data.get('image_url', '').strip()

        if not offer_id or not image_url:
            return jsonify({'error': 'offer_id and image_url required'}), 400

        offers_col = get_collection('offers')
        if offers_col is None:
            return jsonify({'error': 'Database connection failed'}), 500

        result = offers_col.update_one(
            {'offer_id': offer_id},
            {'$set': {'image_url': image_url, 'updated_at': datetime.utcnow()}}
        )

        if result.modified_count == 0:
            return jsonify({'error': 'Offer not found'}), 404

        return jsonify({'success': True, 'message': 'Image updated'}), 200

    except Exception as e:
        logger.error(f"Error updating offer image: {e}", exc_info=True)
        return jsonify({'error': 'Failed to update image'}), 500


@admin_offerwall_management_bp.route('/offerwall-management/rename-offer', methods=['POST'])
@token_required
def rename_offer_from_manager():
    """Rename an offer directly from the Offerwall Manager."""
    try:
        current_user = request.current_user
        if current_user.get('role') != 'admin':
            return jsonify({'error': 'Admin access required'}), 403

        data = request.get_json()
        offer_id = data.get('offer_id', '').strip()
        new_name = data.get('new_name', '').strip()
        original_name = data.get('original_name', '').strip()

        if not offer_id or not new_name:
            return jsonify({'error': 'offer_id and new_name required'}), 400

        offers_col = get_collection('offers')
        if offers_col is None:
            return jsonify({'error': 'Database connection failed'}), 500

        result = offers_col.update_one(
            {'offer_id': offer_id},
            {'$set': {
                'name': new_name,
                'original_name': original_name or None,
                'renamed_at': datetime.utcnow(),
                'updated_at': datetime.utcnow(),
            }}
        )

        if result.modified_count == 0:
            return jsonify({'error': 'Offer not found'}), 404

        return jsonify({'success': True, 'message': 'Offer renamed'}), 200

    except Exception as e:
        logger.error(f"Error renaming offer: {e}", exc_info=True)
        return jsonify({'error': 'Failed to rename offer'}), 500
