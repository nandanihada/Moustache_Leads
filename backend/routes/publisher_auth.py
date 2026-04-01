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
        
        # Consent fields
        optional_fields['terms_accepted'] = bool(data.get('terms_accepted', False))
        optional_fields['terms_accepted_at'] = datetime.utcnow() if data.get('terms_accepted') else None
        optional_fields['newsletter_consent'] = bool(data.get('newsletter_consent', False))
        optional_fields['newsletter_consent_at'] = datetime.utcnow() if data.get('newsletter_consent') else None
        
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
        
        # Handle referral code if provided
        referral_code = data.get('referral_code', '').strip()
        referral_program = data.get('referral_program', '1').strip()
        if referral_code:
            try:
                import requests as http_requests
                from models.referral import Referral
                ref_model = Referral()
                link = ref_model.find_referrer_by_code(referral_code)
                if link and link['user_id'] != str(user_data['_id']):
                    ip_address = request.headers.get('X-Forwarded-For', request.remote_addr)
                    device_fingerprint = data.get('device_fingerprint', '')
                    user_agent_str = request.headers.get('User-Agent', '')
                    
                    if referral_program == '1':
                        p1_doc, p1_err = ref_model.create_p1_referral(
                            link['user_id'], str(user_data['_id']), email, username,
                            ip_address, device_fingerprint, user_agent_str
                        )
                        if p1_doc and not p1_err:
                            from services.referral_fraud_service import referral_fraud_service
                            fraud_score, status, checks = referral_fraud_service.run_fraud_checks(p1_doc)
                            ref_model.update_p1_fraud_result(p1_doc['_id'], fraud_score, status)
                            if status == 'approved':
                                ref_model.release_p1_bonus(p1_doc['_id'])
                    elif referral_program == '2':
                        ref_model.create_p2_referral(
                            link['user_id'], str(user_data['_id']), email, username
                        )
                    
                    # Mark user as referred
                    from database import db_instance
                    users_col = db_instance.get_collection('users')
                    if users_col:
                        users_col.update_one(
                            {'_id': user_data['_id']},
                            {'$set': {
                                'referred_by': link['user_id'],
                                'referral_code_used': referral_code,
                                'referral_program': referral_program,
                                'referred_at': datetime.utcnow()
                            }}
                        )
                    logging.info(f"✅ Referral P{referral_program} processed for new user {username} via code {referral_code}")
            except Exception as ref_err:
                logging.error(f"⚠️ Referral processing error (non-blocking): {ref_err}")
        
        # Generate referral link for the new user
        try:
            from models.referral import Referral
            ref_model = Referral()
            ref_model.get_or_create_referral_link(str(user_data['_id']))
        except Exception as ref_link_err:
            logging.error(f"⚠️ Could not create referral link for new user: {ref_link_err}")
        
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
        from database import db_instance
        logging.info(f"🔍 Publisher login attempt for: {username}")
        logging.info(f"🔍 DB connected: {db_instance.is_connected()}")
        
        user_model = User()
        db_ok = user_model._check_db_connection()
        logging.info(f"🔍 User model DB check: {db_ok}")
        
        if not db_ok:
            logging.error(f"❌ Database connection failed during login for: {username}")
        
        user_data = user_model.verify_password(username, password)
        logging.info(f"🔍 verify_password result: {'found user' if user_data else 'None (no match)'}")
        
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
