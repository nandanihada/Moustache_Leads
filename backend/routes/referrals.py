"""
Referral Routes
Handles referral link generation, P1/P2 user endpoints, and admin management.
"""

from flask import Blueprint, request, jsonify
from datetime import datetime
from bson import ObjectId
import logging
from utils.auth import token_required
from models.referral import Referral

referrals_bp = Blueprint('referrals', __name__)
logger = logging.getLogger(__name__)


def admin_required(f):
    from functools import wraps
    @wraps(f)
    def decorated(*args, **kwargs):
        user = getattr(request, 'current_user', None)
        if not user or user.get('role') not in ('admin', 'subadmin'):
            return jsonify({'error': 'Admin access required'}), 403
        return f(*args, **kwargs)
    return decorated


# ─── User Endpoints ───

@referrals_bp.route('/referral/my-link', methods=['GET'])
@token_required
def get_my_referral_link():
    """Get or create the current user's referral link"""
    try:
        user = request.current_user
        user_id = str(user['_id'])
        ref_model = Referral()
        link, error = ref_model.get_or_create_referral_link(user_id)
        if error:
            return jsonify({'error': error}), 500
        return jsonify({'success': True, 'referral_link': link}), 200
    except Exception as e:
        logger.error(f"Error getting referral link: {e}")
        return jsonify({'error': str(e)}), 500


