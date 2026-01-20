from flask import Blueprint, request, jsonify
from models.user import User
from utils.auth import generate_token, token_required
from services.email_verification_service import get_email_verification_service
import re
import logging
from datetime import datetime
from database import db_instance

auth_bp = Blueprint('auth', __name__)

# Collection for tracking signup attempts
signup_attempts_collection = db_instance.get_collection('signup_attempts')

def log_signup_attempt(data: dict, status: str, error_message: str = None):
    """Log signup attempt for admin visibility"""
    try:
        attempt = {
            'username': data.get('username', ''),
            'email': data.get('email', ''),
            'status': status,  # 'started', 'validation_failed', 'success', 'error'
            'error_message': error_message,
            'ip_address': request.remote_addr,
            'user_agent': request.headers.get('User-Agent', ''),
            'timestamp': datetime.utcnow(),
            'first_name': data.get('first_name', ''),
            'last_name': data.get('last_name', ''),
            'company_name': data.get('company_name', ''),
            'website': data.get('website', '')
        }
        signup_attempts_collection.insert_one(attempt)
        logging.info(f"📝 Signup attempt logged: {data.get('email', 'unknown')} - {status}")
    except Exception as e:
        logging.error(f"Failed to log signup attempt: {str(e)}")

def validate_email(email):
    """Validate email format"""
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(pattern, email) is not None

def validate_password(password):
    """Validate password strength"""
    if len(password) < 6:
        return False, "Password must be at least 6 characters long"
    return True, ""

