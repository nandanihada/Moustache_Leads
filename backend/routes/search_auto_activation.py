"""
Search Auto-Activation Routes
Admin endpoints for the per-user offer tracking system.
Shows all auto-activated offers, their status, expiry, and allows admin control.
"""

from flask import Blueprint, request, jsonify
from utils.auth import token_required, admin_required
from services.search_auto_activation_service import get_search_auto_activation_service
from models.offer_grant import OfferGrant
from database import db_instance
from datetime import datetime, timedelta
from bson import ObjectId
import logging

logger = logging.getLogger(__name__)

search_auto_activation_bp = Blueprint('search_auto_activation', __name__)


@search_auto_activation_bp.route('/per-user-offers/stats', methods=['GET'])
@token_required
@admin_required
def get_stats():
    """Get dashboard stats for the per-user offer tracking page."""
    svc = get_search_auto_activation_service()
    stats = svc.get_stats()
    return jsonify({'success': True, **stats})


@search_auto_activation_bp.route('/per-user-offers/activations', methods=['GET'])
@token_required
@admin_required
def get_activations():
    """Get paginated list of all auto-activations with filters."""
    try:
        col = db_instance.get_collection('search_auto_activations')
        if col is None:
            return jsonify({'success': True, 'activations': [], 'total': 0})

        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 25, type=int)
        skip = (page - 1) * per_page

        # Filters
        status_filter = request.args.get('status', '')  # active, expired, all
        user_filter = request.args.get('user', '').strip()
        trigger_filter = request.args.get('trigger', '')  # search_auto_activation, admin_manual, user_request
        date_from = request.args.get('date_from', '')
        date_to = request.args.get('date_to', '')

        query = {}

        if status_filter and status_filter != 'all':
            query['status'] = status_filter

        if user_filter:
            query['$or'] = [
                {'username': {'$regex': user_filter, '$options': 'i'}},
                {'user_id': user_filter}
            ]

        if trigger_filter:
            query['trigger'] = trigger_filter

        if date_from or date_to:
            date_query = {}
            if date_from:
                date_query['$gte'] = datetime.fromisoformat(date_from.replace('Z', ''))
            if date_to:
                date_query['$lte'] = datetime.fromisoformat(date_to.replace('Z', ''))
            if date_query:
                query['activated_at'] = date_query

        total = col.count_documents(query)
        docs = list(col.find(query).sort('activated_at', -1).skip(skip).limit(per_page))

        activations = []
        for doc in docs:
            activations.append({
                '_id': str(doc['_id']),
                'user_id': doc.get('user_id', ''),
                'username': doc.get('username', ''),
                'keywords': doc.get('keywords', []),
                'offer_ids': doc.get('offer_ids', []),
                'offers': doc.get('offers', []),
                'trigger': doc.get('trigger', ''),
                'trigger_reason': doc.get('trigger_reason', ''),
                'status': doc.get('status', ''),
                'activated_at': doc['activated_at'].isoformat() + 'Z' if isinstance(doc.get('activated_at'), datetime) else doc.get('activated_at'),
                'expires_at': doc['expires_at'].isoformat() + 'Z' if isinstance(doc.get('expires_at'), datetime) else doc.get('expires_at'),
                'clicks': doc.get('clicks', 0),
                'last_click_at': doc['last_click_at'].isoformat() + 'Z' if isinstance(doc.get('last_click_at'), datetime) else doc.get('last_click_at'),
                'deactivated_at': doc['deactivated_at'].isoformat() + 'Z' if isinstance(doc.get('deactivated_at'), datetime) else doc.get('deactivated_at'),
                'deactivation_reason': doc.get('deactivation_reason'),
                'search_count': doc.get('search_count', 0),
                'delay_hours': doc.get('delay_hours', 3),
                'grant_duration_days': doc.get('grant_duration_days', 30),
            })

        return jsonify({
            'success': True,
            'activations': activations,
            'total': total,
            'pagination': {
                'page': page,
                'per_page': per_page,
                'total': total,
                'pages': (total + per_page - 1) // per_page
            }
        })

    except Exception as e:
        logger.error(f"Error fetching activations: {e}")
        return jsonify({'error': str(e)}), 500


