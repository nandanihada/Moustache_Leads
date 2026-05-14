"""
Redirect Router API
Provides A/B testing, conditional routing, and traffic splitting for offer clicks.
Admin can create redirect rules that route users based on geo, device, time, and weights.
"""

from flask import Blueprint, request, jsonify, redirect as flask_redirect, render_template_string
from utils.auth import token_required
from database import db_instance
from datetime import datetime, timedelta
from bson import ObjectId
import logging
import secrets
import random
import hashlib

logger = logging.getLogger(__name__)

redirect_router_bp = Blueprint('redirect_router', __name__)


def get_collection(name):
    """Get a MongoDB collection by name."""
    return db_instance.get_collection(name)


def generate_route_id():
    """Generate a unique route ID."""
    return f"RR-{secrets.token_hex(4).upper()}"


def generate_click_id():
    """Generate a unique click ID for router tracking."""
    return f"RRC-{secrets.token_hex(6).upper()}"


# ==================== ADMIN CRUD ENDPOINTS ====================

@redirect_router_bp.route('/api/admin/redirect-router/routes', methods=['GET'])
@token_required
def get_routes():
    """Get all redirect routes with optional filtering."""
    try:
        current_user = request.current_user
        if current_user.get('role') not in ('admin', 'subadmin'):
            return jsonify({'error': 'Admin access required'}), 403

        collection = get_collection('redirect_routes')
        if collection is None:
            return jsonify({'error': 'Database connection failed'}), 500

        # Query params
        status = request.args.get('status', '')
        search = request.args.get('search', '')
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 50))

        query = {}
        if status:
            query['status'] = status
        if search:
            query['$or'] = [
                {'name': {'$regex': search, '$options': 'i'}},
                {'route_id': {'$regex': search, '$options': 'i'}},
                {'offer_id': {'$regex': search, '$options': 'i'}}
            ]

        total = collection.count_documents(query)
        skip = (page - 1) * per_page

        routes = list(collection.find(query).sort('created_at', -1).skip(skip).limit(per_page))

        # Serialize
        serialized = []
        for route in routes:
            serialized.append({
                'route_id': route.get('route_id', ''),
                'name': route.get('name', ''),
                'description': route.get('description', ''),
                'offer_id': route.get('offer_id', ''),
                'status': route.get('status', 'active'),
                'conditions': route.get('conditions', {}),
                'destinations': route.get('destinations', []),
                'fallback_url': route.get('fallback_url', ''),
                'stats': route.get('stats', {'clicks': 0, 'conversions': 0}),
                'created_at': route.get('created_at', '').isoformat() + 'Z' if isinstance(route.get('created_at'), datetime) else str(route.get('created_at', '')),
                'updated_at': route.get('updated_at', '').isoformat() + 'Z' if isinstance(route.get('updated_at'), datetime) else str(route.get('updated_at', '')),
                'created_by': route.get('created_by', ''),
            })

        return jsonify({
            'routes': serialized,
            'pagination': {
                'page': page,
                'per_page': per_page,
                'total': total,
                'pages': (total + per_page - 1) // per_page if total > 0 else 1
            }
        }), 200

    except Exception as e:
        logger.error(f"Error getting redirect routes: {e}")
        return jsonify({'error': 'Failed to fetch routes'}), 500