@auth_bp.route('/admin/signup-attempts', methods=['GET'])
@token_required
def get_signup_attempts():
    """Get signup attempts for admin (requires admin role)"""
    try:
        user = request.current_user
        
        # Check if user is admin
        if user.get('role') != 'admin':
            return jsonify({'error': 'Admin access required'}), 403
        
        # Get query parameters
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 50))
        status_filter = request.args.get('status')  # 'started', 'validation_failed', 'success', 'error'
        
        # Build query
        query = {}
        if status_filter:
            query['status'] = status_filter
        
        # Get total count
        total = signup_attempts_collection.count_documents(query)
        
        # Get attempts with pagination
        attempts = list(signup_attempts_collection.find(query)
            .sort('timestamp', -1)
            .skip((page - 1) * per_page)
            .limit(per_page))
        
        # Convert ObjectId to string
        for attempt in attempts:
            attempt['_id'] = str(attempt['_id'])
            if attempt.get('timestamp'):
                attempt['timestamp'] = attempt['timestamp'].isoformat()
        
        return jsonify({
            'attempts': attempts,
            'pagination': {
                'page': page,
                'per_page': per_page,
                'total': total,
                'pages': (total + per_page - 1) // per_page
            },
            'summary': {
                'total_attempts': signup_attempts_collection.count_documents({}),
                'successful': signup_attempts_collection.count_documents({'status': 'success'}),
                'failed': signup_attempts_collection.count_documents({'status': {'$in': ['validation_failed', 'error']}}),
                'started_only': signup_attempts_collection.count_documents({'status': 'started'})
            }
        }), 200
        
    except Exception as e:
        logging.error(f"Error getting signup attempts: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to get signup attempts: {str(e)}'}), 500

@auth_bp.route('/admin/email-diagnostic', methods=['GET'])
@token_required
def email_diagnostic():
    """Check email configuration status (requires admin role)"""
    try:
        user = request.current_user
        
        # Check if user is admin
        if user.get('role') != 'admin':
            return jsonify({'error': 'Admin access required'}), 403
        
        import os
        
        # Get email configuration
        smtp_server = os.getenv('SMTP_SERVER', 'smtp.gmail.com')
        smtp_port = os.getenv('SMTP_PORT', '587')
        smtp_username = os.getenv('SMTP_USERNAME')
        smtp_password = os.getenv('SMTP_PASSWORD')
        from_email = os.getenv('FROM_EMAIL')
        email_debug = os.getenv('EMAIL_DEBUG', 'false')
        frontend_url = os.getenv('FRONTEND_URL', 'http://localhost:5173')
        
        # Check configuration status
        config_status = {
            'smtp_server': smtp_server,
            'smtp_port': smtp_port,
            'smtp_username_set': bool(smtp_username),
            'smtp_password_set': bool(smtp_password),
            'from_email': from_email,
            'email_debug_mode': email_debug,
            'frontend_url': frontend_url,
            'is_fully_configured': all([smtp_username, smtp_password, from_email])
        }
        
        # Test SMTP connection (without sending)
        connection_test = {'status': 'not_tested', 'message': ''}
        try:
            import smtplib
            with smtplib.SMTP(smtp_server, int(smtp_port), timeout=10) as server:
                server.starttls()
                if smtp_username and smtp_password:
                    server.login(smtp_username, smtp_password)
                    connection_test = {'status': 'success', 'message': 'SMTP connection and authentication successful'}
                else:
                    connection_test = {'status': 'partial', 'message': 'SMTP connection successful but credentials not set'}
        except Exception as e:
            connection_test = {'status': 'failed', 'message': str(e)}
        
        return jsonify({
            'config': config_status,
            'connection_test': connection_test,
            'recommendations': []
        }), 200
        
    except Exception as e:
        logging.error(f"Error in email diagnostic: {str(e)}", exc_info=True)
        return jsonify({'error': f'Diagnostic failed: {str(e)}'}), 500

@auth_bp.route('/admin/test-email', methods=['POST'])
@token_required
def test_email():
    """Send a test email (requires admin role)"""
    try:
        user = request.current_user
        
        # Check if user is admin
        if user.get('role') != 'admin':
            return jsonify({'error': 'Admin access required'}), 403
        
        data = request.get_json() or {}
        test_email_address = data.get('email', user.get('email'))
        
        if not test_email_address:
            return jsonify({'error': 'Email address required'}), 400
        
        # Send test email
        verification_service = get_email_verification_service()
        
        if not verification_service.is_configured:
            return jsonify({
                'success': False,
                'message': 'Email service not configured. Check SMTP settings.'
            }), 400
        
        # Generate a test token
        test_token = verification_service.generate_verification_token(
            test_email_address,
            str(user.get('_id', 'test-user'))
        )
        
        if not test_token:
            return jsonify({
                'success': False,
                'message': 'Failed to generate verification token'
            }), 500
        
        # Send the email
        email_sent = verification_service.send_verification_email(
            test_email_address,
            test_token,
            user.get('username', 'Test User')
        )
        
        if email_sent:
            return jsonify({
                'success': True,
                'message': f'Test email sent to {test_email_address}'
            }), 200
        else:
            return jsonify({
                'success': False,
                'message': 'Failed to send test email. Check server logs for details.'
            }), 500
        
    except Exception as e:
        logging.error(f"Error sending test email: {str(e)}", exc_info=True)
        return jsonify({'error': f'Test email failed: {str(e)}'}), 500

@auth_bp.route('/register', methods=['POST'])
def register():
    """User registration endpoint with partner support"""
    try:
        data = request.get_json()
        
        # Log the signup attempt start
        log_signup_attempt(data or {}, 'started')
        
        # Validate required fields
        if not data:
            log_signup_attempt({}, 'validation_failed', 'No data provided')
            return jsonify({'error': 'No data provided'}), 400
        
        username = data.get('username', '').strip()
        email = data.get('email', '').strip()
        password = data.get('password', '')
        
        if not username:
            log_signup_attempt(data, 'validation_failed', 'Username is required')
            return jsonify({'error': 'Username is required'}), 400
        
        if not email:
            log_signup_attempt(data, 'validation_failed', 'Email is required')
            return jsonify({'error': 'Email is required'}), 400
        
        if not password:
            log_signup_attempt(data, 'validation_failed', 'Password is required')
            return jsonify({'error': 'Password is required'}), 400
        
        # Validate email format
        if not validate_email(email):
            log_signup_attempt(data, 'validation_failed', 'Invalid email format')
            return jsonify({'error': 'Invalid email format'}), 400
        
        # Validate password strength
        is_valid, password_error = validate_password(password)
        if not is_valid:
            log_signup_attempt(data, 'validation_failed', password_error)
            return jsonify({'error': password_error}), 400
        
        # Validate username length
        if len(username) < 3:
            log_signup_attempt(data, 'validation_failed', 'Username must be at least 3 characters long')
            return jsonify({'error': 'Username must be at least 3 characters long'}), 400
        
        # Extract optional partner fields
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
        if data.get('postback_method'):
            optional_fields['postback_method'] = data.get('postback_method')
        if data.get('role'):
            # Validate role
            allowed_roles = ['user', 'partner', 'admin']
            role = data.get('role')
            if role in allowed_roles:
                optional_fields['role'] = role
        
        # Create user
        user_model = User()
        user_data, error = user_model.create_user(username, email, password, **optional_fields)
        
        if error:
            log_signup_attempt(data, 'error', error)
            return jsonify({'error': error}), 400
        
        # Log successful registration
        log_signup_attempt(data, 'success')
        
        # Send verification email asynchronously (non-blocking)
        # This prevents worker timeout if email service is slow or unavailable
        import threading
        
        def send_email_async():
            """Send verification email in background thread"""
            try:
                verification_service = get_email_verification_service()
                verification_token = verification_service.generate_verification_token(
                    email, 
                    str(user_data['_id'])
                )
                
                if verification_token:
                    # Send verification email
                    email_sent = verification_service.send_verification_email(
                        email, 
                        verification_token, 
                        username
                    )
                    
                    if email_sent:
                        logging.info(f"✅ Verification email sent to {email}")
                    else:
                        logging.warning(f"⚠️ Failed to send verification email to {email}")
                else:
                    logging.warning(f"⚠️ Failed to generate verification token for {email}")
            except Exception as e:
                logging.error(f"❌ Background email error for {email}: {str(e)}")
        
        # Start email sending in background thread (daemon=True means it won't block app shutdown)
        email_thread = threading.Thread(target=send_email_async, daemon=True)
        email_thread.start()
        logging.info(f"📧 Verification email queued for {email}")
        
        # Generate token
        token = generate_token(user_data)
        
        return jsonify({
            'message': 'User registered successfully. Please check your email to verify your account.',
            'token': token,
            'email_verification_required': True,
            'user': {
                'id': str(user_data['_id']),
                'username': user_data['username'],
                'email': user_data['email'],
                'role': user_data.get('role', 'user'),
                'email_verified': user_data.get('email_verified', False),
                'first_name': user_data.get('first_name'),
                'last_name': user_data.get('last_name'),
                'company_name': user_data.get('company_name'),
                'website': user_data.get('website'),
                'postback_url': user_data.get('postback_url')
            }
        }), 201
        
    except Exception as e:
        return jsonify({'error': f'Registration failed: {str(e)}'}), 500

@auth_bp.route('/login', methods=['POST'])
def login():
    """User login endpoint"""
    try:
        from services.activity_tracking_service import activity_tracking_service
        
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
            # Track failed login attempt
            failed_user_data = {
                '_id': username,  # Use username as placeholder
                'email': username,
                'username': username
            }
            activity_tracking_service.track_login_attempt(
                failed_user_data,
                request,
                status='failed',
                failure_reason='wrong_password',
                login_method='password'
            )
            return jsonify({'error': 'Invalid username or password'}), 401
        
        # Check if user is active
        if not user_data.get('is_active', True):
            # Track failed login attempt
            activity_tracking_service.track_login_attempt(
                user_data,
                request,
                status='failed',
                failure_reason='account_deactivated',
                login_method='password'
            )
            return jsonify({'error': 'Account is deactivated'}), 401
        
        # Track successful login and create session
        session_id = activity_tracking_service.track_login_attempt(
            user_data,
            request,
            status='success',
            login_method='password'
        )
        
        # Generate token
        token = generate_token(user_data)
        
        return jsonify({
            'message': 'Login successful',
            'token': token,
            'session_id': session_id,
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
                'role': user.get('role', 'user'),
                'first_name': user.get('first_name'),
                'last_name': user.get('last_name'),
                'company_name': user.get('company_name'),
                'website': user.get('website'),
                'postback_url': user.get('postback_url'),
                'postback_method': user.get('postback_method', 'GET'),
                'created_at': user['created_at'].isoformat() if user.get('created_at') else None
            }
        }), 200
    except Exception as e:
        return jsonify({'error': f'Failed to get profile: {str(e)}'}), 500

