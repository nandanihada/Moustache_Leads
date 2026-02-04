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
login_logs_collection = db_instance.get_collection('login_logs')

def log_signup_attempt(data: dict, status: str, error_message: str = None):
    """Log signup attempt for admin visibility - logs to both signup_attempts and login_logs"""
    try:
        # Get IP address
        if request.headers.get('X-Forwarded-For'):
            ip_address = request.headers.get('X-Forwarded-For').split(',')[0].strip()
        elif request.headers.get('X-Real-IP'):
            ip_address = request.headers.get('X-Real-IP')
        else:
            ip_address = request.remote_addr
        
        # Get location from IP
        location = {'city': 'Unknown', 'region': 'Unknown', 'country': 'Unknown', 'country_code': 'XX'}
        try:
            from services.ipinfo_service import get_ipinfo_service
            ipinfo_service = get_ipinfo_service()
            ip_data = ipinfo_service.lookup_ip(ip_address)
            if ip_data:
                location = {
                    'city': ip_data.get('city', 'Unknown'),
                    'region': ip_data.get('region', 'Unknown'),
                    'country': ip_data.get('country', 'Unknown'),
                    'country_code': ip_data.get('country_code', 'XX'),
                    'isp': ip_data.get('isp', 'Unknown')
                }
        except Exception as loc_err:
            logging.warning(f"Could not get location for signup: {loc_err}")
        
        attempt = {
            'username': data.get('username', ''),
            'email': data.get('email', ''),
            'status': status,  # 'started', 'validation_failed', 'success', 'error'
            'error_message': error_message,
            'ip_address': ip_address,
            'user_agent': request.headers.get('User-Agent', ''),
            'timestamp': datetime.utcnow(),
            'first_name': data.get('first_name', ''),
            'last_name': data.get('last_name', ''),
            'company_name': data.get('company_name', ''),
            'website': data.get('website', ''),
            'location': location
        }
        signup_attempts_collection.insert_one(attempt)
        
        # Also log to login_logs for unified view
        login_log_entry = {
            'user_id': None,  # No user ID yet for signup
            'email': data.get('email', ''),
            'username': data.get('username', ''),
            'login_time': datetime.utcnow(),
            'logout_time': None,
            'ip_address': ip_address,
            'device': {
                'type': 'unknown',
                'os': 'Unknown',
                'browser': 'Unknown'
            },
            'location': location,
            'login_method': 'signup',  # Mark as signup attempt
            'status': 'signup_' + status,  # signup_success, signup_error, etc.
            'failure_reason': error_message,
            'session_id': None,
            'user_agent': request.headers.get('User-Agent', ''),
            'is_signup_attempt': True  # Flag to identify signup attempts
        }
        login_logs_collection.insert_one(login_log_entry)
        
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
        import ssl
        
        # Get email configuration - using new Hostinger SMTP variables
        smtp_host = os.getenv('SMTP_HOST', 'smtp.hostinger.com')
        smtp_port = os.getenv('SMTP_PORT', '465')
        smtp_user = os.getenv('SMTP_USER')
        smtp_pass = os.getenv('SMTP_PASS')
        from_email = os.getenv('FROM_EMAIL')
        email_debug = os.getenv('EMAIL_DEBUG', 'false')
        frontend_url = os.getenv('FRONTEND_URL', 'https://moustacheleads.com')
        
        # Check configuration status
        config_status = {
            'smtp_host': smtp_host,
            'smtp_port': smtp_port,
            'smtp_user_set': bool(smtp_user),
            'smtp_pass_set': bool(smtp_pass),
            'from_email': from_email,
            'email_debug_mode': email_debug,
            'frontend_url': frontend_url,
            'is_fully_configured': all([smtp_host, smtp_user, smtp_pass, from_email])
        }
        
        # Test SMTP connection (without sending) - using SSL on port 465
        connection_test = {'status': 'not_tested', 'message': ''}
        try:
            import smtplib
            context = ssl.create_default_context()
            with smtplib.SMTP_SSL(smtp_host, int(smtp_port), context=context, timeout=10) as server:
                if smtp_user and smtp_pass:
                    server.login(smtp_user, smtp_pass)
                    connection_test = {'status': 'success', 'message': 'SMTP SSL connection and authentication successful'}
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