@redirect_router_bp.route('/api/admin/redirect-router/routes', methods=['POST'])
@token_required
def create_route():
    """Create a new redirect route."""
    try:
        current_user = request.current_user
        if current_user.get('role') not in ('admin', 'subadmin'):
            return jsonify({'error': 'Admin access required'}), 403

        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400

        name = data.get('name', '').strip()
        if not name:
            return jsonify({'error': 'Route name is required'}), 400

        destinations = data.get('destinations', [])
        if not destinations:
            return jsonify({'error': 'At least one destination is required'}), 400

        # Validate destinations have URLs and weights
        total_weight = 0
        for dest in destinations:
            if not dest.get('url', '').strip():
                return jsonify({'error': 'Each destination must have a URL'}), 400
            weight = dest.get('weight', 0)
            if weight < 0 or weight > 100:
                return jsonify({'error': 'Weights must be between 0 and 100'}), 400
            total_weight += weight

        # Auto-normalize weights if they don't sum to 100
        if total_weight != 100 and total_weight > 0:
            for dest in destinations:
                dest['weight'] = round((dest.get('weight', 0) / total_weight) * 100, 1)

        collection = get_collection('redirect_routes')
        if collection is None:
            return jsonify({'error': 'Database connection failed'}), 500

        route_id = generate_route_id()

        route_doc = {
            'route_id': route_id,
            'name': name,
            'description': data.get('description', ''),
            'offer_id': data.get('offer_id', ''),
            'status': data.get('status', 'active'),
            'conditions': {
                'geo': data.get('conditions', {}).get('geo', []),
                'devices': data.get('conditions', {}).get('devices', []),
                'time_range': data.get('conditions', {}).get('time_range', {}),
                'day_of_week': data.get('conditions', {}).get('day_of_week', []),
                'user_agent_contains': data.get('conditions', {}).get('user_agent_contains', ''),
            },
            'destinations': destinations,
            'fallback_url': data.get('fallback_url', ''),
            'stats': {
                'clicks': 0,
                'conversions': 0,
                'last_click_at': None,
                'destination_stats': {str(i): {'clicks': 0, 'conversions': 0} for i in range(len(destinations))}
            },
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow(),
            'created_by': str(current_user.get('_id', current_user.get('user_id', ''))),
        }

        collection.insert_one(route_doc)
        logger.info(f"✅ Created redirect route: {route_id} ({name})")

        return jsonify({
            'success': True,
            'route_id': route_id,
            'message': f'Route "{name}" created successfully'
        }), 201

    except Exception as e:
        logger.error(f"Error creating redirect route: {e}")
        return jsonify({'error': 'Failed to create route'}), 500


@redirect_router_bp.route('/api/admin/redirect-router/routes/<route_id>', methods=['GET'])
@token_required
def get_route(route_id):
    """Get a single redirect route by ID."""
    try:
        current_user = request.current_user
        if current_user.get('role') not in ('admin', 'subadmin'):
            return jsonify({'error': 'Admin access required'}), 403

        collection = get_collection('redirect_routes')
        if collection is None:
            return jsonify({'error': 'Database connection failed'}), 500

        route = collection.find_one({'route_id': route_id})
        if not route:
            return jsonify({'error': 'Route not found'}), 404

        serialized = {
            'route_id': route.get('route_id', ''),
            'name': route.get('name', ''),
            'description': route.get('description', ''),
            'offer_id': route.get('offer_id', ''),
            'status': route.get('status', 'active'),
            'conditions': route.get('conditions', {}),
            'destinations': route.get('destinations', []),
            'fallback_url': route.get('fallback_url', ''),
            'stats': route.get('stats', {'clicks': 0, 'conversions': 0}),
            'created_at': route.get('created_at', '').isoformat() + 'Z' if isinstance(route.get('created_at'), datetime) else str(route.get('created_at', '')),
            'updated_at': route.get('updated_at', '').isoformat() + 'Z' if isinstance(route.get('updated_at'), datetime) else str(route.get('updated_at', '')),
            'created_by': route.get('created_by', ''),
        }

        return jsonify({'route': serialized}), 200

    except Exception as e:
        logger.error(f"Error getting route {route_id}: {e}")
        return jsonify({'error': 'Failed to fetch route'}), 500