@auth_bp.route('/profile/update', methods=['PUT'])
@token_required
def update_profile():
    """Update user profile (protected route)"""
    try:
        user = request.current_user
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        # Build update document
        update_doc = {}
        
        # Allowed fields for update
        allowed_fields = ['first_name', 'last_name', 'company_name', 'website', 'postback_url', 'postback_method']
        for field in allowed_fields:
            if field in data:
                update_doc[field] = data[field].strip() if isinstance(data[field], str) else data[field]
        
        if not update_doc:
            return jsonify({'error': 'No valid fields to update'}), 400
        
        # Update user in database
        user_model = User()
        success = user_model.update_user(str(user['_id']), update_doc)
        
        if success:
            # Get updated user data
            updated_user = user_model.find_by_id(str(user['_id']))
            return jsonify({
                'message': 'Profile updated successfully',
                'user': {
                    'id': str(updated_user['_id']),
                    'username': updated_user['username'],
                    'email': updated_user['email'],
                    'role': updated_user.get('role', 'user'),
                    'first_name': updated_user.get('first_name'),
                    'last_name': updated_user.get('last_name'),
                    'company_name': updated_user.get('company_name'),
                    'website': updated_user.get('website'),
                    'postback_url': updated_user.get('postback_url'),
                    'postback_method': updated_user.get('postback_method', 'GET')
                }
            }), 200
        else:
            return jsonify({'error': 'Failed to update profile'}), 500
        
    except Exception as e:
        return jsonify({'error': f'Failed to update profile: {str(e)}'}), 500

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

