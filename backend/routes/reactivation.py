"""
Reactivation Routes
Admin endpoints for the inactive user reactivation engine.
"""

from flask import Blueprint, request, jsonify
from utils.auth import token_required, admin_required
from services.reactivation_service import get_reactivation_service
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)

reactivation_bp = Blueprint('reactivation', __name__)


@reactivation_bp.route('/reactivation/users', methods=['GET'])
@token_required
@admin_required
def get_inactive_users():
    """Get paginated list of inactive users with filters"""
    svc = get_reactivation_service()

    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 25, type=int)
    sort_by = request.args.get('sort_by', 'longest_inactive')

    filters = {}
    if request.args.get('search'):
        filters['search'] = request.args.get('search')
    if request.args.get('inactivity_period'):
        filters['inactivity_period'] = request.args.get('inactivity_period')
    if request.args.get('activity_level'):
        filters['activity_level'] = request.args.get('activity_level')
    if request.args.get('risk_level'):
        filters['risk_level'] = request.args.get('risk_level')
    if request.args.get('country'):
        filters['country'] = request.args.get('country')
    if request.args.get('email_verified') is not None:
        val = request.args.get('email_verified')
        if val in ('true', 'false'):
            filters['email_verified'] = val == 'true'
    if request.args.get('has_earnings') == 'true':
        filters['has_earnings'] = True
    if request.args.get('has_placement') is not None:
        val = request.args.get('has_placement')
        if val in ('true', 'false'):
            filters['has_placement'] = val
    if request.args.get('has_offer_requests') is not None:
        val = request.args.get('has_offer_requests')
        if val in ('true', 'false'):
            filters['has_offer_requests'] = val
    if request.args.get('account_status'):
        filters['account_status'] = request.args.get('account_status')

    result = svc.get_inactive_users(
        filters=filters, page=page, per_page=per_page, sort_by=sort_by
    )
    return jsonify({'success': True, **result})


@reactivation_bp.route('/reactivation/stats', methods=['GET'])
@token_required
@admin_required
def get_stats():
    """Get reactivation dashboard stats and map data"""
    svc = get_reactivation_service()
    stats = svc.get_stats()
    return jsonify({'success': True, **stats})


@reactivation_bp.route('/reactivation/users/<user_id>/enriched', methods=['GET'])
@token_required
@admin_required
def get_user_enriched_detail(user_id):
    """Get enriched detail for a user — all data admin needs for reactivation decisions"""
    svc = get_reactivation_service()
    result = svc.get_user_enriched_detail(user_id)
    return jsonify({'success': True, **result})


@reactivation_bp.route('/reactivation/users/<user_id>/profile', methods=['GET'])
@token_required
@admin_required
def get_user_profile(user_id):
    """Get detailed behavior profile for a user"""
    svc = get_reactivation_service()
    profile = svc.get_user_profile(user_id)
    return jsonify({'success': True, 'profile': profile})


@reactivation_bp.route('/reactivation/outreach', methods=['POST'])
@token_required
@admin_required
def send_outreach():
    """Send or schedule outreach to users"""
    svc = get_reactivation_service()
    data = request.get_json() or {}

    user_ids = data.get('user_ids', [])
    if not user_ids:
        return jsonify({'error': 'user_ids required'}), 400

    # Parse scheduled_at if provided
    scheduled_at = None
    send_time = data.get('send_time', 'now')
    if send_time == '1h':
        scheduled_at = datetime.utcnow() + timedelta(hours=1)
    elif send_time == '24h':
        scheduled_at = datetime.utcnow() + timedelta(hours=24)
    elif send_time == 'custom' and data.get('scheduled_at'):
        try:
            scheduled_at = datetime.fromisoformat(data['scheduled_at'].replace('Z', ''))
        except Exception:
            pass

    admin_id = str(request.current_user.get('_id', ''))

    results = svc.send_outreach(
        user_ids=user_ids,
        offer_id=data.get('offer_id'),
        offer_name=data.get('offer_name'),
        channel=data.get('channel', 'email'),
        message=data.get('message', ''),
        subject=data.get('subject', ''),
        send_time=send_time,
        scheduled_at=scheduled_at,
        admin_id=admin_id,
    )

    return jsonify({'success': True, 'results': results})


