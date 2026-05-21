from flask import Blueprint, request, jsonify
from utils.auth import token_required, admin_required
from database import db_instance
from datetime import datetime
from bson import ObjectId
import logging

review_submissions_bp = Blueprint('review_submissions', __name__)
logger = logging.getLogger(__name__)

def _get_submissions_col():
    return db_instance.get_collection('review_submissions')

def _get_settings_col():
    return db_instance.get_collection('platform_settings')

def _get_users_col():
    return db_instance.get_collection('users')

@review_submissions_bp.route('/api/user/review-submissions', methods=['POST'])
@token_required
def create_submission():
    """Create a new review submission with proof image."""
    current_user = request.current_user
    try:
        data = request.get_json()
        if not data or not data.get('proof_image_url'):
            return jsonify({'error': 'Proof image is required'}), 400

        col = _get_submissions_col()
        if col is None:
            return jsonify({'error': 'Database unavailable'}), 500

        # Get current Review Us settings
        settings_col = _get_settings_col()
        settings = (settings_col.find_one({'key': 'review_us'}) or {}) if settings_col is not None else {}
        current_url = settings.get('url', '').strip()

        # Check if user already has a pending or approved submission for this URL
        query = {
            'user_id': current_user['_id'],
            'status': {'$in': ['pending', 'approved']}
        }
        if current_url:
            from routes.platform_settings import DEFAULT_REVIEW_US
            default_url = DEFAULT_REVIEW_US.get('url', '').strip()
            if current_url == default_url:
                query['$or'] = [
                    {'review_url': current_url},
                    {'review_url': {'$exists': False}},
                    {'review_url': None},
                    {'review_url': ''}
                ]
            else:
                query['review_url'] = current_url
        else:
            query['$or'] = [
                {'review_url': {'$exists': False}},
                {'review_url': None},
                {'review_url': ''}
            ]

        existing = col.find_one(query)
        if existing:
            return jsonify({'error': f'You already have a {existing["status"]} submission for this review link.'}), 400

        doc = {
            'user_id': current_user['_id'],
            'username': current_user.get('username', ''),
            'email': current_user.get('email', ''),
            'proof_image_url': data['proof_image_url'],
            'review_url': current_url,
            'status': 'pending',
            'submitted_at': datetime.utcnow(),
            'reward_applied': False
        }
        
        result = col.insert_one(doc)
        return jsonify({'success': True, 'id': str(result.inserted_id)}), 201
    except Exception as e:
        logger.error(f"Error creating review submission: {e}")
        return jsonify({'error': str(e)}), 500

@review_submissions_bp.route('/api/user/review-submissions', methods=['GET'])
@token_required
def get_user_submission():
    """Get the current user's review submission for the current active review link."""
    current_user = request.current_user
    try:
        col = _get_submissions_col()
        if col is None:
            return jsonify({'error': 'Database unavailable'}), 500

        # Get current Review Us settings
        settings_col = _get_settings_col()
        settings = (settings_col.find_one({'key': 'review_us'}) or {}) if settings_col is not None else {}
        current_url = settings.get('url', '').strip()

        query = {
            'user_id': current_user['_id']
        }
        if current_url:
            from routes.platform_settings import DEFAULT_REVIEW_US
            default_url = DEFAULT_REVIEW_US.get('url', '').strip()
            if current_url == default_url:
                query['$or'] = [
                    {'review_url': current_url},
                    {'review_url': {'$exists': False}},
                    {'review_url': None},
                    {'review_url': ''}
                ]
            else:
                query['review_url'] = current_url
        else:
            query['$or'] = [
                {'review_url': {'$exists': False}},
                {'review_url': None},
                {'review_url': ''}
            ]

        doc = col.find_one(query, sort=[('submitted_at', -1)])
        if not doc:
            return jsonify({'submission': None}), 200

        doc['_id'] = str(doc['_id'])
        doc['user_id'] = str(doc['user_id'])
        return jsonify({'submission': doc}), 200
    except Exception as e:
        logger.error(f"Error fetching user review submission: {e}")
        return jsonify({'error': str(e)}), 500

@review_submissions_bp.route('/api/admin/review-submissions', methods=['GET'])
@token_required
@admin_required
def get_all_submissions():
    """Admin: Get all review submissions."""
    try:
        col = _get_submissions_col()
        if col is None:
            return jsonify({'error': 'Database unavailable'}), 500

        submissions = list(col.find().sort('submitted_at', -1))
        for doc in submissions:
            doc['_id'] = str(doc['_id'])
            doc['user_id'] = str(doc['user_id'])

        return jsonify({'submissions': submissions}), 200
    except Exception as e:
        logger.error(f"Error fetching all review submissions: {e}")
        return jsonify({'error': str(e)}), 500

