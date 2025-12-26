"""
Payout Settings Routes
API endpoints for managing payout methods and earnings
"""

from flask import Blueprint, request, jsonify
from utils.auth import token_required
from models.payout_method import PayoutMethod
from models.monthly_earnings import MonthlyEarnings
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

payout_settings_bp = Blueprint('payout_settings', __name__)


@payout_settings_bp.route('/method', methods=['GET'])
@token_required
def get_payout_method():
    """Get current payout method"""
    try:
        current_user = request.current_user
        user_id = str(current_user['_id'])

        payout_model = PayoutMethod()
        method, error = payout_model.get_user_payout_method(user_id)

        if error:
            return jsonify({'error': error}), 500

        if not method:
            return jsonify({
                'message': 'No payout method configured',
                'has_method': False
            }), 200

        return jsonify({
            'has_method': True,
            'method': method
        }), 200

    except Exception as e:
        logger.error(f"Error getting payout method: {e}")
        return jsonify({'error': 'Internal server error'}), 500


@payout_settings_bp.route('/method', methods=['POST'])
@token_required
def save_payout_method():
    """Save or update payout method"""
    try:
        current_user = request.current_user
        user_id = str(current_user['_id'])
        data = request.get_json()

        if not data:
            return jsonify({'error': 'No data provided'}), 400

        payout_model = PayoutMethod()

        # Validate based on active method
        active_method = data.get('active_method')
        
        if active_method == 'bank':
            bank_details = data.get('bank_details', {})
            valid, error = payout_model.validate_bank_details(bank_details)
            if not valid:
                return jsonify({'error': error}), 400

        elif active_method == 'paypal':
            paypal_details = data.get('paypal_details', {})
            valid, error = payout_model.validate_paypal_details(paypal_details)
            if not valid:
                return jsonify({'error': error}), 400

        elif active_method == 'crypto':
            crypto_details = data.get('crypto_details', {})
            valid, error = payout_model.validate_crypto_details(crypto_details)
            if not valid:
                return jsonify({'error': error}), 400

        else:
            return jsonify({'error': 'Invalid active_method'}), 400

        # Save method
        method, error = payout_model.save_payout_method(user_id, data)

        if error:
            return jsonify({'error': error}), 400

        return jsonify({
            'message': 'Payout method saved successfully',
            'method': method
        }), 200

    except Exception as e:
        logger.error(f"Error saving payout method: {e}")
        return jsonify({'error': 'Internal server error'}), 500


@payout_settings_bp.route('/earnings', methods=['GET'])
@token_required
def get_earnings():
    """Get earnings data (current month, pending, history)"""
    try:
        current_user = request.current_user
        user_id = str(current_user['_id'])

        earnings_model = MonthlyEarnings()
        payout_model = PayoutMethod()

        # Get current month earnings
        current_month, error = earnings_model.get_current_month_earnings(user_id)
        if error:
            return jsonify({'error': error}), 500

        # Get pending earnings
        pending_total, error = earnings_model.get_pending_earnings(user_id)
        if error:
            logger.warning(f"Error getting pending earnings: {error}")
            pending_total = 0

        # Get earnings history
        history, error = earnings_model.get_monthly_earnings_history(user_id)
        if error:
            logger.warning(f"Error getting earnings history: {error}")
            history = []

        # Get payout method
        payout_method, error = payout_model.get_user_payout_method(user_id)
        if error:
            logger.warning(f"Error getting payout method: {error}")
            payout_method = None

        # Calculate next payment date
        next_payment_date = None
        if history and len(history) > 0:
            latest = history[0]
            if latest['status'] == 'pending':
                # Parse created_at and add 30 days
                created_at = datetime.fromisoformat(latest['created_at'])
                next_payment = earnings_model.calculate_next_payment_date(created_at)
                next_payment_date = next_payment.isoformat()

        return jsonify({
            'current_month': current_month,
            'pending_earnings': pending_total,
            'earnings_history': history,
            'payout_method': {
                'has_method': payout_method is not None,
                'active_method': payout_method.get('active_method') if payout_method else None
            },
            'next_payment_date': next_payment_date
        }), 200

    except Exception as e:
        logger.error(f"Error getting earnings: {e}")
        return jsonify({'error': 'Internal server error'}), 500


@payout_settings_bp.route('/next-payment-date', methods=['GET'])
@token_required
def get_next_payment_date():
    """Calculate next payment date (Net-30)"""
    try:
        current_user = request.current_user
        user_id = str(current_user['_id'])

        earnings_model = MonthlyEarnings()

        # Get latest pending/processing earning
        earnings, error = earnings_model.get_monthly_earnings_history(user_id, limit=1)
        
        if error or not earnings:
            return jsonify({
                'has_payment': False,
                'message': 'No pending payments'
            }), 200

        latest = earnings[0]
        if latest['status'] in ['pending', 'processing']:
            created_at = datetime.fromisoformat(latest['created_at'])
            next_payment = earnings_model.calculate_next_payment_date(created_at)
            
            return jsonify({
                'has_payment': True,
                'next_payment_date': next_payment.isoformat(),
                'earning_month': latest['month'],
                'amount': latest['amount']
            }), 200

        return jsonify({
            'has_payment': False,
            'message': 'No pending payments'
        }), 200

    except Exception as e:
        logger.error(f"Error calculating next payment date: {e}")
        return jsonify({'error': 'Internal server error'}), 500
