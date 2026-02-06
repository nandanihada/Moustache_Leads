"""Publisher authentication routes - wraps existing auth with user_type"""
from flask import Blueprint, request, jsonify
from models.user import User
from utils.auth import generate_token, token_required
from services.email_verification_service import get_email_verification_service
import logging
import re
import threading
from datetime import datetime

publisher_auth_bp = Blueprint('publisher_auth', __name__)

def validate_email(email):
    """Validate email format"""
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(pattern, email) is not None

def validate_password(password):
    """Validate password strength"""
    if len(password) < 6:
        return False, "Password must be at least 6 characters long"
    return True, ""


@publisher_auth_bp.route('/register', methods=['POST'])
def register_publisher():
    """Register a new publisher - wraps existing auth/register with user_type"""
    try:
        data = request.get_json()
        
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
        
        if not validate_email(email):
            return jsonify({'error': 'Invalid email format'}), 400
        
        is_valid, password_error = validate_password(password)
        if not is_valid:
            return jsonify({'error': password_error}), 400
        
        if len(username) < 3:
            return jsonify({'error': 'Username must be at least 3 characters long'}), 400
        
        # Extract optional fields
        optional_fields = {}
        if data.get('first_name'):
            optional_fields['first_name'] = data.get('first_name').strip()
        if data.get('last_name'):
            optional_fields['last_name'] = data.get('last_name').strip()
        if data.get('company_name'):
            optional_fields['company_name'] = data.get('company_name').strip()
        if data.get('website'):
            optional_fields['website'] = data.get('website').strip()
        if data.get('postback_url'):
            optional_fields['postback_url'] = data.get('postback_url').strip()
        
        # Set role as partner by default for publishers
        optional_fields['role'] = data.get('role', 'partner')
        
        # Create user
        user_model = User()
        user_data, error = user_model.create_user(username, email, password, **optional_fields)
        
        if error:
            return jsonify({'error': error}), 400
        
        # Send verification email asynchronously
        def send_email_async():
            try:
                verification_service = get_email_verification_service()
                verification_token = verification_service.generate_verification_token(
                    email, 
                    str(user_data['_id'])
                )
                if verification_token:
                    verification_service.send_verification_email(email, verification_token, username)
            except Exception as e:
                logging.error(f"Background email error: {str(e)}")
        
        email_thread = threading.Thread(target=send_email_async, daemon=True)
        email_thread.start()
        
        # Generate token with user_type = publisher
        token = generate_token(user_data, user_type='publisher')
        
        return jsonify({
            'message': 'Publisher registered successfully. Please check your email to verify your account.',
            'token': token,
            'email_verification_required': True,
            'user': {
                'id': str(user_data['_id']),
                'username': user_data['username'],
                'email': user_data['email'],
                'role': user_data.get('role', 'user'),
                'user_type': 'publisher',
                'email_verified': user_data.get('email_verified', False),
                'first_name': user_data.get('first_name'),
                'last_name': user_data.get('last_name'),
                'company_name': user_data.get('company_name'),
                'website': user_data.get('website'),
                'postback_url': user_data.get('postback_url')
            }
        }), 201
        
    except Exception as e:
        logging.error(f"Publisher registration error: {str(e)}", exc_info=True)
        return jsonify({'error': f'Registration failed: {str(e)}'}), 500


@publisher_auth_bp.route('/login', methods=['POST'])
def login_publisher():
    """Authenticate a publisher - wraps existing auth/login with user_type"""
    try:
        from services.activity_tracking_service import activity_tracking_service
        
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        username = data.get('username', '').strip()
        password = data.get('password', '')
        
        if not username:
            return jsonify({'error': 'Username is required'}), 400
        
        if not password:
            return jsonify({'error': 'Password is required'}), 400
        
        # Verify credentials
        user_model = User()
        user_data = user_model.verify_password(username, password)
        
        if not user_data:
            return jsonify({'error': 'Invalid username or password'}), 401
        
        if not user_data.get('is_active', True):
            return jsonify({'error': 'Account is deactivated'}), 401
        
        # Track login
        session_id = activity_tracking_service.track_login_attempt(
            user_data,
            request,
            status='success',
            login_method='password'
        )
        
        # Generate token with user_type = publisher
        token = generate_token(user_data, user_type='publisher')
        
        # Handle legacy users without account_status
        account_status = user_data.get('account_status', 'pending_approval')
        if user_data.get('role') == 'admin':
            account_status = 'approved'
        
        return jsonify({
            'message': 'Login successful',
            'token': token,
            'session_id': session_id,
            'user': {
                'id': str(user_data['_id']),
                'username': user_data['username'],
                'email': user_data['email'],
                'role': user_data.get('role', 'user'),
                'user_type': 'publisher',
                'account_status': account_status,
                'email_verified': user_data.get('email_verified', False)
            }
        }), 200
        
    except Exception as e:
        logging.error(f"Publisher login error: {str(e)}", exc_info=True)
        return jsonify({'error': 'Login failed'}), 500