@auth_bp.route('/verify-email', methods=['POST'])
def verify_email():
    """Verify email using verification token"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        token = data.get('token', '').strip()
        
        if not token:
            return jsonify({'error': 'Verification token is required'}), 400
        
        # Verify token
        verification_service = get_email_verification_service()
        is_valid, email, user_id = verification_service.verify_email_token(token)
        
        if not is_valid:
            return jsonify({'error': 'Invalid or expired verification token'}), 400
        
        # Mark email as verified in user model
        user_model = User()
        if user_model.mark_email_verified(user_id):
            logging.info(f"✅ Email verified for user {user_id} ({email})")
            
            # Get updated user data
            user_data = user_model.find_by_id(user_id)
            
            return jsonify({
                'message': 'Email verified successfully',
                'user': {
                    'id': str(user_data['_id']),
                    'username': user_data['username'],
                    'email': user_data['email'],
                    'email_verified': user_data.get('email_verified', False),
                    'role': user_data.get('role', 'user')
                }
            }), 200
        else:
            return jsonify({'error': 'Failed to verify email'}), 500
        
    except Exception as e:
        logging.error(f"Email verification error: {str(e)}", exc_info=True)
        return jsonify({'error': f'Email verification failed: {str(e)}'}), 500

@auth_bp.route('/verification-status', methods=['GET'])
@token_required
def get_verification_status():
    """Get email verification status for current user"""
    try:
        user = request.current_user
        user_id = str(user['_id'])
        
        verification_service = get_email_verification_service()
        status = verification_service.get_verification_status(user_id)
        
        return jsonify({
            'email': user.get('email'),
            'email_verified': user.get('email_verified', False),
            'verification_status': status
        }), 200
        
    except Exception as e:
        logging.error(f"Error getting verification status: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to get verification status: {str(e)}'}), 500

@auth_bp.route('/resend-verification', methods=['POST'])
@token_required
def resend_verification():
    """Resend verification email to current user"""
    try:
        user = request.current_user
        email = user.get('email')
        username = user.get('username')
        
        # Check if email is already verified
        if user.get('email_verified'):
            return jsonify({'error': 'Email is already verified'}), 400
        
        # Resend verification email
        verification_service = get_email_verification_service()
        success, message = verification_service.resend_verification_email(email, username)
        
        if success:
            logging.info(f"✅ Verification email resent to {email}")
            return jsonify({
                'message': message,
                'email': email
            }), 200
        else:
            logging.warning(f"⚠️ Failed to resend verification email to {email}: {message}")
            return jsonify({'error': message}), 400
        
    except Exception as e:
        logging.error(f"Error resending verification email: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to resend verification email: {str(e)}'}), 500


@auth_bp.route('/forgot-password', methods=['POST'])
def forgot_password():
    """Request password reset email"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        email = data.get('email', '').strip()
        
        if not email:
            return jsonify({'error': 'Email is required'}), 400
        
        # Validate email format
        if not validate_email(email):
            return jsonify({'error': 'Invalid email format'}), 400
        
        # Find user by email
        user_model = User()
        user = user_model.find_by_email(email)
        
        if not user:
            # Don't reveal if email exists - return success anyway for security
            logging.warning(f"Password reset requested for non-existent email: {email}")
            return jsonify({
                'message': 'If an account exists with this email, you will receive password reset instructions.'
            }), 200
        
        # Send password reset email asynchronously
        import threading
        
        def send_reset_email_async():
            """Send password reset email in background thread"""
            try:
                verification_service = get_email_verification_service()
                reset_token = verification_service.generate_password_reset_token(
                    email,
                    str(user['_id'])
                )
                
                if reset_token:
                    email_sent = verification_service.send_password_reset_email(
                        email,
                        reset_token,
                        user.get('username', 'User')
                    )
                    
                    if email_sent:
                        logging.info(f"✅ Password reset email sent to {email}")
                    else:
                        logging.warning(f"⚠️ Failed to send password reset email to {email}")
                else:
                    logging.warning(f"⚠️ Failed to generate reset token for {email}")
            except Exception as e:
                logging.error(f"❌ Background password reset email error for {email}: {str(e)}")
        
        # Start email sending in background thread
        email_thread = threading.Thread(target=send_reset_email_async, daemon=True)
        email_thread.start()
        logging.info(f"📧 Password reset email queued for {email}")
        
        return jsonify({
            'message': 'If an account exists with this email, you will receive password reset instructions.'
        }), 200
        
    except Exception as e:
        logging.error(f"Forgot password error: {str(e)}", exc_info=True)
        return jsonify({'error': 'Failed to process password reset request'}), 500