@redirect_router_bp.route('/api/admin/redirect-router/routes/<route_id>', methods=['PUT'])
@token_required
def update_route(route_id):
    """Update an existing redirect route."""
    try:
        current_user = request.current_user
        if current_user.get('role') not in ('admin', 'subadmin'):
            return jsonify({'error': 'Admin access required'}), 403

        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400

        collection = get_collection('redirect_routes')
        if collection is None:
            return jsonify({'error': 'Database connection failed'}), 500

        existing = collection.find_one({'route_id': route_id})
        if not existing:
            return jsonify({'error': 'Route not found'}), 404

        # Build update
        update_fields = {'updated_at': datetime.utcnow()}

        allowed_fields = ['name', 'description', 'offer_id', 'status', 'conditions', 'destinations', 'fallback_url']
        for field in allowed_fields:
            if field in data:
                update_fields[field] = data[field]

        # Validate destinations if provided
        if 'destinations' in update_fields:
            destinations = update_fields['destinations']
            if not destinations:
                return jsonify({'error': 'At least one destination is required'}), 400
            total_weight = sum(d.get('weight', 0) for d in destinations)
            if total_weight != 100 and total_weight > 0:
                for dest in destinations:
                    dest['weight'] = round((dest.get('weight', 0) / total_weight) * 100, 1)
            # Reset destination stats for new count
            update_fields['stats.destination_stats'] = {str(i): {'clicks': 0, 'conversions': 0} for i in range(len(destinations))}

        collection.update_one({'route_id': route_id}, {'$set': update_fields})
        logger.info(f"✅ Updated redirect route: {route_id}")

        return jsonify({'success': True, 'message': 'Route updated successfully'}), 200

    except Exception as e:
        logger.error(f"Error updating route {route_id}: {e}")
        return jsonify({'error': 'Failed to update route'}), 500


@redirect_router_bp.route('/api/admin/redirect-router/routes/<route_id>', methods=['DELETE'])
@token_required
def delete_route(route_id):
    """Delete a redirect route."""
    try:
        current_user = request.current_user
        if current_user.get('role') not in ('admin', 'subadmin'):
            return jsonify({'error': 'Admin access required'}), 403

        collection = get_collection('redirect_routes')
        if collection is None:
            return jsonify({'error': 'Database connection failed'}), 500

        result = collection.delete_one({'route_id': route_id})
        if result.deleted_count == 0:
            return jsonify({'error': 'Route not found'}), 404

        logger.info(f"🗑️ Deleted redirect route: {route_id}")
        return jsonify({'success': True, 'message': 'Route deleted successfully'}), 200

    except Exception as e:
        logger.error(f"Error deleting route {route_id}: {e}")
        return jsonify({'error': 'Failed to delete route'}), 500


# ==================== STATS ENDPOINTS ====================

@redirect_router_bp.route('/api/admin/redirect-router/stats', methods=['GET'])
@token_required
def get_router_stats():
    """Get overall redirect router statistics."""
    try:
        current_user = request.current_user
        if current_user.get('role') not in ('admin', 'subadmin'):
            return jsonify({'error': 'Admin access required'}), 403

        routes_col = get_collection('redirect_routes')
        clicks_col = get_collection('redirect_router_clicks')

        if routes_col is None:
            return jsonify({'error': 'Database connection failed'}), 500

        total_routes = routes_col.count_documents({})
        active_routes = routes_col.count_documents({'status': 'active'})

        # Get click stats for last 24h and 7d
        now = datetime.utcnow()
        clicks_24h = 0
        clicks_7d = 0

        if clicks_col is not None:
            clicks_24h = clicks_col.count_documents({'timestamp': {'$gte': now - timedelta(hours=24)}})
            clicks_7d = clicks_col.count_documents({'timestamp': {'$gte': now - timedelta(days=7)}})

        return jsonify({
            'stats': {
                'total_routes': total_routes,
                'active_routes': active_routes,
                'clicks_24h': clicks_24h,
                'clicks_7d': clicks_7d,
            }
        }), 200

    except Exception as e:
        logger.error(f"Error getting router stats: {e}")
        return jsonify({'error': 'Failed to fetch stats'}), 500