@auth_bp.route('/admin/test-ip-lookup', methods=['GET'])
@token_required
def test_ip_lookup():
    """Test IP lookup service - returns location data for current request IP"""
    try:
        from services.ipinfo_service import get_ipinfo_service
        
        # Get client IP
        if request.headers.get('X-Forwarded-For'):
            ip_address = request.headers.get('X-Forwarded-For').split(',')[0].strip()
        elif request.headers.get('X-Real-IP'):
            ip_address = request.headers.get('X-Real-IP')
        else:
            ip_address = request.remote_addr
        
        # Optional: test with a specific IP
        test_ip = request.args.get('ip', ip_address)
        
        # Lookup IP
        ipinfo_service = get_ipinfo_service()
        ip_data = ipinfo_service.lookup_ip(test_ip)
        
        return jsonify({
            'success': True,
            'tested_ip': test_ip,
            'service_enabled': ipinfo_service.enabled,
            'ip_data': ip_data
        }), 200
        
    except Exception as e:
        logging.error(f"Error in IP lookup test: {str(e)}", exc_info=True)
        return jsonify({'error': f'IP lookup test failed: {str(e)}'}), 500


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
        
        # Handle legacy users without account_status - default to pending_approval
        account_status = user_data.get('account_status', 'pending_approval')
        # Admins are always approved
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
                'account_status': account_status,
                'email_verified': user_data.get('email_verified', False)
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
    """Verify email using verification token - shows account under review message"""
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
            
            # NOTE: Email 2 (Application Under Review) is now sent when ADMIN APPROVES
            # Not automatically after email verification
            
            # Return success with account_status - NO auto-login
            # User must wait for admin approval
            return jsonify({
                'message': 'Email verified successfully. Your account is under review.',
                'email_verified': True,
                'account_status': user_data.get('account_status', 'pending_approval'),
                'auto_login': False,  # Don't auto-login - account needs approval
                'user': {
                    'id': str(user_data['_id']),
                    'username': user_data['username'],
                    'email': user_data['email'],
                    'email_verified': True,
                    'account_status': user_data.get('account_status', 'pending_approval'),
                    'account_status': user_data.get('account_status', 'pending_approval'),
                    'role': user_data.get('role', 'user'),
                    'first_name': user_data.get('first_name'),
                    'last_name': user_data.get('last_name'),
                    'company_name': user_data.get('company_name'),
                    'website': user_data.get('website')
                }
            }), 200
        else:
            return jsonify({'error': 'Failed to verify email'}), 500
        
    except Exception as e:
        logging.error(f"Email verification error: {str(e)}", exc_info=True)
        return jsonify({'error': f'Email verification failed: {str(e)}'}), 500


# ============ Admin User Approval Endpoints ============

