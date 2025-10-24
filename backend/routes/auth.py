from flask import Blueprint, request, jsonify
from models.user import User
from utils.auth import generate_token, token_required
import re
import logging

auth_bp = Blueprint('auth', __name__)

def validate_email(email):
    """Validate email format"""
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(pattern, email) is not None

def validate_password(password):
    """Validate password strength"""
    if len(password) < 6:
        return False, "Password must be at least 6 characters long"
    return True, ""

@auth_bp.route('/register', methods=['POST'])
def register():
    """User registration endpoint"""
    try:
        data = request.get_json()
        
        # Validate required fields
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        username = data.get('username', '').strip()
        email = data.get('email', '').strip()
        password = data.get('password', '')
        
        if not username:
            return jsonify({'error': 'Username is required'}), 400
        
        if not email:
            return jsonify({'error': 'Email is required'}), 400
        
        if not password:
            return jsonify({'error': 'Password is required'}), 400
        
        # Validate email format
        if not validate_email(email):
            return jsonify({'error': 'Invalid email format'}), 400
        
        # Validate password strength
        is_valid, password_error = validate_password(password)
        if not is_valid:
            return jsonify({'error': password_error}), 400
        
        # Validate username length
        if len(username) < 3:
            return jsonify({'error': 'Username must be at least 3 characters long'}), 400
        
        # Create user
        user_model = User()
        user_data, error = user_model.create_user(username, email, password)
        
        if error:
            return jsonify({'error': error}), 400
        
        # Generate token
        token = generate_token(user_data)
        
        return jsonify({
            'message': 'User registered successfully',
            'token': token,
            'user': {
                'id': str(user_data['_id']),
                'username': user_data['username'],
                'email': user_data['email'],
                'role': user_data.get('role', 'user')
            }
        }), 201
        
    except Exception as e:
        return jsonify({'error': f'Registration failed: {str(e)}'}), 500

@auth_bp.route('/login', methods=['POST'])
def login():
    """User login endpoint"""
    try:
        data = request.get_json()
        
        # Debug logging
        logging.info(f"Login attempt - Content-Type: {request.content_type}")
        logging.info(f"Login attempt - JSON data: {data}")
        
        # Validate required fields
        if not data:
            logging.warning("Login failed: No data provided")
            return jsonify({'error': 'No data provided'}), 400
        
        username = data.get('username', '').strip()
        password = data.get('password', '')
        
        if not username:
            return jsonify({'error': 'Username is required'}), 400
        
        if not password:
            return jsonify({'error': 'Password is required'}), 400
        
        # Verify user credentials
        user_model = User()
        user_data = user_model.verify_password(username, password)
        
        if not user_data:
            return jsonify({'error': 'Invalid username or password'}), 401
        
        # Check if user is active
        if not user_data.get('is_active', True):
            return jsonify({'error': 'Account is deactivated'}), 401
        
        # Generate token
        token = generate_token(user_data)
        
        return jsonify({
            'message': 'Login successful',
            'token': token,
            'user': {
                'id': str(user_data['_id']),
                'username': user_data['username'],
                'email': user_data['email'],
                'role': user_data.get('role', 'user')
            }
        }), 200
        
    except Exception as e:
        logging.error(f"Login error: {str(e)}", exc_info=True)
        return jsonify({'error': f'Login failed: {str(e)}'}), 500

@auth_bp.route('/profile', methods=['GET'])
@token_required
def get_profile():
    """Get user profile (protected route)"""
    try:
        user = request.current_user
        return jsonify({
            'user': {
                'id': str(user['_id']),
                'username': user['username'],
                'email': user['email'],
                'created_at': user['created_at'].isoformat() if user.get('created_at') else None
            }
        }), 200
    except Exception as e:
        return jsonify({'error': f'Failed to get profile: {str(e)}'}), 500

@auth_bp.route('/verify-token', methods=['POST'])
@token_required
def verify_token():
    """Verify if token is valid"""
    try:
        user = request.current_user
        return jsonify({
            'valid': True,
            'user': {
                'id': str(user['_id']),
                'username': user['username'],
                'email': user['email'],
                'role': user.get('role', 'user')
            }
        }), 200
    except Exception as e:
        return jsonify({'error': f'Token verification failed: {str(e)}'}), 500

@auth_bp.route('/create-admin', methods=['POST'])
def create_admin():
    """Create admin user - for development/setup only"""
    try:
        # Simple security check - only allow if no admin exists or specific key provided
        import os
        admin_key = request.headers.get('X-Admin-Key')
        if admin_key != os.environ.get('ADMIN_CREATION_KEY', 'dev-admin-key-123'):
            return jsonify({'error': 'Unauthorized admin creation'}), 403
        
        data = request.get_json()
        
        # Validate required fields
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        username = data.get('username', '').strip()
        email = data.get('email', '').strip()
        password = data.get('password', '')
        
        if not username or not email or not password:
            return jsonify({'error': 'Username, email, and password are required'}), 400
        
        # Validate email format
        if not validate_email(email):
            return jsonify({'error': 'Invalid email format'}), 400
        
        # Validate password strength
        is_valid, password_error = validate_password(password)
        if not is_valid:
            return jsonify({'error': password_error}), 400
        
        # Create admin user
        user_model = User()
        user_data, error = user_model.create_admin_user(username, email, password)
        
        if error:
            return jsonify({'error': error}), 400
        
        return jsonify({
            'message': 'Admin user created successfully',
            'user': {
                'id': str(user_data['_id']),
                'username': user_data['username'],
                'email': user_data['email'],
                'role': user_data['role']
            }
        }), 201
        
    except Exception as e:
        return jsonify({'error': f'Admin creation failed: {str(e)}'}), 500
