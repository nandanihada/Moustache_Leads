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

        # Clear dashboard cache so numbers refresh instantly on their dashboard
        try:
            from routes.user_dashboard import clear_dashboard_cache
            clear_dashboard_cache(sub['user_id'])
        except Exception as e:
            logger.error(f"Failed to clear dashboard cache for approved user: {e}")

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

@review_submissions_bp.route('/api/admin/review-submissions/<sub_id>/deduct', methods=['PUT'])
@token_required
@admin_required
def deduct_submission(sub_id):
    """Admin: Deduct reward from an already approved review submission (supports partial deduction)."""
    try:
        col = _get_submissions_col()
        users_col = _get_users_col()
        if None in [col, users_col]:
            return jsonify({'error': 'Database unavailable'}), 500

        sub = col.find_one({'_id': ObjectId(sub_id)})
        if not sub:
            return jsonify({'error': 'Submission not found'}), 404

        if sub.get('status') not in ['approved', 'partially_deducted']:
            return jsonify({'error': 'Only approved or partially deducted submissions can have their rewards deducted'}), 400

        if sub.get('status') == 'deducted':
            return jsonify({'error': 'This submission has already been fully deducted'}), 400

        reward_amount = float(sub.get('reward_amount', 0.0))
        already_deducted = float(sub.get('deducted_amount', 0.0))
        max_allowed_deduct = reward_amount - already_deducted

        if max_allowed_deduct <= 0:
            return jsonify({'error': 'No remaining reward amount left to deduct'}), 400

        # Get requested deduct amount
        req_data = request.get_json(silent=True) or {}
        deduct_amount = req_data.get('deduct_amount')

        if deduct_amount is not None:
            try:
                deduct_amount = float(deduct_amount)
            except ValueError:
                return jsonify({'error': 'Invalid deduct_amount format'}), 400
            
            if deduct_amount <= 0:
                return jsonify({'error': 'Deduct amount must be greater than zero'}), 400
            if deduct_amount > max_allowed_deduct:
                return jsonify({'error': f'Deduct amount cannot exceed remaining reward of ${max_allowed_deduct:.2f}'}), 400
        else:
            deduct_amount = max_allowed_deduct

        # Get user balances
        user = users_col.find_one({'_id': sub['user_id']})
        if not user:
            return jsonify({'error': 'User not found'}), 404

        financial_info = user.get('financial_info', {})
        current_balance = float(financial_info.get('balance', 0.0))
        
        # Deduct from balance
        new_balance = current_balance - deduct_amount
        
        # Update user balance
        users_col.update_one(
            {'_id': sub['user_id']},
            {'$set': {'financial_info.balance': new_balance}}
        )

        # Update submission state
        total_new_deducted = already_deducted + deduct_amount
        is_partial = total_new_deducted < reward_amount
        status_value = 'partially_deducted' if is_partial else 'deducted'

        col.update_one(
            {'_id': ObjectId(sub_id)},
            {'$set': {
                'status': status_value,
                'deducted': True,
                'deducted_amount': total_new_deducted,
                'deducted_at': datetime.utcnow()
            }}
        )

        # Insert negative adjustment into balance_adjustments
        adj_col = db_instance.get_collection('balance_adjustments')
        if adj_col is not None:
            adj_col.insert_one({
                'user_id': ObjectId(sub['user_id']) if isinstance(sub['user_id'], str) else sub['user_id'],
                'amount': -deduct_amount,
                'reason': f'Review Us Reward Deduction (Reversed submission {sub_id})' if not is_partial else f'Review Us Reward Partial Deduction (Reversed submission {sub_id})',
                'created_at': datetime.utcnow()
            })

        # Clear dashboard cache so numbers refresh instantly on their dashboard
        try:
            from routes.user_dashboard import clear_dashboard_cache
            clear_dashboard_cache(sub['user_id'])
        except Exception as e:
            logger.error(f"Failed to clear dashboard cache for deducted user: {e}")

        return jsonify({
            'success': True, 
            'message': 'Reward successfully deducted from user balance', 
            'deducted_amount': deduct_amount,
            'total_deducted': total_new_deducted,
            'new_balance': new_balance,
            'status': status_value
        }), 200
    except Exception as e:
        logger.error(f"Error deducting submission reward: {e}")
        return jsonify({'error': str(e)}), 500

@review_submissions_bp.route('/api/admin/review-submissions/<sub_id>/add-reward', methods=['PUT'])
@token_required
@admin_required
def add_reward_submission(sub_id):
    """Admin: Add reward back (re-credit) to a deducted or partially deducted submission."""
    try:
        col = _get_submissions_col()
        users_col = _get_users_col()
        if None in [col, users_col]:
            return jsonify({'error': 'Database unavailable'}), 500

        sub = col.find_one({'_id': ObjectId(sub_id)})
        if not sub:
            return jsonify({'error': 'Submission not found'}), 404

        if not sub.get('deducted') or sub.get('status') not in ['deducted', 'partially_deducted']:
            return jsonify({'error': 'Can only add reward to deducted or partially deducted submissions'}), 400

        already_deducted = float(sub.get('deducted_amount', 0.0))

        # Get requested add amount
        req_data = request.get_json(silent=True) or {}
        add_amount = req_data.get('add_amount')

        if add_amount is None:
            return jsonify({'error': 'Missing add_amount parameter'}), 400

        try:
            add_amount = float(add_amount)
        except ValueError:
            return jsonify({'error': 'Invalid add_amount format'}), 400
        
        if add_amount <= 0:
            return jsonify({'error': 'Add amount must be greater than zero'}), 400

        # Get user balances
        user = users_col.find_one({'_id': sub['user_id']})
        if not user:
            return jsonify({'error': 'User not found'}), 404

        financial_info = user.get('financial_info', {})
        current_balance = float(financial_info.get('balance', 0.0))
        
        # Add to balance
        new_balance = current_balance + add_amount
        
        # Update user balance
        users_col.update_one(
            {'_id': sub['user_id']},
            {'$set': {'financial_info.balance': new_balance}}
        )

        # Update submission state
        new_deducted_amount = max(0.0, already_deducted - add_amount)
        is_still_deducted = new_deducted_amount > 0
        status_value = 'partially_deducted' if is_still_deducted else 'approved'

        col.update_one(
            {'_id': ObjectId(sub_id)},
            {'$set': {
                'status': status_value,
                'deducted': is_still_deducted,
                'deducted_amount': new_deducted_amount,
                'recredited_at': datetime.utcnow()
            }}
        )

        # Insert positive adjustment into balance_adjustments
        adj_col = db_instance.get_collection('balance_adjustments')
        if adj_col is not None:
            adj_col.insert_one({
                'user_id': ObjectId(sub['user_id']) if isinstance(sub['user_id'], str) else sub['user_id'],
                'amount': add_amount,
                'reason': f'Review Us Reward Re-credited (Submission {sub_id})',
                'created_at': datetime.utcnow()
            })

        # Clear dashboard cache so numbers refresh instantly on their dashboard
        try:
            from routes.user_dashboard import clear_dashboard_cache
            clear_dashboard_cache(sub['user_id'])
        except Exception as e:
            logger.error(f"Failed to clear dashboard cache for recredited user: {e}")

        return jsonify({
            'success': True, 
            'message': 'Reward successfully added back to user balance', 
            'added_amount': add_amount,
            'new_deducted_amount': new_deducted_amount,
            'new_balance': new_balance,
            'status': status_value
        }), 200
    except Exception as e:
        logger.error(f"Error adding back reward to submission: {e}")
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