@redirect_router_bp.route('/api/admin/redirect-router/routes/<route_id>/stats', methods=['GET'])
@token_required
def get_route_stats(route_id):
    """Get detailed stats for a specific route including per-destination breakdown."""
    try:
        current_user = request.current_user
        if current_user.get('role') not in ('admin', 'subadmin'):
            return jsonify({'error': 'Admin access required'}), 403

        routes_col = get_collection('redirect_routes')
        clicks_col = get_collection('redirect_router_clicks')

        if routes_col is None:
            return jsonify({'error': 'Database connection failed'}), 500

        route = routes_col.find_one({'route_id': route_id})
        if not route:
            return jsonify({'error': 'Route not found'}), 404

        # Get time range
        days = int(request.args.get('days', 7))
        since = datetime.utcnow() - timedelta(days=days)

        stats = {
            'route_id': route_id,
            'total_clicks': route.get('stats', {}).get('clicks', 0),
            'total_conversions': route.get('stats', {}).get('conversions', 0),
            'destination_stats': route.get('stats', {}).get('destination_stats', {}),
            'daily_clicks': [],
            'geo_breakdown': {},
            'device_breakdown': {},
        }

        if clicks_col is not None:
            # Daily clicks for chart
            pipeline = [
                {'$match': {'route_id': route_id, 'timestamp': {'$gte': since}}},
                {'$group': {
                    '_id': {'$dateToString': {'format': '%Y-%m-%d', 'date': '$timestamp'}},
                    'clicks': {'$sum': 1}
                }},
                {'$sort': {'_id': 1}}
            ]
            daily = list(clicks_col.aggregate(pipeline))
            stats['daily_clicks'] = [{'date': d['_id'], 'clicks': d['clicks']} for d in daily]

            # Geo breakdown
            geo_pipeline = [
                {'$match': {'route_id': route_id, 'timestamp': {'$gte': since}}},
                {'$group': {'_id': '$country', 'count': {'$sum': 1}}},
                {'$sort': {'count': -1}},
                {'$limit': 20}
            ]
            geo = list(clicks_col.aggregate(geo_pipeline))
            stats['geo_breakdown'] = {g['_id'] or 'Unknown': g['count'] for g in geo}

            # Device breakdown
            device_pipeline = [
                {'$match': {'route_id': route_id, 'timestamp': {'$gte': since}}},
                {'$group': {'_id': '$device_type', 'count': {'$sum': 1}}},
                {'$sort': {'count': -1}}
            ]
            devices = list(clicks_col.aggregate(device_pipeline))
            stats['device_breakdown'] = {d['_id'] or 'Unknown': d['count'] for d in devices}

        return jsonify({'stats': stats}), 200

    except Exception as e:
        logger.error(f"Error getting route stats for {route_id}: {e}")
        return jsonify({'error': 'Failed to fetch route stats'}), 500


# ==================== PUBLIC REDIRECT ENDPOINT ====================

@redirect_router_bp.route('/r/<route_id>', methods=['GET'])
def handle_redirect(route_id):
    """
    Public redirect endpoint. Routes traffic based on conditions and weights.
    URL format: /r/{route_id}?user_id=...&sub1=...
    """
    try:
        routes_col = get_collection('redirect_routes')
        clicks_col = get_collection('redirect_router_clicks')

        if routes_col is None:
            return jsonify({'error': 'Service unavailable'}), 503

        route = routes_col.find_one({'route_id': route_id, 'status': 'active'})
        if not route:
            return jsonify({'error': 'Route not found or inactive'}), 404

        destinations = route.get('destinations', [])
        if not destinations:
            fallback = route.get('fallback_url', '')
            if fallback:
                return flask_redirect(fallback, code=302)
            return jsonify({'error': 'No destinations configured'}), 404

        # Gather context for condition matching
        ip_address = request.headers.get('X-Forwarded-For', request.remote_addr)
        if ip_address and ',' in ip_address:
            ip_address = ip_address.split(',')[0].strip()
        user_agent = request.headers.get('User-Agent', '')
        user_id = request.args.get('user_id', '')
        sub1 = request.args.get('sub1', '')

        # Detect device type
        ua_lower = user_agent.lower()
        if any(m in ua_lower for m in ['mobile', 'android', 'iphone']):
            device_type = 'mobile'
        elif 'tablet' in ua_lower or 'ipad' in ua_lower:
            device_type = 'tablet'
        else:
            device_type = 'desktop'

        # Detect country (best effort)
        country = 'Unknown'
        try:
            from services.ipinfo_service import get_ipinfo_service
            ipinfo_svc = get_ipinfo_service()
            ip_data = ipinfo_svc.lookup_ip(ip_address)
            if ip_data:
                country = ip_data.get('country_code', ip_data.get('country', 'Unknown'))
        except Exception:
            pass

        # Filter destinations by conditions
        conditions = route.get('conditions', {})
        eligible_destinations = _filter_by_conditions(destinations, conditions, country, device_type, user_agent)

        if not eligible_destinations:
            # No destinations match conditions — use fallback
            fallback = route.get('fallback_url', '')
            if fallback:
                _record_click(clicks_col, route_id, -1, 'fallback', ip_address, user_agent, country, device_type, user_id, sub1)
                return flask_redirect(fallback, code=302)
            # Use first destination as ultimate fallback
            eligible_destinations = destinations

        # Select destination by weighted random
        selected_idx, selected_dest = _select_by_weight(eligible_destinations, destinations)

        # Build final URL with macro replacement
        final_url = selected_dest.get('url', '')
        final_url = _replace_url_macros(final_url, user_id, sub1, ip_address, country, device_type)

        # Record click
        click_id = generate_click_id()
        _record_click(clicks_col, route_id, selected_idx, click_id, ip_address, user_agent, country, device_type, user_id, sub1)

        # Update route stats
        routes_col.update_one(
            {'route_id': route_id},
            {
                '$inc': {
                    'stats.clicks': 1,
                    f'stats.destination_stats.{selected_idx}.clicks': 1
                },
                '$set': {'stats.last_click_at': datetime.utcnow()}
            }
        )

        logger.info(f"↗️ Router redirect: {route_id} → dest[{selected_idx}] ({country}/{device_type})")
        return flask_redirect(final_url, code=302)

    except Exception as e:
        logger.error(f"❌ Redirect router error for {route_id}: {e}", exc_info=True)
        # Try fallback
        try:
            route = routes_col.find_one({'route_id': route_id})
            if route and route.get('fallback_url'):
                return flask_redirect(route['fallback_url'], code=302)
        except Exception:
            pass
        return jsonify({'error': 'Routing error'}), 500