@search_auto_activation_bp.route('/per-user-offers/user/<user_id>', methods=['GET'])
@token_required
@admin_required
def get_user_activations(user_id):
    """Get all activations for a specific user — shows exclusive offers for this user."""
    try:
        col = db_instance.get_collection('search_auto_activations')
        grants_col = db_instance.get_collection('offer_grants')

        if col is None:
            return jsonify({'success': True, 'activations': [], 'grants': []})

        # Auto-activations for this user
        docs = list(col.find({'user_id': user_id}).sort('activated_at', -1))
        activations = []
        for doc in docs:
            activations.append({
                '_id': str(doc['_id']),
                'keywords': doc.get('keywords', []),
                'offer_ids': doc.get('offer_ids', []),
                'offers': doc.get('offers', []),
                'trigger': doc.get('trigger', ''),
                'trigger_reason': doc.get('trigger_reason', ''),
                'status': doc.get('status', ''),
                'activated_at': doc['activated_at'].isoformat() + 'Z' if isinstance(doc.get('activated_at'), datetime) else doc.get('activated_at'),
                'expires_at': doc['expires_at'].isoformat() + 'Z' if isinstance(doc.get('expires_at'), datetime) else doc.get('expires_at'),
                'clicks': doc.get('clicks', 0),
                'last_click_at': doc['last_click_at'].isoformat() + 'Z' if isinstance(doc.get('last_click_at'), datetime) else doc.get('last_click_at'),
                'deactivated_at': doc['deactivated_at'].isoformat() + 'Z' if isinstance(doc.get('deactivated_at'), datetime) else doc.get('deactivated_at'),
                'deactivation_reason': doc.get('deactivation_reason'),
            })

        # All offer grants for this user (from any source)
        grants = []
        if grants_col is not None:
            grant_docs = list(grants_col.find({'user_id': user_id}).sort('granted_at', -1))
            for g in grant_docs:
                grants.append({
                    '_id': str(g['_id']),
                    'offer_id': g.get('offer_id', ''),
                    'source': g.get('source', ''),
                    'granted_by': g.get('granted_by', ''),
                    'granted_at': g['granted_at'].isoformat() + 'Z' if isinstance(g.get('granted_at'), datetime) else g.get('granted_at'),
                    'expires_at': g['expires_at'].isoformat() + 'Z' if isinstance(g.get('expires_at'), datetime) else g.get('expires_at'),
                    'is_active': g.get('is_active', False),
                    'clicked': g.get('clicked', False),
                    'click_date': g['click_date'].isoformat() + 'Z' if isinstance(g.get('click_date'), datetime) else g.get('click_date'),
                })

        return jsonify({
            'success': True,
            'activations': activations,
            'grants': grants,
        })

    except Exception as e:
        logger.error(f"Error fetching user activations: {e}")
        return jsonify({'error': str(e)}), 500


@search_auto_activation_bp.route('/per-user-offers/settings', methods=['GET'])
@token_required
@admin_required
def get_settings():
    """Get current service settings."""
    svc = get_search_auto_activation_service()
    settings = svc._get_settings()
    return jsonify({'success': True, 'settings': settings})


@search_auto_activation_bp.route('/per-user-offers/settings', methods=['PUT'])
@token_required
@admin_required
def update_settings():
    """Update service settings (delay hours, max offers, enable/disable)."""
    svc = get_search_auto_activation_service()
    data = request.get_json() or {}

    updates = {}
    if 'enabled' in data:
        updates['enabled'] = bool(data['enabled'])
    if 'delay_hours' in data:
        updates['delay_hours'] = max(1, min(72, int(data['delay_hours'])))
    if 'max_offers' in data:
        updates['max_offers'] = max(1, min(20, int(data['max_offers'])))
    if 'grant_duration_days' in data:
        updates['grant_duration_days'] = max(7, min(90, int(data['grant_duration_days'])))
    if 'email_subject' in data:
        updates['email_subject'] = str(data['email_subject'])[:200]
    if 'email_message' in data:
        updates['email_message'] = str(data['email_message'])[:1000]
    if 'template_style' in data:
        updates['template_style'] = str(data['template_style'])
    if 'payout_type' in data:
        updates['payout_type'] = str(data['payout_type'])

    if not updates:
        return jsonify({'error': 'No valid settings provided'}), 400

    success = svc._update_settings(updates)
    if success:
        return jsonify({'success': True, 'settings': svc._get_settings()})
    return jsonify({'error': 'Failed to update settings'}), 500


