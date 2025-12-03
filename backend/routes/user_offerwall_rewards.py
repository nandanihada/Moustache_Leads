from flask import Blueprint, request, jsonify
from models.offerwall_tracking import OfferwallTracking
from database import db_instance
from utils.auth import token_required
import logging

logger = logging.getLogger(__name__)

user_offerwall_rewards_bp = Blueprint('user_offerwall_rewards', __name__)

# Initialize offerwall tracking
enhanced_tracker = OfferwallTracking(db_instance)

@user_offerwall_rewards_bp.route('/api/user/offerwall/points', methods=['GET'])
@token_required
def get_user_points():
    """Get user's points summary"""
    try:
        user_id = request.args.get('user_id')
        if not user_id:
            return jsonify({'error': 'user_id is required'}), 400
        
        points = enhanced_tracker.get_user_points(user_id)
        
        return jsonify({
            'success': True,
            'data': points
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting user points: {e}", exc_info=True)
        return jsonify({'error': 'Internal server error'}), 500

@user_offerwall_rewards_bp.route('/api/user/offerwall/points-history', methods=['GET'])
@token_required
def get_user_points_history():
    """Get user's points earning history"""
    try:
        user_id = request.args.get('user_id')
        limit = request.args.get('limit', 50, type=int)
        
        if not user_id:
            return jsonify({'error': 'user_id is required'}), 400
        
        history = enhanced_tracker.get_user_points_history(user_id, limit)
        
        return jsonify({
            'success': True,
            'data': history
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting points history: {e}", exc_info=True)
        return jsonify({'error': 'Internal server error'}), 500

@user_offerwall_rewards_bp.route('/api/user/offerwall/completed-offers', methods=['GET'])
@token_required
def get_user_completed_offers():
    """Get user's completed offers"""
    try:
        user_id = request.args.get('user_id')
        limit = request.args.get('limit', 50, type=int)
        
        if not user_id:
            return jsonify({'error': 'user_id is required'}), 400
        
        completions = enhanced_tracker.get_user_completed_offers(user_id, limit)
        
        return jsonify({
            'success': True,
            'data': {
                'user_id': user_id,
                'completed_offers': completions,
                'total_entries': len(completions)
            }
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting completed offers: {e}", exc_info=True)
        return jsonify({'error': 'Internal server error'}), 500

@user_offerwall_rewards_bp.route('/api/user/offerwall/dashboard', methods=['GET'])
@token_required
def get_user_dashboard():
    """Get user's offerwall dashboard data"""
    try:
        user_id = request.args.get('user_id')
        if not user_id:
            return jsonify({'error': 'user_id is required'}), 400
        
        # Get all user data
        points = enhanced_tracker.get_user_points(user_id)
        history = enhanced_tracker.get_user_points_history(user_id, limit=10)
        completions = enhanced_tracker.get_user_completed_offers(user_id, limit=10)
        
        # Calculate stats
        total_offers_completed = len(completions)
        total_earnings = points.get('total_points', 0)
        avg_payout = (total_earnings / total_offers_completed) if total_offers_completed > 0 else 0
        
        return jsonify({
            'success': True,
            'data': {
                'points': points,
                'history': history,
                'completed_offers': completions,
                'stats': {
                    'total_offers_completed': total_offers_completed,
                    'total_earnings': total_earnings,
                    'average_payout_per_offer': round(avg_payout, 2)
                }
            }
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting user dashboard: {e}", exc_info=True)
        return jsonify({'error': 'Internal server error'}), 500

@user_offerwall_rewards_bp.route('/api/user/offerwall/leaderboard', methods=['GET'])
@token_required
def get_leaderboard():
    """Get offerwall leaderboard"""
    try:
        # Placeholder implementation
        return jsonify({
            'success': True,
            'data': {
                'message': 'Leaderboard coming soon',
                'leaderboard': []
            }
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting leaderboard: {e}", exc_info=True)
        return jsonify({'error': 'Internal server error'}), 500

@user_offerwall_rewards_bp.route('/api/user/offerwall/stats', methods=['GET'])
@token_required
def get_user_stats():
    """Get user's offerwall statistics"""
    try:
        user_id = request.args.get('user_id')
        placement_id = request.args.get('placement_id')
        
        if not user_id:
            return jsonify({'error': 'user_id is required'}), 400
        
        # Get user points
        points = enhanced_tracker.get_user_points(user_id)
        
        # Get completed offers
        completions = enhanced_tracker.get_user_completed_offers(user_id, limit=1000)
        
        # Calculate stats
        total_offers_completed = len(completions)
        total_earnings = points.get('total_points', 0)
        avg_payout = (total_earnings / total_offers_completed) if total_offers_completed > 0 else 0
        
        return jsonify({
            'success': True,
            'data': {
                'user_id': user_id,
                'points': points,
                'stats': {
                    'total_offers_completed': total_offers_completed,
                    'total_earnings': total_earnings,
                    'average_payout_per_offer': round(avg_payout, 2)
                }
            }
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting user stats: {e}", exc_info=True)
        return jsonify({'error': 'Internal server error'}), 500

@user_offerwall_rewards_bp.route('/api/user/offerwall/redemption-options', methods=['GET'])
@token_required
def get_redemption_options():
    """Get available redemption options"""
    try:
        # Placeholder implementation
        return jsonify({
            'success': True,
            'data': {
                'message': 'Redemption options coming soon',
                'options': []
            }
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting redemption options: {e}", exc_info=True)
        return jsonify({'error': 'Internal server error'}), 500