@auth_bp.route('/reset-password', methods=['POST'])
def reset_password():
    """Reset password using reset token"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        token = data.get('token', '').strip()
        new_password = data.get('password', '')
        
        if not token:
            return jsonify({'error': 'Reset token is required'}), 400
        
        if not new_password:
            return jsonify({'error': 'New password is required'}), 400
        
        # Validate password strength
        is_valid, password_error = validate_password(new_password)
        if not is_valid:
            return jsonify({'error': password_error}), 400
        
        # Verify reset token
        verification_service = get_email_verification_service()
        is_valid, email, user_id = verification_service.verify_password_reset_token(token)
        
        if not is_valid:
            return jsonify({'error': 'Invalid or expired reset token'}), 400
        
        # Reset password
        user_model = User()
        success = user_model.reset_password(user_id, new_password)
        
        if success:
            logging.info(f"✅ Password reset successful for user {user_id} ({email})")
            return jsonify({
                'message': 'Password reset successfully. You can now login with your new password.'
            }), 200
        else:
            return jsonify({'error': 'Failed to reset password'}), 500
        
    except Exception as e:
        logging.error(f"Reset password error: {str(e)}", exc_info=True)
        return jsonify({'error': 'Failed to reset password'}), 500

@auth_bp.route('/logout', methods=['POST'])
@token_required
def logout():
    """User logout endpoint"""
    try:
        from services.activity_tracking_service import activity_tracking_service
        
        data = request.get_json() or {}
        session_id = data.get('session_id')
        
        if session_id:
            # Track logout
            activity_tracking_service.track_logout(session_id)
            logging.info(f"User logged out, session: {session_id}")
        
        return jsonify({'message': 'Logout successful'}), 200
        
    except Exception as e:
        logging.error(f"Logout error: {str(e)}", exc_info=True)
        return jsonify({'error': f'Logout failed: {str(e)}'}), 500