@search_auto_activation_bp.route('/per-user-offers/deactivate/<activation_id>', methods=['POST'])
@token_required
@admin_required
def deactivate_activation(activation_id):
    """Manually deactivate an auto-activation."""
    try:
        col = db_instance.get_collection('search_auto_activations')
        grants_col = db_instance.get_collection('offer_grants')

        if col is None:
            return jsonify({'error': 'Database unavailable'}), 500

        if not ObjectId.is_valid(activation_id):
            return jsonify({'error': 'Invalid activation ID'}), 400

        doc = col.find_one({'_id': ObjectId(activation_id)})
        if not doc:
            return jsonify({'error': 'Activation not found'}), 404

        now = datetime.utcnow()
        col.update_one(
            {'_id': ObjectId(activation_id)},
            {'$set': {
                'status': 'manually_deactivated',
                'deactivated_at': now,
                'deactivation_reason': 'Admin manually deactivated',
            }}
        )

        # Also deactivate the grants
        if grants_col is not None and doc.get('user_id') and doc.get('offer_ids'):
            grants_col.update_many(
                {
                    'user_id': doc['user_id'],
                    'offer_id': {'$in': doc['offer_ids']},
                    'source': 'search_auto_activation',
                    'is_active': True,
                },
                {'$set': {'is_active': False, 'expired_at': now}}
            )

        return jsonify({'success': True, 'message': 'Activation deactivated'})

    except Exception as e:
        logger.error(f"Error deactivating activation: {e}")
        return jsonify({'error': str(e)}), 500


@search_auto_activation_bp.route('/per-user-offers/manual-activate', methods=['POST'])
@token_required
@admin_required
def manual_activate():
    """Manually activate offers for a specific user (admin override)."""
    try:
        data = request.get_json() or {}
        user_id = data.get('user_id')
        offer_ids = data.get('offer_ids', [])
        reason = data.get('reason', 'Admin manual activation')

        if not user_id or not offer_ids:
            return jsonify({'error': 'user_id and offer_ids required'}), 400

        svc = get_search_auto_activation_service()
        settings = svc._get_settings()
        grant_duration_days = settings.get('grant_duration_days', 30)

        # Create grants
        grant_model = OfferGrant()
        grant_model.grant_offers_to_user(
            user_id=user_id,
            offer_ids=offer_ids,
            source='admin_manual',
            granted_by=str(request.current_user.get('_id', 'admin'))
        )

        # Get offer details
        offers_col = db_instance.get_collection('offers')
        offers_detail = []
        if offers_col is not None:
            for oid in offer_ids:
                offer = offers_col.find_one({'offer_id': oid}, {'offer_id': 1, 'name': 1, 'category': 1, 'vertical': 1, 'payout': 1, 'network': 1})
                if offer:
                    offers_detail.append({
                        'offer_id': offer.get('offer_id'),
                        'name': offer.get('name', ''),
                        'category': offer.get('category', ''),
                        'vertical': offer.get('vertical', ''),
                        'payout': offer.get('payout', 0),
                        'network': offer.get('network', ''),
                    })

        # Get username
        users_col = db_instance.get_collection('users')
        username = 'Unknown'
        if users_col is not None and ObjectId.is_valid(user_id):
            user_doc = users_col.find_one({'_id': ObjectId(user_id)})
            if user_doc:
                username = user_doc.get('username', 'Unknown')

        # Record in tracking collection
        col = db_instance.get_collection('search_auto_activations')
        if col is not None:
            col.insert_one({
                'user_id': user_id,
                'username': username,
                'keywords': [],
                'offer_ids': offer_ids,
                'offers': offers_detail,
                'trigger': 'admin_manual',
                'trigger_reason': reason,
                'search_count': 0,
                'delay_hours': 0,
                'grant_duration_days': grant_duration_days,
                'status': 'active',
                'activated_at': datetime.utcnow(),
                'expires_at': datetime.utcnow() + timedelta(days=grant_duration_days),
                'clicks': 0,
                'last_click_at': None,
                'deactivated_at': None,
                'deactivation_reason': None,
            })

        return jsonify({'success': True, 'message': f'Activated {len(offer_ids)} offers for user {username}'})

    except Exception as e:
        logger.error(f"Error in manual activation: {e}")
        return jsonify({'error': str(e)}), 500


