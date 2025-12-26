"""
Gift Card API Routes
Handles admin and user-facing gift card operations
"""

from flask import Blueprint, request, jsonify
from functools import wraps
from models.gift_card import get_gift_card_service
from models.user import User
from auth import token_required_with_user
import logging

logger = logging.getLogger(__name__)

gift_cards_bp = Blueprint('gift_cards', __name__)
gift_card_service = get_gift_card_service()


# ============================================
# ADMIN ROUTES
# ============================================

@gift_cards_bp.route('/admin/gift-cards', methods=['POST'])
@token_required_with_user
def create_gift_card(current_user):
    """
    Create a new gift card and optionally send to users (First-Come-First-Served Model)
    
    Request Body:
        {
            "name": "Holiday Gift Card",
            "description": "Special holiday bonus",
            "amount": 100,
            "max_redemptions": 15,  // First 15 users can redeem
            "image_url": "https://...",
            "expiry_date": "2025-12-31T23:59:59Z",
            "send_to_all": true,  // Send email to all users
            "excluded_users": ["user_id_1", "user_id_2"],  // Users to exclude from email
            "code": "GIFT2025" (optional, auto-generated if not provided),
            "send_email": true (optional, default: false)
        }
    """
    try:
        # Check if user is admin
        if current_user.get('role') != 'admin':
            return jsonify({'success': False, 'error': 'Unauthorized'}), 403
        
        data = request.get_json()
        
        # Create gift card
        gift_card, error = gift_card_service.create_gift_card(data, current_user['_id'])
        
        if error:
            return jsonify({'success': False, 'error': error}), 400
        
        # Send emails if requested
        if data.get('send_email', False):
            # If send_to_all is True, it will send to all users except excluded ones
            # If send_to_all is False, user_ids must be provided
            user_ids = data.get('user_ids') if not data.get('send_to_all', True) else None
            
            success, email_error = gift_card_service.send_gift_card_email(
                gift_card['_id'],
                user_ids  # None means use gift card settings (send_to_all)
            )
            
            if not success:
                logger.warning(f"Gift card created but email sending failed: {email_error}")
                gift_card['email_status'] = 'failed'
                gift_card['email_error'] = email_error
            else:
                gift_card['email_status'] = 'sent'
        
        return jsonify({
            'success': True,
            'message': f'Gift card created successfully! First {gift_card.get("max_redemptions", 0)} users can redeem.',
            'gift_card': gift_card
        }), 201
        
    except Exception as e:
        logger.error(f"Error creating gift card: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500


@gift_cards_bp.route('/admin/gift-cards', methods=['GET'])
@token_required_with_user
def get_all_gift_cards(current_user):
    """
    Get all gift cards (admin only)
    
    Query Parameters:
        - skip: Number of records to skip (default: 0)
        - limit: Number of records to return (default: 20)
        - status: Filter by status (optional)
    """
    try:
        # Check if user is admin
        if current_user.get('role') != 'admin':
            return jsonify({'success': False, 'error': 'Unauthorized'}), 403
        
        skip = int(request.args.get('skip', 0))
        limit = int(request.args.get('limit', 20))
        status = request.args.get('status')
        
        logger.info(f"Fetching gift cards: skip={skip}, limit={limit}, status={status}")
        gift_cards, total = gift_card_service.get_all_gift_cards(skip, limit, status)
        logger.info(f"Found {len(gift_cards)} gift cards, total={total}")
        
        return jsonify({
            'success': True,
            'gift_cards': gift_cards,
            'total': total,
            'skip': skip,
            'limit': limit
        }), 200
        
    except Exception as e:
        logger.error(f"Error fetching gift cards: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        return jsonify({'success': False, 'error': str(e)}), 500


@gift_cards_bp.route('/admin/gift-cards/<gift_card_id>/send-email', methods=['POST'])
@token_required_with_user
def send_gift_card_emails(current_user, gift_card_id):
    """
    Send gift card emails to specified users
    
    Request Body:
        {
            "user_ids": ["user_id_1", "user_id_2"]
        }
    """
    try:
        # Check if user is admin
        if current_user.get('role') != 'admin':
            return jsonify({'success': False, 'error': 'Unauthorized'}), 403
        
        data = request.get_json()
        user_ids = data.get('user_ids', [])
        
        if not user_ids:
            return jsonify({'success': False, 'error': 'No user IDs provided'}), 400
        
        success, error = gift_card_service.send_gift_card_email(gift_card_id, user_ids)
        
        if error:
            return jsonify({'success': False, 'error': error}), 400
        
        return jsonify({
            'success': True,
            'message': f'Gift card emails sent to {len(user_ids)} users'
        }), 200
        
    except Exception as e:
        logger.error(f"Error sending gift card emails: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500


@gift_cards_bp.route('/admin/gift-cards/<gift_card_id>/cancel', methods=['POST'])
@token_required_with_user
def cancel_gift_card(current_user, gift_card_id):
    """Cancel a gift card"""
    try:
        # Check if user is admin
        if current_user.get('role') != 'admin':
            return jsonify({'success': False, 'error': 'Unauthorized'}), 403
        
        success, error = gift_card_service.cancel_gift_card(gift_card_id)
        
        if error:
            return jsonify({'success': False, 'error': error}), 400
        
        return jsonify({
            'success': True,
            'message': 'Gift card cancelled successfully'
        }), 200
        
    except Exception as e:
        logger.error(f"Error cancelling gift card: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500


# ============================================
# USER ROUTES
# ============================================

@gift_cards_bp.route('/publisher/gift-cards/redeem', methods=['POST'])
@token_required_with_user
def redeem_gift_card(current_user):
    """
    Redeem a gift card (First-Come-First-Served)
    
    Request Body:
        {
            "code": "GIFT2025"
        }
    """
    try:
        data = request.get_json()
        code = data.get('code', '').strip()
        
        if not code:
            return jsonify({'success': False, 'error': 'Gift card code is required'}), 400
        
        result, error = gift_card_service.redeem_gift_card(code, current_user['_id'])
        
        if error:
            return jsonify({'success': False, 'error': error}), 400
        
        return jsonify({
            'success': True,
            'message': f'🎉 Congratulations! You redeemed ${result["amount"]:.2f}! You were #{result["redemption_number"]} out of {result["max_redemptions"]} lucky users!',
            'amount': result['amount'],
            'new_balance': result['new_balance'],
            'gift_card_name': result['gift_card_name'],
            'redemption_number': result['redemption_number'],
            'max_redemptions': result['max_redemptions']
        }), 200
        
    except Exception as e:
        logger.error(f"Error redeeming gift card: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500


@gift_cards_bp.route('/publisher/gift-cards', methods=['GET'])
@token_required_with_user
def get_user_gift_cards(current_user):
    """Get all gift cards assigned to the current user"""
    try:
        gift_cards = gift_card_service.get_user_gift_cards(current_user['_id'])
        
        return jsonify({
            'success': True,
            'gift_cards': gift_cards
        }), 200
        
    except Exception as e:
        logger.error(f"Error fetching user gift cards: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500


@gift_cards_bp.route('/publisher/gift-cards/history', methods=['GET'])
@token_required_with_user
def get_redemption_history(current_user):
    """Get redemption history for the current user"""
    try:
        history = gift_card_service.get_redemption_history(current_user['_id'])
        
        return jsonify({
            'success': True,
            'history': history,
            'total_redeemed': len(history)
        }), 200
        
    except Exception as e:
        logger.error(f"Error fetching redemption history: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500


@gift_cards_bp.route('/publisher/balance', methods=['GET'])
@token_required_with_user
def get_user_balance(current_user):
    """Get current user balance"""
    try:
        user_model = User()
        user = user_model.collection.find_one({'_id': current_user['_id']})
        
        if not user:
            return jsonify({'success': False, 'error': 'User not found'}), 404
        
        balance = user.get('balance', 0)
        
        return jsonify({
            'success': True,
            'balance': balance
        }), 200
        
    except Exception as e:
        logger.error(f"Error fetching user balance: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500