# ==================== HELPER FUNCTIONS ====================

def _filter_by_conditions(destinations, conditions, country, device_type, user_agent):
    """Filter destinations based on route conditions."""
    # If no conditions set, all destinations are eligible
    geo_filter = conditions.get('geo', [])
    device_filter = conditions.get('devices', [])
    ua_filter = conditions.get('user_agent_contains', '')
    time_range = conditions.get('time_range', {})
    day_filter = conditions.get('day_of_week', [])

    # Check global conditions (apply to all destinations)
    if geo_filter and country.upper() not in [g.upper() for g in geo_filter]:
        return []  # Country doesn't match — no destinations eligible

    if device_filter and device_type not in [d.lower() for d in device_filter]:
        return []  # Device doesn't match

    if ua_filter and ua_filter.lower() not in user_agent.lower():
        return []  # User agent doesn't match

    # Time range check
    if time_range:
        now = datetime.utcnow()
        start_hour = time_range.get('start_hour')
        end_hour = time_range.get('end_hour')
        if start_hour is not None and end_hour is not None:
            current_hour = now.hour
            if start_hour <= end_hour:
                if not (start_hour <= current_hour < end_hour):
                    return []
            else:  # Wraps midnight
                if not (current_hour >= start_hour or current_hour < end_hour):
                    return []

    # Day of week check
    if day_filter:
        current_day = datetime.utcnow().strftime('%A').lower()
        if current_day not in [d.lower() for d in day_filter]:
            return []

    # Also filter per-destination conditions if they have their own geo/device
    eligible = []
    for dest in destinations:
        dest_geo = dest.get('geo', [])
        dest_devices = dest.get('devices', [])

        if dest_geo and country.upper() not in [g.upper() for g in dest_geo]:
            continue
        if dest_devices and device_type not in [d.lower() for d in dest_devices]:
            continue

        eligible.append(dest)

    return eligible if eligible else destinations


def _select_by_weight(eligible_destinations, all_destinations):
    """Select a destination using weighted random selection. Returns (index_in_all, destination)."""
    if len(eligible_destinations) == 1:
        dest = eligible_destinations[0]
        idx = all_destinations.index(dest) if dest in all_destinations else 0
        return idx, dest

    # Weighted random selection
    weights = [d.get('weight', 0) for d in eligible_destinations]
    total_weight = sum(weights)

    if total_weight <= 0:
        # Equal distribution if no weights
        selected = random.choice(eligible_destinations)
        idx = all_destinations.index(selected) if selected in all_destinations else 0
        return idx, selected

    rand_val = random.uniform(0, total_weight)
    cumulative = 0
    for dest in eligible_destinations:
        cumulative += dest.get('weight', 0)
        if rand_val <= cumulative:
            idx = all_destinations.index(dest) if dest in all_destinations else 0
            return idx, dest

    # Fallback to last
    dest = eligible_destinations[-1]
    idx = all_destinations.index(dest) if dest in all_destinations else len(all_destinations) - 1
    return idx, dest


