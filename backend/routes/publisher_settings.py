"""
Publisher Settings Routes
Handles email notification preferences and other publisher settings
"""

from flask import Blueprint, request, jsonify
from utils.auth import token_required
from models.user import User
import logging

logger = logging.getLogger(__name__)

publisher_settings_bp = Blueprint('publisher_settings', __name__)

@publisher_settings_bp.route('/api/publisher/settings/email-preferences', methods=['GET'])
@token_required
def get_email_preferences():
    """Get current user's email notification preferences"""
    try:
        from flask import request
        current_user = request.current_user
        user_model = User()
        user_id = str(current_user['_id'])
        
        preferences = user_model.get_email_preferences(user_id)
        
        if preferences is None:
            return jsonify({
                'error': 'Could not retrieve email preferences'
            }), 500
        
        return jsonify({
            'email': current_user.get('email'),
            'preferences': preferences
        }), 200
        
    except Exception as e:
        logger.error(f"❌ Error getting email preferences: {str(e)}")
        return jsonify({'error': f'Error retrieving preferences: {str(e)}'}), 500


@publisher_settings_bp.route('/api/publisher/settings/email-preferences', methods=['PUT'])
@token_required
def update_email_preferences():
    """Update user's email notification preferences"""
    try:
        current_user = request.current_user
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        user_model = User()
        user_id = str(current_user['_id'])
        
        # Extract preferences
        preferences = {
            'new_offers': data.get('new_offers', True),
            'offer_updates': data.get('offer_updates', True),
            'system_notifications': data.get('system_notifications', True),
            'marketing_emails': data.get('marketing_emails', False)
        }
        
        # Update preferences
        success = user_model.update_email_preferences(user_id, preferences)
        
        if not success:
            return jsonify({'error': 'Failed to update preferences'}), 500
        
        logger.info(f"✅ Updated email preferences for user {current_user.get('username')}")
        
        return jsonify({
            'message': 'Email preferences updated successfully',
            'preferences': preferences
        }), 200
        
    except Exception as e:
        logger.error(f"❌ Error updating email preferences: {str(e)}")
        return jsonify({'error': f'Error updating preferences: {str(e)}'}), 500


@publisher_settings_bp.route('/api/publisher/settings/email-preferences/toggle', methods=['POST'])
@token_required
def toggle_email_preference():
    """Toggle a specific email preference"""
    try:
        current_user = request.current_user
        data = request.get_json()
        
        if not data or 'preference_type' not in data:
            return jsonify({'error': 'preference_type is required'}), 400
        
        preference_type = data.get('preference_type')
        enabled = data.get('enabled')
        
        # Validate preference type
        valid_types = ['new_offers', 'offer_updates', 'system_notifications', 'marketing_emails']
        if preference_type not in valid_types:
            return jsonify({'error': f'Invalid preference type. Must be one of: {", ".join(valid_types)}'}), 400
        
        user_model = User()
        user_id = str(current_user['_id'])
        
        # Get current preferences
        current_prefs = user_model.get_email_preferences(user_id)
        if current_prefs is None:
            return jsonify({'error': 'Could not retrieve current preferences'}), 500
        
        # Update specific preference
        current_prefs[preference_type] = enabled
        
        # Save updated preferences
        success = user_model.update_email_preferences(user_id, current_prefs)
        
        if not success:
            return jsonify({'error': 'Failed to toggle preference'}), 500
        
        logger.info(f"✅ Toggled {preference_type} to {enabled} for user {current_user.get('username')}")
        
        return jsonify({
            'message': f'{preference_type} has been {"enabled" if enabled else "disabled"}',
            'preference_type': preference_type,
            'enabled': enabled,
            'preferences': current_prefs
        }), 200
        
    except Exception as e:
        logger.error(f"❌ Error toggling email preference: {str(e)}")
        return jsonify({'error': f'Error toggling preference: {str(e)}'}), 500


@publisher_settings_bp.route('/api/publisher/settings', methods=['GET'])
@token_required
def get_publisher_settings():
    """Get all publisher settings"""
    try:
        current_user = request.current_user
        user_model = User()
        user_id = str(current_user['_id'])
        
        preferences = user_model.get_email_preferences(user_id)
        
        settings = {
            'email': current_user.get('email'),
            'username': current_user.get('username'),
            'company_name': current_user.get('company_name'),
            'website': current_user.get('website'),
            'email_preferences': preferences,
            'email_verified': current_user.get('email_verified', False)
        }
        
        return jsonify(settings), 200
        
    except Exception as e:
        logger.error(f"❌ Error getting publisher settings: {str(e)}")
        return jsonify({'error': f'Error retrieving settings: {str(e)}'}), 500