@referrals_bp.route('/referral/p1/stats', methods=['GET'])
@token_required
def get_my_p1_stats():
    """Get P1 stats for current user"""
    try:
        user = request.current_user
        ref_model = Referral()
        stats, error = ref_model.get_p1_stats_for_user(str(user['_id']))
        if error:
            return jsonify({'error': error}), 500
        return jsonify({'success': True, 'stats': stats}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@referrals_bp.route('/referral/p1/list', methods=['GET'])
@token_required
def get_my_p1_referrals():
    """Get P1 referral list for current user"""
    try:
        user = request.current_user
        ref_model = Referral()
        referrals, error = ref_model.get_p1_referrals_for_user(str(user['_id']))
        if error:
            return jsonify({'error': error}), 500
        return jsonify({'success': True, 'referrals': referrals}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@referrals_bp.route('/referral/p2/stats', methods=['GET'])
@token_required
def get_my_p2_stats():
    """Get P2 stats for current user"""
    try:
        user = request.current_user
        ref_model = Referral()
        stats, error = ref_model.get_p2_stats_for_user(str(user['_id']))
        if error:
            return jsonify({'error': error}), 500
        return jsonify({'success': True, 'stats': stats}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@referrals_bp.route('/referral/p2/list', methods=['GET'])
@token_required
def get_my_p2_referrals():
    """Get P2 referral list for current user"""
    try:
        user = request.current_user
        ref_model = Referral()
        referrals, error = ref_model.get_p2_referrals_for_user(str(user['_id']))
        if error:
            return jsonify({'error': error}), 500
        return jsonify({'success': True, 'referrals': referrals}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ─── Referral Registration (called during signup) ───

@referrals_bp.route('/referral/register', methods=['POST'])
def register_referral():
    """
    Called after a new user registers with a referral code.
    Creates P1 referral and runs fraud checks.
    Also creates P2 tracking if applicable.
    """
    try:
        data = request.get_json()
        referral_code = data.get('referral_code')
        referred_user_id = data.get('referred_user_id')
        referred_email = data.get('referred_email')
        referred_username = data.get('referred_username')
        ip_address = request.headers.get('X-Forwarded-For', request.remote_addr)
        device_fingerprint = data.get('device_fingerprint', '')
        user_agent = request.headers.get('User-Agent', '')

        if not referral_code or not referred_user_id:
            return jsonify({'error': 'Missing required fields'}), 400

        ref_model = Referral()

        # Find referrer
        link = ref_model.find_referrer_by_code(referral_code)
        if not link:
            return jsonify({'error': 'Invalid referral code'}), 404

        referrer_id = link['user_id']

        # Prevent self-referral
        if referrer_id == str(referred_user_id):
            return jsonify({'error': 'Cannot refer yourself'}), 400

        # Create P1 referral
        p1_doc, error = ref_model.create_p1_referral(
            referrer_id, referred_user_id, referred_email, referred_username,
            ip_address, device_fingerprint, user_agent
        )
        if error:
            return jsonify({'error': error}), 500

        # Run fraud checks
        from services.referral_fraud_service import referral_fraud_service
        fraud_score, status, checks = referral_fraud_service.run_fraud_checks(p1_doc)

        # Update referral with fraud results
        ref_model.update_p1_fraud_result(p1_doc['_id'], fraud_score, status)

        # Auto-release bonus if approved
        if status == 'approved':
            ref_model.release_p1_bonus(p1_doc['_id'])

        # Also create P2 tracking record
        ref_model.create_p2_referral(
            referrer_id, referred_user_id, referred_email, referred_username
        )

        # Store referral info on the referred user document
        from database import db_instance
        users = db_instance.get_collection('users')
        if users:
            users.update_one(
                {'_id': ObjectId(referred_user_id)},
                {'$set': {
                    'referred_by': referrer_id,
                    'referral_code_used': referral_code,
                    'referred_at': datetime.utcnow()
                }}
            )

        return jsonify({
            'success': True,
            'fraud_score': fraud_score,
            'status': status,
            'p1_referral_id': p1_doc['_id']
        }), 201

    except Exception as e:
        logger.error(f"Error registering referral: {e}")
        return jsonify({'error': str(e)}), 500


# ─── Admin Endpoints ───

@referrals_bp.route('/admin/referrals/p1/stats', methods=['GET'])
@token_required
@admin_required
def admin_p1_stats():
    """Get P1 admin stats"""
    try:
        ref_model = Referral()
        stats, error = ref_model.get_p1_admin_stats()
        if error:
            return jsonify({'error': error}), 500
        return jsonify({'success': True, 'stats': stats}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@referrals_bp.route('/admin/referrals/p1/list', methods=['GET'])
@token_required
@admin_required
def admin_p1_list():
    """Get paginated P1 referrals for admin"""
    try:
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 20))
        status = request.args.get('status')
        fraud_score_min = request.args.get('fraud_score_min')
        fraud_score_max = request.args.get('fraud_score_max')
        search = request.args.get('search')
        country = request.args.get('country')

        if fraud_score_min is not None:
            fraud_score_min = int(fraud_score_min)
        if fraud_score_max is not None:
            fraud_score_max = int(fraud_score_max)

        ref_model = Referral()
        result, error = ref_model.get_p1_admin_list(
            page=page, per_page=per_page, status=status,
            fraud_score_min=fraud_score_min, fraud_score_max=fraud_score_max,
            search=search, country=country
        )
        if error:
            return jsonify({'error': error}), 500
        return jsonify({'success': True, **result}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@referrals_bp.route('/admin/referrals/p1/countries', methods=['GET'])
@token_required
@admin_required
def admin_p1_countries():
    """Get distinct countries from P1 referrals for filter dropdown"""
    try:
        from database import db_instance
        referrals_p1 = db_instance.get_collection('referrals_p1')
        countries = referrals_p1.distinct('country')
        # Filter out empty strings
        countries = sorted([c for c in countries if c])
        return jsonify({'success': True, 'countries': countries}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@referrals_bp.route('/admin/referrals/p1/<referral_id>/approve', methods=['POST'])
@token_required
@admin_required
def admin_approve_p1(referral_id):
    """Approve a P1 referral and release bonus"""
    try:
        ref_model = Referral()
        success, error = ref_model.release_p1_bonus(referral_id)
        if not success:
            return jsonify({'error': error}), 400
        return jsonify({'success': True, 'message': 'Referral approved and bonus released'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@referrals_bp.route('/admin/referrals/p1/<referral_id>/reject', methods=['POST'])
@token_required
@admin_required
def admin_reject_p1(referral_id):
    """Reject a P1 referral"""
    try:
        ref_model = Referral()
        success, error = ref_model.reject_p1_referral(referral_id)
        if not success:
            return jsonify({'error': error}), 400
        return jsonify({'success': True, 'message': 'Referral rejected'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@referrals_bp.route('/admin/referrals/p1/<referral_id>/hold', methods=['POST'])
@token_required
@admin_required
def admin_hold_p1(referral_id):
    """Put a P1 referral on hold"""
    try:
        ref_model = Referral()
        success, error = ref_model.hold_p1_referral(referral_id)
        if not success:
            return jsonify({'error': error}), 400
        return jsonify({'success': True, 'message': 'Referral put on hold'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@referrals_bp.route('/admin/referrals/p1/bulk-action', methods=['POST'])
@token_required
@admin_required
def admin_bulk_action_p1():
    """Bulk approve or reject P1 referrals"""
    try:
        data = request.get_json()
        action = data.get('action')  # 'approve' or 'reject'
        referral_ids = data.get('referral_ids', [])

        if action not in ('approve', 'reject', 'hold'):
            return jsonify({'error': 'Invalid action'}), 400
        if not referral_ids:
            return jsonify({'error': 'No referral IDs provided'}), 400

        ref_model = Referral()
        success_count = 0
        errors = []

        for rid in referral_ids:
            try:
                if action == 'approve':
                    ok, err = ref_model.release_p1_bonus(rid)
                elif action == 'hold':
                    ok, err = ref_model.hold_p1_referral(rid)
                else:
                    ok, err = ref_model.reject_p1_referral(rid)
                if ok:
                    success_count += 1
                else:
                    errors.append({'id': rid, 'error': err})
            except Exception as e:
                errors.append({'id': rid, 'error': str(e)})

        return jsonify({
            'success': True,
            'processed': success_count,
            'errors': errors
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