def _replace_url_macros(url, user_id, sub1, ip_address, country, device_type):
    """Replace macros in destination URL."""
    replacements = {
        '{user_id}': user_id or '',
        '{sub1}': sub1 or '',
        '{ip}': ip_address or '',
        '{country}': country or '',
        '{device}': device_type or '',
        '{timestamp}': str(int(datetime.utcnow().timestamp())),
        '{random}': secrets.token_hex(4),
    }
    for macro, value in replacements.items():
        url = url.replace(macro, value)
    return url


def _record_click(clicks_col, route_id, dest_index, click_id, ip_address, user_agent, country, device_type, user_id, sub1):
    """Record a redirect router click."""
    if clicks_col is None:
        return

    try:
        ua_lower = user_agent.lower()
        browser = 'Unknown'
        if 'chrome' in ua_lower and 'edg' not in ua_lower:
            browser = 'Chrome'
        elif 'firefox' in ua_lower:
            browser = 'Firefox'
        elif 'safari' in ua_lower and 'chrome' not in ua_lower:
            browser = 'Safari'
        elif 'edg' in ua_lower:
            browser = 'Edge'

        os_name = 'Unknown'
        if 'windows' in ua_lower:
            os_name = 'Windows'
        elif 'mac' in ua_lower and 'iphone' not in ua_lower:
            os_name = 'macOS'
        elif 'android' in ua_lower:
            os_name = 'Android'
        elif 'iphone' in ua_lower or 'ipad' in ua_lower:
            os_name = 'iOS'
        elif 'linux' in ua_lower:
            os_name = 'Linux'

        click_doc = {
            'click_id': click_id,
            'route_id': route_id,
            'destination_index': dest_index,
            'ip_address': ip_address,
            'user_agent': user_agent,
            'country': country,
            'device_type': device_type,
            'browser': browser,
            'os': os_name,
            'user_id': user_id,
            'sub1': sub1,
            'timestamp': datetime.utcnow(),
        }

        clicks_col.insert_one(click_doc)
    except Exception as e:
        logger.warning(f"Failed to record router click: {e}")


# ==================== DUPLICATE/CLONE ROUTE ====================

@redirect_router_bp.route('/api/admin/redirect-router/routes/<route_id>/duplicate', methods=['POST'])
@token_required
def duplicate_route(route_id):
    """Duplicate an existing route."""
    try:
        current_user = request.current_user
        if current_user.get('role') not in ('admin', 'subadmin'):
            return jsonify({'error': 'Admin access required'}), 403

        collection = get_collection('redirect_routes')
        if collection is None:
            return jsonify({'error': 'Database connection failed'}), 500

        original = collection.find_one({'route_id': route_id})
        if not original:
            return jsonify({'error': 'Route not found'}), 404

        new_route_id = generate_route_id()
        new_route = {
            'route_id': new_route_id,
            'name': f"{original.get('name', '')} (Copy)",
            'description': original.get('description', ''),
            'offer_id': original.get('offer_id', ''),
            'status': 'paused',
            'conditions': original.get('conditions', {}),
            'destinations': original.get('destinations', []),
            'fallback_url': original.get('fallback_url', ''),
            'stats': {'clicks': 0, 'conversions': 0, 'last_click_at': None, 'destination_stats': {}},
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow(),
            'created_by': str(current_user.get('_id', current_user.get('user_id', ''))),
        }

        collection.insert_one(new_route)
        return jsonify({'success': True, 'route_id': new_route_id, 'message': 'Route duplicated'}), 201

    except Exception as e:
        logger.error(f"Error duplicating route {route_id}: {e}")
        return jsonify({'error': 'Failed to duplicate route'}), 500