@auth_bp.route('/admin/pending-users', methods=['GET'])
@token_required
def get_pending_users():
    """Get all users pending approval (admin only)"""
    try:
        user = request.current_user
        
        # Check if user is admin
        if user.get('role') != 'admin':
            return jsonify({'error': 'Admin access required'}), 403
        
        user_model = User()
        pending_users = user_model.get_pending_users()
        
        return jsonify({
            'users': pending_users,
            'total': len(pending_users)
        }), 200
        
    except Exception as e:
        logging.error(f"Error getting pending users: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to get pending users: {str(e)}'}), 500


@auth_bp.route('/admin/users', methods=['GET'])
@token_required
def get_all_users():
    """Get all users with optional status filter (admin only)"""
    try:
        user = request.current_user
        
        # Check if user is admin
        if user.get('role') != 'admin':
            return jsonify({'error': 'Admin access required'}), 403
        
        status_filter = request.args.get('status')  # pending_approval, approved, rejected
        
        user_model = User()
        users = user_model.get_all_users_with_status(status_filter)
        
        # Get counts for each status - need to handle legacy users without account_status
        all_users = user_model.get_all_users_with_status()
        pending_count = len([u for u in all_users if u.get('account_status', 'pending_approval') == 'pending_approval'])
        approved_count = len([u for u in all_users if u.get('account_status') == 'approved'])
        rejected_count = len([u for u in all_users if u.get('account_status') == 'rejected'])
        
        return jsonify({
            'users': users,
            'total': len(users),
            'counts': {
                'pending': pending_count,
                'approved': approved_count,
                'rejected': rejected_count,
                'total': len(all_users)
            }
        }), 200
        
    except Exception as e:
        logging.error(f"Error getting users: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to get users: {str(e)}'}), 500


@auth_bp.route('/admin/users/<user_id>/approve', methods=['POST'])
@token_required
def approve_user(user_id):
    """Approve a user account and send activation email (admin only)"""
    try:
        admin_user = request.current_user
        
        # Check if user is admin
        if admin_user.get('role') != 'admin':
            return jsonify({'error': 'Admin access required'}), 403
        
        user_model = User()
        
        # Get user data before approval
        user_data = user_model.find_by_id(user_id)
        if not user_data:
            return jsonify({'error': 'User not found'}), 404
        
        # Approve user
        success, message = user_model.approve_user(user_id, str(admin_user['_id']))
        
        if success:
            logging.info(f"✅ User {user_id} approved by admin {admin_user['_id']}")
            
            # Send activation email - try synchronously first for reliability
            email_sent = False
            email_error = None
            try:
                verification_service = get_email_verification_service()
                email = user_data.get('email')
                name = user_data.get('first_name') or user_data.get('username', 'User')
                
                logging.info(f"📧 Attempting to send activation email to {email}")
                logging.info(f"📧 Email service configured: {verification_service.is_configured}")
                
                if verification_service.is_configured:
                    email_sent = verification_service.send_application_under_review_email(email, name)
                    if email_sent:
                        logging.info(f"✅ Activation email SENT to {email}")
                    else:
                        logging.warning(f"⚠️ Failed to send activation email to {email}")
                        email_error = "Email service returned false"
                else:
                    logging.warning(f"⚠️ Email service not configured - cannot send activation email")
                    email_error = "Email service not configured"
            except Exception as e:
                logging.error(f"❌ Error sending activation email: {str(e)}", exc_info=True)
                email_error = str(e)
            
            return jsonify({
                'message': 'User approved successfully.',
                'user_id': user_id,
                'email_sent': email_sent,
                'email_error': email_error
            }), 200
        else:
            return jsonify({'error': message}), 400
        
    except Exception as e:
        logging.error(f"Error approving user: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to approve user: {str(e)}'}), 500


@auth_bp.route('/admin/users/<user_id>/reject', methods=['POST'])
@token_required
def reject_user(user_id):
    """Reject a user account (admin only)"""
    try:
        admin_user = request.current_user
        
        # Check if user is admin
        if admin_user.get('role') != 'admin':
            return jsonify({'error': 'Admin access required'}), 403
        
        data = request.get_json() or {}
        reason = data.get('reason', 'No reason provided')
        
        user_model = User()
        success, message = user_model.reject_user(user_id, str(admin_user['_id']), reason)
        
        if success:
            logging.info(f"❌ User {user_id} rejected by admin {admin_user['_id']} - Reason: {reason}")
            return jsonify({
                'message': 'User rejected',
                'user_id': user_id
            }), 200
        else:
            return jsonify({'error': message}), 400
        
    except Exception as e:
        logging.error(f"Error rejecting user: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to reject user: {str(e)}'}), 500


@auth_bp.route('/admin/auto-approve-check', methods=['POST'])
@token_required
def run_auto_approval():
    """Manually trigger auto-approval check for users pending > 3 days (admin only)"""
    try:
        admin_user = request.current_user
        
        # Check if user is admin
        if admin_user.get('role') != 'admin':
            return jsonify({'error': 'Admin access required'}), 403
        
        user_model = User()
        users_to_approve = user_model.get_users_for_auto_approval(days=3)
        
        approved_count = 0
        verification_service = get_email_verification_service()
        
        for user_data in users_to_approve:
            user_id = user_data['_id']
            if user_model.auto_approve_user(user_id):
                approved_count += 1
                logging.info(f"✅ Auto-approved user {user_id}")
                
                # Send approval email
                import threading
                def send_email(email, name):
                    try:
                        verification_service.send_application_under_review_email(email, name)
                    except Exception as e:
                        logging.error(f"Failed to send auto-approval email: {e}")
                
                email = user_data.get('email')
                name = user_data.get('first_name') or user_data.get('username', 'User')
                threading.Thread(target=send_email, args=(email, name), daemon=True).start()
        
        return jsonify({
            'message': f'Auto-approval check complete. {approved_count} users approved.',
            'approved_count': approved_count,
            'checked_count': len(users_to_approve)
        }), 200
        
    except Exception as e:
        logging.error(f"Error in auto-approval: {str(e)}", exc_info=True)
        return jsonify({'error': f'Auto-approval failed: {str(e)}'}), 500

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
        user_id = str(user.get('_id', user.get('id', '')))
        
        # Check if email is already verified
        if user.get('email_verified'):
            return jsonify({'error': 'Email is already verified'}), 400
        
        # Send verification email asynchronously (non-blocking)
        # This prevents worker timeout if email service is slow
        import threading
        
        def send_email_async():
            """Send verification email in background thread"""
            try:
                verification_service = get_email_verification_service()
                
                # Delete old token and generate new one
                if verification_service.verification_collection:
                    verification_service.verification_collection.delete_many({'email': email})
                
                verification_token = verification_service.generate_verification_token(email, user_id)
                
                if verification_token:
                    email_sent = verification_service.send_verification_email(email, verification_token, username)
                    if email_sent:
                        logging.info(f"✅ Verification email resent to {email}")
                    else:
                        logging.warning(f"⚠️ Failed to resend verification email to {email}")
                else:
                    logging.warning(f"⚠️ Failed to generate verification token for {email}")
            except Exception as e:
                logging.error(f"❌ Background email error for {email}: {str(e)}")
        
        # Start email sending in background thread
        email_thread = threading.Thread(target=send_email_async, daemon=True)
        email_thread.start()
        
        logging.info(f"📧 Verification email queued for resend to {email}")
        return jsonify({
            'message': 'Verification email has been queued. Please check your inbox.',
            'email': email
        }), 200
        
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
