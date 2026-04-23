from flask import Blueprint, jsonify, request
from database import db_instance
from models.user import User
from utils.auth import token_required

offer_access_bp = Blueprint('offer_access', __name__)


def _extract_api_key():
    api_key = request.args.get('api_key', '').strip()
    if not api_key:
        api_key = request.headers.get('X-API-Key', '').strip()
    if not api_key:
        auth_header = request.headers.get('Authorization', '')
        if auth_header.startswith('ApiKey '):
            api_key = auth_header.split(' ', 1)[1].strip()
    return api_key


def _validate_api_key(api_key):
    if not api_key:
        return None, 'API key is missing', 401

    user_model = User()
    user = user_model.find_by_api_key(api_key)
    if not user:
        return None, 'Invalid API key', 401

    if not user.get('is_active', True):
        return None, 'API key owner account is inactive', 403

    if user.get('role') != 'admin' and user.get('account_status', 'pending_approval') != 'approved':
        return None, 'API key owner account is not approved', 403

    user.pop('password', None)
    if '_id' in user and 'id' not in user:
        user['id'] = str(user['_id'])
    return user, None, None


def _normalized_country_code(value: str):
    if not value:
        return None
    value = value.strip().upper()
    return value if len(value) == 2 else None


def _normalize_device_type(device_type: str):
    if not device_type:
        return None
    normalized = device_type.strip().lower()
    if normalized in ['mobile', 'tablet', 'desktop']:
        return normalized
    return None


@offer_access_bp.route('/offers', methods=['GET'])
def get_offers_by_api_key():
    try:
        api_key = _extract_api_key()
        user, error_message, status_code = _validate_api_key(api_key)
        if not user:
            return jsonify({'success': False, 'error': error_message}), status_code

        offers_col = db_instance.get_collection('offers')
        if offers_col is None:
            return jsonify({'success': False, 'error': 'Database connection failed'}), 500

        query = {
            'status': 'active',
            'is_public': True,
            '$and': [
                {'$or': [{'approval_status': 'approved'}, {'approval_status': 'active'}]}, # Compatibility with both naming conventions
                {'$or': [{'deleted': {'$exists': False}}, {'deleted': False}]}
            ]
        }

        category = request.args.get('category', '').strip()
        if category:
            query['category'] = category

        network = request.args.get('network', '').strip()
        if network:
            query['network'] = network

        country_code = _normalized_country_code(request.args.get('country', ''))
        if country_code:
            query['$and'].append({
                '$or': [
                    {'countries': country_code},
                    {'countries': country_code.lower()},
                    {'allowed_countries': country_code},
                    {'allowed_countries': country_code.lower()}
                ]
            })

        device_type = _normalize_device_type(request.args.get('device_type', ''))
        if device_type:
            query['$and'].append({
                '$or': [
                    {'device_targeting': {'$exists': False}},
                    {'device_targeting': 'all'},
                    {'device_targeting': device_type}
                ]
            })

        traffic_source = request.args.get('traffic_source', '').strip()
        if traffic_source:
            normalized_source = traffic_source
            query['$and'].append({
                '$or': [
                    {'allowed_traffic_sources': {'$exists': False}},
                    {'allowed_traffic_sources': []},
                    {'allowed_traffic_sources': normalized_source},
                    {'allowed_traffic_sources': normalized_source.lower()}
                ]
            })
            query['$and'].append({
                'blocked_traffic_sources': {
                    '$nin': [normalized_source, normalized_source.lower()]
                }
            })
            query['$and'].append({
                'disallowed_traffic_sources': {
                    '$nin': [normalized_source, normalized_source.lower()]
                }
            })

        traffic_type = request.args.get('traffic_type', '').strip().lower()
        if traffic_type:
            normalized_type = traffic_type
            query['$and'].append({
                '$or': [
                    {'allowed_traffic_types': {'$exists': False}},
                    {'allowed_traffic_types': []},
                    {'allowed_traffic_types': normalized_type},
                    {'allowed_traffic_types': normalized_type.lower()}
                ]
            })
            query['$and'].append({
                'disallowed_traffic_types': {
                    '$nin': [normalized_type, normalized_type.lower()]
                }
            })

        search_term = request.args.get('search', '').strip()
        if search_term:
            query['$and'].append({
                '$or': [
                    {'name': {'$regex': search_term, '$options': 'i'}},
                    {'description': {'$regex': search_term, '$options': 'i'}},
                    {'offer_id': {'$regex': search_term, '$options': 'i'}}
                ]
            })

        try:
            offset = int(request.args.get('offset', 0))
            if offset < 0:
                offset = 0
        except ValueError:
            offset = 0

        try:
            limit = int(request.args.get('limit', 50))
            if limit <= 0:
                limit = 50
            if limit > 200:
                limit = 200
        except ValueError:
            limit = 50

        projection = {
            '_id': 0,
            'offer_id': 1,
            'name': 1,
            'description': 1,
            'payout': 1,
            'currency': 1,
            'category': 1,
            'vertical': 1,
            'network': 1,
            'countries': 1,
            'target_url': 1,
            'preview_url': 1,
            'image_url': 1,
            'thumbnail_url': 1,
            'device_targeting': 1,
            'approved': 1,
            'created_at': 1,
            'updated_at': 1
        }

        offers = list(offers_col.find(query, projection)
                      .sort('created_at', -1)
                      .skip(offset)
                      .limit(limit))

        return jsonify({
            'success': True,
            'offers_count': len(offers),
            'offers': offers,
            'api_key_user': {
                'id': str(user['_id']),
                'username': user.get('username'),
                'email': user.get('email'),
                'role': user.get('role')
            }
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@offer_access_bp.route('/generate-api-key', methods=['POST'])
@token_required
def regenerate_api_key():
    try:
        current_user = request.current_user
        if not current_user:
            return jsonify({'success': False, 'error': 'Unauthorized'}), 401

        if current_user.get('role') != 'admin' and current_user.get('account_status', 'pending_approval') != 'approved':
            return jsonify({'success': False, 'error': 'Account is not approved'}), 403

        user_model = User()
        new_api_key = user_model.reset_api_key(str(current_user['_id']))
        if not new_api_key:
            return jsonify({'success': False, 'error': 'Could not regenerate API key'}), 500

        return jsonify({
            'success': True,
            'api_key': new_api_key,
            'message': 'API key regenerated successfully'
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500
