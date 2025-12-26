"""
Admin Subadmin Management Routes
Manage subadmin users and their tab-level permissions
"""

from flask import Blueprint, request, jsonify
from models.user import User
from models.subadmin_permissions import SubadminPermissions
from utils.auth import token_required, admin_only_required
import logging

logger = logging.getLogger(__name__)

admin_subadmin_management_bp = Blueprint('admin_subadmin_management', __name__)

@admin_subadmin_management_bp.route('/subadmins/users', methods=['GET'])
@token_required
@admin_only_required
def get_all_users():
    """Get all users for selection dropdown"""
    try:
        user_model = User()
        users = user_model.get_all_users_for_selection()
        
        return jsonify({
            'users': users,
            'total': len(users)
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting users: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to get users: {str(e)}'}), 500


@admin_subadmin_management_bp.route('/subadmins/available-tabs', methods=['GET'])
@token_required
@admin_only_required
def get_available_tabs():
    """Get list of all available admin tabs for permission selection"""
    try:
        tabs = SubadminPermissions.get_available_tabs()
        
        # Return tabs with display names
        tab_info = []
        tab_display_names = {
            'offers': 'Offers Management',
            'promo-codes': 'Promo Codes',
            'bonus-management': 'Bonus Management',
            'offer-access-requests': 'Offer Access Requests',
            'placement-approval': 'Placement Approval',
            'offerwall-analytics': 'Offerwall Analytics',
            'comprehensive-analytics': 'Comprehensive Analytics',
            'click-tracking': 'Click Tracking',
            'login-logs': 'Login Logs',
            'active-users': 'Active Users',
            'fraud-management': 'Fraud Management',
            'analytics': 'Analytics',
            'reports': 'Reports',
            'tracking': 'Tracking',
            'test-tracking': 'Test Tracking',
            'partners': 'Partners',
            'postback-logs': 'Postback Logs',
            'postback-receiver': 'Postback Receiver',
            'publishers': 'Publishers',
            'subadmin-management': 'Subadmin Management'
        }
        
        for tab in tabs:
            tab_info.append({
                'value': tab,
                'label': tab_display_names.get(tab, tab.replace('-', ' ').title())
            })
        
        return jsonify({
            'tabs': tab_info
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting available tabs: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to get available tabs: {str(e)}'}), 500


@admin_subadmin_management_bp.route('/subadmins', methods=['GET'])
@token_required
@admin_only_required
def get_all_subadmins():
    """Get all subadmins with their permissions"""
    try:
        permissions_model = SubadminPermissions()
        user_model = User()
        
        # Get all subadmin permissions
        all_permissions = permissions_model.get_all_subadmins()
        
        # Enrich with user data
        subadmins = []
        for perm in all_permissions:
            user = user_model.find_by_id(perm['user_id'])
            if user:
                user.pop('password', None)
                subadmins.append({
                    'user_id': perm['user_id'],
                    'username': user.get('username'),
                    'email': user.get('email'),
                    'role': user.get('role'),
                    'allowed_tabs': perm.get('allowed_tabs', []),
                    'created_at': perm.get('created_at'),
                    'updated_at': perm.get('updated_at')
                })
        
        return jsonify({
            'subadmins': subadmins,
            'total': len(subadmins)
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting subadmins: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to get subadmins: {str(e)}'}), 500


@admin_subadmin_management_bp.route('/subadmins', methods=['POST'])
@token_required
@admin_only_required
def create_or_update_subadmin():
    """Create or update subadmin with permissions"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        user_id = data.get('user_id')
        allowed_tabs = data.get('allowed_tabs', [])
        
        if not user_id:
            return jsonify({'error': 'user_id is required'}), 400
        
        if not isinstance(allowed_tabs, list):
            return jsonify({'error': 'allowed_tabs must be an array'}), 400
        
        # Validate tabs
        available_tabs = SubadminPermissions.get_available_tabs()
        for tab in allowed_tabs:
            if tab not in available_tabs:
                return jsonify({'error': f'Invalid tab: {tab}'}), 400
        
        # Update user role to subadmin
        user_model = User()
        user = user_model.find_by_id(user_id)
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        # Don't allow changing admin to subadmin
        if user.get('role') == 'admin':
            return jsonify({'error': 'Cannot change admin user to subadmin'}), 400
        
        # Update role to subadmin
        role_updated = user_model.update_role(user_id, 'subadmin')
        if not role_updated:
            return jsonify({'error': 'Failed to update user role'}), 500
        
        # Create or update permissions
        permissions_model = SubadminPermissions()
        result = permissions_model.create_permissions(user_id, allowed_tabs)
        
        if result:
            logger.info(f"Created/updated subadmin {user_id} with tabs: {allowed_tabs}")
            return jsonify({
                'message': 'Subadmin created/updated successfully',
                'user_id': user_id,
                'allowed_tabs': allowed_tabs
            }), 200
        else:
            return jsonify({'error': 'Failed to create/update permissions'}), 500
        
    except Exception as e:
        logger.error(f"Error creating/updating subadmin: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to create/update subadmin: {str(e)}'}), 500


@admin_subadmin_management_bp.route('/subadmins/<user_id>', methods=['GET'])
@token_required
@admin_only_required
def get_subadmin_permissions(user_id):
    """Get permissions for a specific subadmin"""
    try:
        permissions_model = SubadminPermissions()
        permissions = permissions_model.get_permissions(user_id)
        
        if not permissions:
            return jsonify({'error': 'Permissions not found'}), 404
        
        user_model = User()
        user = user_model.find_by_id(user_id)
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        user.pop('password', None)
        
        return jsonify({
            'user_id': user_id,
            'username': user.get('username'),
            'email': user.get('email'),
            'role': user.get('role'),
            'allowed_tabs': permissions.get('allowed_tabs', []),
            'created_at': permissions.get('created_at'),
            'updated_at': permissions.get('updated_at')
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting subadmin permissions: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to get subadmin permissions: {str(e)}'}), 500


@admin_subadmin_management_bp.route('/subadmins/<user_id>', methods=['DELETE'])
@token_required
@admin_only_required
def remove_subadmin(user_id):
    """Remove subadmin role and permissions"""
    try:
        user_model = User()
        permissions_model = SubadminPermissions()
        
        # Check if user exists
        user = user_model.find_by_id(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        # Change role back to user
        role_updated = user_model.update_role(user_id, 'user')
        if not role_updated:
            return jsonify({'error': 'Failed to update user role'}), 500
        
        # Delete permissions
        permissions_deleted = permissions_model.delete_permissions(user_id)
        
        logger.info(f"Removed subadmin role from user {user_id}")
        
        return jsonify({
            'message': 'Subadmin role removed successfully',
            'user_id': user_id
        }), 200
        
    except Exception as e:
        logger.error(f"Error removing subadmin: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to remove subadmin: {str(e)}'}), 500


@admin_subadmin_management_bp.route('/subadmins/my-permissions', methods=['GET'])
@token_required
def get_my_permissions():
    """Get current user's permissions (for subadmins to check their own permissions)"""
    try:
        user = request.current_user
        user_id = str(user['_id'])
        user_role = user.get('role')
        
        # Admin has all permissions
        if user_role == 'admin':
            all_tabs = SubadminPermissions.get_available_tabs()
            return jsonify({
                'role': 'admin',
                'allowed_tabs': all_tabs,
                'has_full_access': True
            }), 200
        
        # Subadmin has limited permissions
        if user_role == 'subadmin':
            permissions_model = SubadminPermissions()
            permissions = permissions_model.get_permissions(user_id)
            
            if not permissions:
                return jsonify({
                    'role': 'subadmin',
                    'allowed_tabs': [],
                    'has_full_access': False
                }), 200
            
            return jsonify({
                'role': 'subadmin',
                'allowed_tabs': permissions.get('allowed_tabs', []),
                'has_full_access': False
            }), 200
        
        # Other roles have no admin permissions
        return jsonify({
            'role': user_role,
            'allowed_tabs': [],
            'has_full_access': False
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting my permissions: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to get permissions: {str(e)}'}), 500