@reactivation_bp.route('/reactivation/support', methods=['POST'])
@token_required
@admin_required
def create_support():
    """Create support tickets for reactivation users"""
    svc = get_reactivation_service()
    data = request.get_json() or {}

    user_ids = data.get('user_ids', [])
    if not user_ids:
        return jsonify({'error': 'user_ids required'}), 400

    admin_id = str(request.current_user.get('_id', ''))

    results = svc.create_support_ticket(
        user_ids=user_ids,
        issue_type=data.get('issue_type', 'Reactivation'),
        priority=data.get('priority', 'medium'),
        note=data.get('note', ''),
        assign_to=data.get('assign_to', 'auto'),
        admin_id=admin_id,
    )

    return jsonify({'success': True, 'results': results})


@reactivation_bp.route('/reactivation/sands', methods=['POST'])
@token_required
@admin_required
def execute_sands():
    """Execute S+S (Schedule + Support) combined action"""
    svc = get_reactivation_service()
    data = request.get_json() or {}

    user_ids = data.get('user_ids', [])
    if not user_ids:
        return jsonify({'error': 'user_ids required'}), 400

    admin_id = str(request.current_user.get('_id', ''))

    # Parse scheduled_at for outreach
    outreach_data = data.get('outreach')
    if outreach_data:
        send_time = outreach_data.get('send_time', 'now')
        if send_time == '1h':
            outreach_data['scheduled_at'] = datetime.utcnow() + timedelta(hours=1)
        elif send_time == '24h':
            outreach_data['scheduled_at'] = datetime.utcnow() + timedelta(hours=24)
        elif send_time == 'custom' and outreach_data.get('scheduled_at'):
            try:
                outreach_data['scheduled_at'] = datetime.fromisoformat(
                    outreach_data['scheduled_at'].replace('Z', '')
                )
            except Exception:
                pass

    results = svc.execute_sands(
        user_ids=user_ids,
        outreach_data=outreach_data,
        support_data=data.get('support'),
        admin_id=admin_id,
    )

    return jsonify({'success': True, **results})


@reactivation_bp.route('/reactivation/offers', methods=['GET'])
@token_required
@admin_required
def get_offers_for_picker():
    """Get active offers for the offer picker dropdown"""
    svc = get_reactivation_service()
    search = request.args.get('search', '')
    offers = svc.get_offers_for_picker(search=search)
    return jsonify({'success': True, 'offers': offers})


@reactivation_bp.route('/reactivation/outreach-history', methods=['GET'])
@token_required
@admin_required
def get_outreach_history():
    """Get overall outreach history for the reactivation tab"""
    svc = get_reactivation_service()
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 50, type=int)

    try:
        if svc.outreach_col is None:
            return jsonify({'success': True, 'history': [], 'total': 0})

        total = svc.outreach_col.count_documents({})
        docs = list(svc.outreach_col.find({}).sort('created_at', -1).skip((page - 1) * per_page).limit(per_page))

        history = []
        for d in docs:
            history.append({
                '_id': str(d.get('_id', '')),
                'user_id': d.get('user_id', ''),
                'user_email': d.get('user_email', ''),
                'username': d.get('username', ''),
                'offer_name': d.get('offer_name', ''),
                'channel': d.get('channel', ''),
                'subject': d.get('subject', ''),
                'message': (d.get('message', '') or '')[:200],
                'status': d.get('status', ''),
                'send_time': d.get('send_time', ''),
                'created_at': d.get('created_at'),
                'sent_at': d.get('sent_at'),
                'bulk_send': d.get('bulk_send', False),
                'bulk_count': d.get('bulk_count', 0),
            })

        # Stats
        sent_count = svc.outreach_col.count_documents({'status': 'sent'})
        failed_count = svc.outreach_col.count_documents({'status': 'failed'})
        scheduled_count = svc.outreach_col.count_documents({'status': 'scheduled'})

        return jsonify({
            'success': True,
            'history': history,
            'total': total,
            'stats': {'sent': sent_count, 'failed': failed_count, 'scheduled': scheduled_count},
            'page': page,
            'per_page': per_page,
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@reactivation_bp.route('/reactivation/offers/quick-pick', methods=['GET'])
@token_required
@admin_required
def get_quick_pick_offers():
    """Get categorized offer lists for quick-pick buttons in S+S modal"""
    svc = get_reactivation_service()
    result = svc.get_quick_pick_offers()
    return jsonify({'success': True, **result})


@reactivation_bp.route('/reactivation/users/<user_id>/recommend', methods=['GET'])
@token_required
@admin_required
def recommend_offers(user_id):
    """Get recommended offers for a specific user based on their behavior"""
    svc = get_reactivation_service()
    limit = request.args.get('limit', 20, type=int)
    offers = svc.recommend_offers(user_id, limit=limit)
    return jsonify({'success': True, 'offers': offers})