@review_submissions_bp.route('/api/admin/review-submissions/<sub_id>/approve', methods=['PUT'])
@token_required
@admin_required
def approve_submission(sub_id):
    """Admin: Approve submission and apply reward."""
    try:
        col = _get_submissions_col()
        settings_col = _get_settings_col()
        users_col = _get_users_col()
        
        if None in [col, settings_col, users_col]:
            return jsonify({'error': 'Database unavailable'}), 500

        sub = col.find_one({'_id': ObjectId(sub_id)})
        if not sub:
            return jsonify({'error': 'Submission not found'}), 404

        if sub['status'] == 'approved':
            return jsonify({'error': 'Already approved'}), 400

        # Get reward config
        settings = settings_col.find_one({'key': 'review_us'}) or {}
        reward_fixed = float(settings.get('reward_fixed', 5.0))
        reward_percentage = float(settings.get('reward_percentage', 10.0))

        # Get user balances
        user = users_col.find_one({'_id': sub['user_id']})
        if not user:
            return jsonify({'error': 'User not found'}), 404

        financial_info = user.get('financial_info', {})
        current_balance = float(financial_info.get('balance', 0.0))
        
        # Calculate bonus
        percentage_bonus = current_balance * (reward_percentage / 100.0)
        total_reward = reward_fixed + percentage_bonus

        new_balance = current_balance + total_reward
        
        # Update user balance
        users_col.update_one(
            {'_id': sub['user_id']},
            {'$set': {'financial_info.balance': new_balance}}
        )

        # Update submission
        col.update_one(
            {'_id': ObjectId(sub_id)},
            {'$set': {
                'status': 'approved',
                'reviewed_at': datetime.utcnow(),
                'reward_applied': True,
                'reward_amount': total_reward
            }}
        )

        # Insert into balance_adjustments so it shows up in dashboard earnings and transactions
        adj_col = db_instance.get_collection('balance_adjustments')
        if adj_col is not None:
            adj_col.insert_one({
                'user_id': ObjectId(sub['user_id']) if isinstance(sub['user_id'], str) else sub['user_id'],
                'amount': total_reward,
                'reason': f'Review Us Reward (Fixed: ${reward_fixed}, Bonus: {reward_percentage}%)',
                'created_at': datetime.utcnow()
            })

        return jsonify({'success': True, 'message': 'Approved and rewarded successfully', 'reward_amount': total_reward}), 200
    except Exception as e:
        logger.error(f"Error approving submission: {e}")
        return jsonify({'error': str(e)}), 500

@review_submissions_bp.route('/api/admin/review-submissions/<sub_id>/reject', methods=['PUT'])
@token_required
@admin_required
def reject_submission(sub_id):
    """Admin: Reject submission."""
    try:
        col = _get_submissions_col()
        if col is None:
            return jsonify({'error': 'Database unavailable'}), 500

        result = col.update_one(
            {'_id': ObjectId(sub_id)},
            {'$set': {
                'status': 'rejected',
                'reviewed_at': datetime.utcnow()
            }}
        )

        if result.modified_count == 0:
            return jsonify({'error': 'Submission not found or already rejected'}), 404

        return jsonify({'success': True, 'message': 'Rejected successfully'}), 200
    except Exception as e:
        logger.error(f"Error rejecting submission: {e}")
        return jsonify({'error': str(e)}), 500

# ─── Review Us Button Click Tracking ───────────────────────────────────────────

def _get_review_clicks_col():
    return db_instance.get_collection('review_button_clicks')

@review_submissions_bp.route('/api/user/review-button-click', methods=['POST'])
@token_required
def track_review_button_click():
    """Track when a user clicks the 'Review Us' button."""
    current_user = request.current_user
    try:
        col = _get_review_clicks_col()
        if col is None:
            return jsonify({'error': 'Database unavailable'}), 500

        # Get current Review Us settings to log which URL was clicked
        settings_col = _get_settings_col()
        settings = (settings_col.find_one({'key': 'review_us'}) or {}) if settings_col is not None else {}
        current_url = settings.get('url', '').strip()

        doc = {
            'user_id': current_user['_id'],
            'username': current_user.get('username', ''),
            'email': current_user.get('email', ''),
            'review_url': current_url,
            'clicked_at': datetime.utcnow(),
            'ip_address': request.headers.get('X-Forwarded-For', request.remote_addr),
            'user_agent': request.headers.get('User-Agent', '')
        }
        col.insert_one(doc)
        return jsonify({'success': True}), 201
    except Exception as e:
        logger.error(f"Error tracking review button click: {e}")
        return jsonify({'error': str(e)}), 500

@review_submissions_bp.route('/api/admin/review-button-clicks', methods=['GET'])
@token_required
@admin_required
def get_review_button_clicks():
    """Admin: Get history of who clicked the Review Us button."""
    try:
        col = _get_review_clicks_col()
        if col is None:
            return jsonify({'error': 'Database unavailable'}), 500

        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 50))
        skip = (page - 1) * per_page

        total = col.count_documents({})
        clicks = list(col.find().sort('clicked_at', -1).skip(skip).limit(per_page))
        
        for doc in clicks:
            doc['_id'] = str(doc['_id'])
            doc['user_id'] = str(doc['user_id'])

        return jsonify({
            'clicks': clicks,
            'total': total,
            'page': page,
            'per_page': per_page,
            'total_pages': (total + per_page - 1) // per_page
        }), 200
    except Exception as e:
        logger.error(f"Error fetching review button clicks: {e}")
        return jsonify({'error': str(e)}), 500