@search_auto_activation_bp.route('/per-user-offers/offer-visibility', methods=['GET'])
@token_required
@admin_required
def get_offer_visibility():
    """Get offer-centric view: which offers are visible to how many users."""
    try:
        grants_col = db_instance.get_collection('offer_grants')
        offers_col = db_instance.get_collection('offers')
        users_col = db_instance.get_collection('users')

        if grants_col is None:
            return jsonify({'success': True, 'offers': [], 'total': 0})

        # Check if collection has any active grants
        active_count = grants_col.count_documents({'is_active': True})
        if active_count == 0:
            return jsonify({'success': True, 'offers': [], 'total': 0})

        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 25, type=int)
        search = request.args.get('search', '').strip()

        # Aggregate: group by offer_id, count active users
        pipeline = [
            {'$match': {'is_active': True}},
            {'$group': {
                '_id': '$offer_id',
                'user_count': {'$sum': 1},
                'users': {'$push': {'user_id': '$user_id', 'source': '$source', 'granted_at': '$granted_at', 'clicked': '$clicked'}},
                'sources': {'$addToSet': '$source'},
                'latest_grant': {'$max': '$granted_at'},
            }},
            {'$sort': {'user_count': -1}},
            {'$limit': 200},
        ]

        all_results = list(grants_col.aggregate(pipeline))

        if not all_results:
            return jsonify({'success': True, 'offers': [], 'total': 0})

        # Enrich with offer details
        offer_ids = [r['_id'] for r in all_results if r.get('_id')]
        offer_details = {}
        if offers_col is not None and offer_ids:
            for offer in offers_col.find({'offer_id': {'$in': offer_ids}}, {'offer_id': 1, 'name': 1, 'category': 1, 'vertical': 1, 'payout': 1, 'status': 1, 'network': 1}):
                offer_details[offer.get('offer_id', '')] = offer

        # Build username cache for all user_ids in results
        all_user_ids = set()
        for r in all_results:
            for u in r.get('users', [])[:20]:
                uid = u.get('user_id', '')
                if uid:
                    all_user_ids.add(uid)

        username_cache = {}
        if users_col is not None and all_user_ids:
            valid_oids = [ObjectId(uid) for uid in all_user_ids if ObjectId.is_valid(uid)]
            if valid_oids:
                for user_doc in users_col.find({'_id': {'$in': valid_oids}}, {'username': 1}):
                    username_cache[str(user_doc['_id'])] = user_doc.get('username', '')

        # Apply search filter and build response
        enriched = []
        for r in all_results:
            oid = r.get('_id', '')
            if not oid:
                continue
            detail = offer_details.get(oid, {})
            name = detail.get('name', oid)

            if search and search.lower() not in name.lower() and search.lower() not in oid.lower():
                continue

            user_list = []
            for u in r.get('users', [])[:20]:
                uid = u.get('user_id', '')
                username = username_cache.get(uid, uid[:8] if uid else 'Unknown')
                granted_at = u.get('granted_at')
                user_list.append({
                    'user_id': uid,
                    'username': username,
                    'source': u.get('source', ''),
                    'granted_at': granted_at.isoformat() + 'Z' if isinstance(granted_at, datetime) else str(granted_at) if granted_at else None,
                    'clicked': u.get('clicked', False),
                })

            latest_grant = r.get('latest_grant')
            enriched.append({
                'offer_id': oid,
                'name': name,
                'category': detail.get('category', ''),
                'vertical': detail.get('vertical', ''),
                'payout': detail.get('payout', 0),
                'status': detail.get('status', 'unknown'),
                'network': detail.get('network', ''),
                'user_count': r.get('user_count', 0),
                'sources': r.get('sources', []),
                'latest_grant': latest_grant.isoformat() + 'Z' if isinstance(latest_grant, datetime) else str(latest_grant) if latest_grant else None,
                'users': user_list,
            })

        total = len(enriched)
        paginated = enriched[(page - 1) * per_page: page * per_page]

        return jsonify({
            'success': True,
            'offers': paginated,
            'total': total,
            'pagination': {
                'page': page,
                'per_page': per_page,
                'total': total,
                'pages': (total + per_page - 1) // per_page
            }
        })

    except Exception as e:
        logger.error(f"Error fetching offer visibility: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@search_auto_activation_bp.route('/per-user-offers/users-summary', methods=['GET'])
@token_required
@admin_required
def get_users_summary():
    """Get ALL users with their exclusive offer counts + approved request counts."""
    try:
        users_col = db_instance.get_collection('users')
        grants_col = db_instance.get_collection('offer_grants')
        requests_col = db_instance.get_collection('affiliate_requests')

        if users_col is None:
            return jsonify({'success': True, 'users': [], 'total': 0})

        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 25, type=int)
        search = request.args.get('search', '').strip()
        filter_type = request.args.get('filter', '').strip()  # has_exclusive, has_approved, has_clicked
        skip = (page - 1) * per_page

        # Build user query - show all users except admins
        user_query = {'role': {'$nin': ['admin', 'subadmin']}}
        if search:
            user_query['$or'] = [
                {'username': {'$regex': search, '$options': 'i'}},
                {'email': {'$regex': search, '$options': 'i'}},
            ]

        # Apply filter: restrict to users who have grants/approved/clicked
        if filter_type == 'has_exclusive' and grants_col is not None:
            user_ids_with_grants = grants_col.distinct('user_id', {'is_active': True})
            if user_ids_with_grants:
                valid_oids = [ObjectId(uid) for uid in user_ids_with_grants if ObjectId.is_valid(uid)]
                user_query['_id'] = {'$in': valid_oids}
            else:
                return jsonify({'success': True, 'users': [], 'total': 0, 'pagination': {'page': page, 'per_page': per_page, 'total': 0, 'pages': 0}})
        elif filter_type == 'has_approved' and requests_col is not None:
            user_ids_approved = requests_col.distinct('user_id', {'status': 'approved'})
            if user_ids_approved:
                valid_oids = [ObjectId(uid) if ObjectId.is_valid(str(uid)) else uid for uid in user_ids_approved]
                user_query['_id'] = {'$in': valid_oids}
            else:
                return jsonify({'success': True, 'users': [], 'total': 0, 'pagination': {'page': page, 'per_page': per_page, 'total': 0, 'pages': 0}})
        elif filter_type == 'has_clicked' and grants_col is not None:
            user_ids_clicked = grants_col.distinct('user_id', {'clicked': True})
            if user_ids_clicked:
                valid_oids = [ObjectId(uid) for uid in user_ids_clicked if ObjectId.is_valid(uid)]
                user_query['_id'] = {'$in': valid_oids}
            else:
                return jsonify({'success': True, 'users': [], 'total': 0, 'pagination': {'page': page, 'per_page': per_page, 'total': 0, 'pages': 0}})

        total = users_col.count_documents(user_query)
        user_docs = list(users_col.find(user_query, {'username': 1, 'email': 1, 'country': 1, 'created_at': 1}).sort('created_at', -1).skip(skip).limit(per_page))

        # Batch get grant counts and approved request counts for these users
        user_ids_str = [str(u['_id']) for u in user_docs]
        user_ids_oid = [u['_id'] for u in user_docs]

        # Get exclusive grant counts per user
        grant_counts = {}
        if grants_col is not None and user_ids_str:
            pipeline = [
                {'$match': {'user_id': {'$in': user_ids_str}, 'is_active': True}},
                {'$group': {'_id': '$user_id', 'count': {'$sum': 1}, 'clicked': {'$sum': {'$cond': [{'$eq': ['$clicked', True]}, 1, 0]}}, 'sources': {'$addToSet': '$source'}}},
            ]
            for doc in grants_col.aggregate(pipeline):
                grant_counts[doc['_id']] = {'count': doc['count'], 'clicked': doc.get('clicked', 0), 'sources': doc.get('sources', [])}

        # Get approved request counts per user
        approved_counts = {}
        if requests_col is not None:
            pipeline = [
                {'$match': {'user_id': {'$in': user_ids_str + user_ids_oid}, 'status': 'approved'}},
                {'$group': {'_id': {'$toString': '$user_id'}, 'count': {'$sum': 1}}},
            ]
            try:
                for doc in requests_col.aggregate(pipeline):
                    uid = doc['_id']
                    approved_counts[uid] = doc['count']
            except Exception:
                pass

        # Build response
        users = []
        for u in user_docs:
            uid = str(u['_id'])
            grants = grant_counts.get(uid, {'count': 0, 'clicked': 0, 'sources': []})
            approved = approved_counts.get(uid, 0)
            users.append({
                'user_id': uid,
                'username': u.get('username', 'Unknown'),
                'email': u.get('email', ''),
                'offer_count': grants['count'],
                'clicked_count': grants.get('clicked', 0),
                'approved_count': approved,
                'sources': grants.get('sources', []),
                'latest_grant': None,
            })

        return jsonify({
            'success': True,
            'users': users,
            'total': total,
            'pagination': {
                'page': page,
                'per_page': per_page,
                'total': total,
                'pages': (total + per_page - 1) // per_page
            }
        })

    except Exception as e:
        logger.error(f"Error fetching users summary: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@search_auto_activation_bp.route('/per-user-offers/run-now', methods=['POST'])
@token_required
@admin_required
def run_now():
    """Manually trigger the auto-activation processing (for testing/immediate run)."""
    svc = get_search_auto_activation_service()
    count = svc.process_pending_searches()
    svc.check_expiry_and_clicks()
    return jsonify({'success': True, 'offers_activated': count, 'message': f'Processed: {count} offers activated'})


@search_auto_activation_bp.route('/per-user-offers/user/<user_id>/full-access', methods=['GET'])
@token_required
@admin_required
def get_user_full_access(user_id):
    """
    Get complete offer access picture for a user:
    1. Global Active — offers active for everyone (user can see & request)
    2. Exclusive — offers activated only for this user (via grants)
    3. Approved Access — offers user requested and got approved
    """
    try:
        offers_col = db_instance.get_collection('offers')
        grants_col = db_instance.get_collection('offer_grants')
        requests_col = db_instance.get_collection('affiliate_requests')

        result = {
            'global_active': {'count': 0, 'offers': []},
            'exclusive': {'count': 0, 'offers': []},
            'approved_access': {'count': 0, 'offers': []},
        }

        # 1. Global Active — all offers with status='active' that everyone can see
        if offers_col is not None:
            global_count = offers_col.count_documents({
                'status': 'active',
                '$or': [{'deleted': {'$exists': False}}, {'deleted': False}, {'deleted': None}],
            })
            # Get first 50 for display
            global_offers = list(offers_col.find(
                {
                    'status': 'active',
                    '$or': [{'deleted': {'$exists': False}}, {'deleted': False}, {'deleted': None}],
                },
                {'offer_id': 1, 'name': 1, 'category': 1, 'vertical': 1, 'payout': 1, 'network': 1, 'status': 1}
            ).sort('name', 1).limit(50))

            result['global_active'] = {
                'count': global_count,
                'offers': [{
                    'offer_id': o.get('offer_id', ''),
                    'name': o.get('name', ''),
                    'category': o.get('category', '') or o.get('vertical', ''),
                    'payout': o.get('payout', 0),
                    'network': o.get('network', ''),
                    'visibility': 'everyone',
                } for o in global_offers]
            }

        # 2. Exclusive — offers from offer_grants for this user
        if grants_col is not None:
            exclusive_grants = list(grants_col.find(
                {'user_id': user_id, 'is_active': True}
            ).sort('granted_at', -1))

            exclusive_offers = []
            if exclusive_grants and offers_col is not None:
                grant_offer_ids = [g.get('offer_id') for g in exclusive_grants if g.get('offer_id')]
                offer_map = {}
                if grant_offer_ids:
                    for o in offers_col.find({'offer_id': {'$in': grant_offer_ids}}, {'offer_id': 1, 'name': 1, 'category': 1, 'vertical': 1, 'payout': 1, 'network': 1, 'status': 1}):
                        offer_map[o.get('offer_id', '')] = o

                for g in exclusive_grants:
                    oid = g.get('offer_id', '')
                    o = offer_map.get(oid, {})
                    exclusive_offers.append({
                        'offer_id': oid,
                        'name': o.get('name', oid),
                        'category': o.get('category', '') or o.get('vertical', ''),
                        'payout': o.get('payout', 0),
                        'network': o.get('network', ''),
                        'status': o.get('status', 'inactive'),
                        'source': g.get('source', ''),
                        'granted_at': g['granted_at'].isoformat() + 'Z' if isinstance(g.get('granted_at'), datetime) else g.get('granted_at'),
                        'expires_at': g['expires_at'].isoformat() + 'Z' if isinstance(g.get('expires_at'), datetime) else g.get('expires_at'),
                        'clicked': g.get('clicked', False),
                        'visibility': 'exclusive',
                    })

            result['exclusive'] = {
                'count': len(exclusive_offers),
                'offers': exclusive_offers,
            }

        # 3. Approved Access — offers from affiliate_requests with status='approved'
        if requests_col is not None:
            # user_id in affiliate_requests can be stored as ObjectId or string
            user_id_queries = [user_id]
            if ObjectId.is_valid(user_id):
                user_id_queries.append(ObjectId(user_id))

            approved_requests = list(requests_col.find(
                {'user_id': {'$in': user_id_queries}, 'status': 'approved'}
            ).sort('approved_at', -1))

            approved_offers = []
            if approved_requests and offers_col is not None:
                req_offer_ids = [r.get('offer_id') for r in approved_requests if r.get('offer_id')]
                offer_map = {}
                if req_offer_ids:
                    for o in offers_col.find({'offer_id': {'$in': req_offer_ids}}, {'offer_id': 1, 'name': 1, 'category': 1, 'vertical': 1, 'payout': 1, 'network': 1, 'status': 1}):
                        offer_map[o.get('offer_id', '')] = o

                for r in approved_requests:
                    oid = r.get('offer_id', '')
                    o = offer_map.get(oid, {})
                    approved_offers.append({
                        'offer_id': oid,
                        'name': o.get('name', oid),
                        'category': o.get('category', '') or o.get('vertical', ''),
                        'payout': o.get('payout', 0),
                        'network': o.get('network', ''),
                        'status': o.get('status', ''),
                        'approved_at': r['approved_at'].isoformat() + 'Z' if isinstance(r.get('approved_at'), datetime) else r.get('approved_at'),
                        'requested_at': r['requested_at'].isoformat() + 'Z' if isinstance(r.get('requested_at'), datetime) else r.get('requested_at'),
                        'visibility': 'approved_access',
                    })

            result['approved_access'] = {
                'count': len(approved_offers),
                'offers': approved_offers,
            }

        return jsonify({'success': True, **result})

    except Exception as e:
        logger.error(f"Error fetching user full access: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500
