"""Advertiser authentication routes - separate from Publisher auth"""
from flask import Blueprint, request, jsonify
from models.advertiser import Advertiser
from utils.auth import generate_token, token_required
from services.email_verification_service import get_email_verification_service
import logging
import re
import threading
import os
from datetime import datetime

advertiser_auth_bp = Blueprint('advertiser_auth', __name__)

def validate_email(email):
    """Validate email format"""
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(pattern, email) is not None

def validate_url(url):
    """Validate URL starts with http:// or https://"""
    return url.startswith('http://') or url.startswith('https://')

@advertiser_auth_bp.route('/register', methods=['POST'])
def register_advertiser():
    """Register a new advertiser account"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        # Required field validation
        required_fields = [
            ('firstName', 'First Name'),
            ('lastName', 'Last Name'),
            ('email', 'Email'),
            ('emailConfirmation', 'Email Confirmation'),
            ('phoneNumber', 'Phone Number'),
            ('password', 'Password'),
            ('passwordConfirmation', 'Password Confirmation'),
            ('companyName', 'Company Name'),
            ('websiteUrl', 'Website URL'),
            ('offerLandingPage', 'Offer Landing Page'),
            ('address', 'Address'),
            ('country', 'Country'),
            ('city', 'City'),
            ('zipCode', 'ZIP/Postal Code'),
            ('accountingContactName', 'Accounting Contact Name'),
            ('accountingContactNumber', 'Accounting Contact Number'),
            ('accountingContactEmail', 'Accounting Contact Email'),
            ('paymentAgreement', 'Payment Agreement'),
            ('paymentTerms', 'Payment Terms'),
            ('einVatNumber', 'EIN/VAT Number'),
        ]
        
        for field, label in required_fields:
            if not data.get(field, '').strip():
                return jsonify({'error': f'{label} is required'}), 400
        
        # Email format validation
        if not validate_email(data.get('email', '')):
            return jsonify({'error': 'Invalid email format'}), 400
        
        if not validate_email(data.get('accountingContactEmail', '')):
            return jsonify({'error': 'Invalid accounting contact email format'}), 400
        
        # Email confirmation match
        if data.get('email', '').lower() != data.get('emailConfirmation', '').lower():
            return jsonify({'error': 'Email addresses do not match'}), 400
        
        # Password validation
        if len(data.get('password', '')) < 6:
            return jsonify({'error': 'Password must be at least 6 characters'}), 400
        
        if data.get('password') != data.get('passwordConfirmation'):
            return jsonify({'error': 'Passwords do not match'}), 400
        
        # URL format validation
        if not validate_url(data.get('websiteUrl', '')):
            return jsonify({'error': 'Website URL must start with http:// or https://'}), 400
        
        if not validate_url(data.get('offerLandingPage', '')):
            return jsonify({'error': 'Offer Landing Page URL must start with http:// or https://'}), 400
        
        # Checkbox validations
        if not data.get('noMinimumThresholdAgreed'):
            return jsonify({'error': 'You must agree to the No Minimum Threshold terms'}), 400
        
        if not data.get('termsAgreed'):
            return jsonify({'error': 'You must agree to the Terms and Conditions'}), 400
        
        # Create advertiser
        advertiser_model = Advertiser()
        advertiser_data, error = advertiser_model.create_advertiser(data)
        
        if error:
            return jsonify({'error': error}), 400
        
        # Generate verification token SYNCHRONOUSLY
        frontend_url = request.headers.get('Origin') or os.getenv('FRONTEND_URL', 'https://moustacheleads.com')
        verification_service = get_email_verification_service()
        verification_token = verification_service.generate_verification_token(
            advertiser_data['email'],
            str(advertiser_data['_id']),
            frontend_url=frontend_url
        )
        
        # Capture the base URL from request in the request context thread
        base_url = request.url_root.rstrip('/')

        if not verification_token:
            logging.warning(f"⚠️ Failed to generate verification token for advertiser {advertiser_data['email']}")
        else:
            logging.info(f"📧 [TESTING] Verification Link: {frontend_url}/verify-email?token={verification_token}")
            logging.info(f"📧 [TESTING] Backend Link: {base_url}/api/auth/verify-email-link?token={verification_token}")

        # Send verification email asynchronously
        def send_email_async(token_to_send, email_to, username_to, base_url_to):
            try:
                email_service = get_email_verification_service()
                if token_to_send:
                    email_sent = email_service.send_verification_email(
                        email_to,
                        token_to_send,
                        username_to,
                        base_url=base_url_to
                    )
                    if email_sent:
                        logging.info(f"✅ Verification email sent to advertiser {email_to} with base_url {base_url_to}")
                    else:
                        logging.warning(f"⚠️ Failed to send verification email to advertiser {email_to}")
            except Exception as e:
                logging.error(f"❌ Background email error for advertiser verification: {str(e)}")
                
        if verification_token:
            email_thread = threading.Thread(
                target=send_email_async,
                args=(verification_token, advertiser_data['email'], advertiser_data.get('first_name', 'Advertiser'), base_url),
                daemon=True
            )
            email_thread.start()
            logging.info(f"📧 Verification email queued for advertiser {advertiser_data['email']}")
        
        # Handle referral code if provided (P2 — Commission Share for advertisers)
        referral_code = data.get('referral_code', '').strip() if data else ''
        referral_program = data.get('referral_program', '2').strip() if data else '2'
        if referral_code:
            try:
                from models.referral import Referral
                ref_model = Referral()
                link = ref_model.find_referrer_by_code(referral_code)
                if link and link['user_id'] != str(advertiser_data['_id']):
                    # Only create P2 for advertiser signups (p=2)
                    if referral_program == '2':
                        ref_model.create_p2_referral(
                            link['user_id'], str(advertiser_data['_id']),
                            advertiser_data['email'],
                            advertiser_data.get('first_name', '') + ' ' + advertiser_data.get('last_name', '')
                        )
                    
                    # Mark advertiser as referred
                    from database import db_instance
                    advertisers_col = db_instance.get_collection('advertisers')
                    if advertisers_col:
                        advertisers_col.update_one(
                            {'_id': advertiser_data['_id']},
                            {'$set': {
                                'referred_by': link['user_id'],
                                'referral_code_used': referral_code,
                                'referral_program': referral_program,
                                'referred_at': datetime.utcnow()
                             }}
                        )
                    logging.info(f"✅ Referral P{referral_program} processed for advertiser {advertiser_data['email']}")
            except Exception as ref_err:
                logging.error(f"⚠️ Advertiser referral processing error (non-blocking): {ref_err}")
        
        return jsonify({
            'message': 'Advertiser registered successfully. Please check your email (and check your spam/junk folder) to verify your account.',
            'email_verification_required': True,
            'user': {
                'id': str(advertiser_data['_id']),
                'email': advertiser_data['email'],
                'first_name': advertiser_data['first_name'],
                'last_name': advertiser_data['last_name'],
                'company_name': advertiser_data['company_name'],
                'user_type': 'advertiser',
                'account_status': advertiser_data.get('account_status', 'pending_approval'),
                'email_verified': False
            }
        }), 201
        
    except Exception as e:
        logging.error(f"Advertiser registration error: {str(e)}", exc_info=True)
        return jsonify({'error': f'Registration failed: {str(e)}'}), 500


@advertiser_auth_bp.route('/login', methods=['POST'])
def login_advertiser():
    """Authenticate an advertiser"""
    try:
        from services.activity_tracking_service import activity_tracking_service
        
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        email = data.get('email', '').strip()
        password = data.get('password', '')
        public_ip = data.get('public_ip')
        
        if not email:
            return jsonify({'error': 'Email is required'}), 400
        
        if not password:
            return jsonify({'error': 'Password is required'}), 400
        
        # Verify credentials
        advertiser_model = Advertiser()
        advertiser_data = advertiser_model.verify_password(email, password)
        
        if not advertiser_data:
            # Track failed login attempt
            failed_user_data = {
                '_id': email,
                'email': email,
                'username': email
            }
            activity_tracking_service.track_login_attempt(
                failed_user_data,
                request,
                status='failed',
                failure_reason='wrong_password',
                login_method='password',
                ip_address=public_ip
            )
            return jsonify({'error': 'Invalid email or password'}), 401
        
        # Check email verification
        if not advertiser_data.get('email_verified', False):
            activity_tracking_service.track_login_attempt(
                advertiser_data,
                request,
                status='failed',
                failure_reason='email_not_verified',
                login_method='password',
                ip_address=public_ip
            )
            return jsonify({
                'error': 'Please verify your email before logging in. Check your inbox for the verification link.',
                'email_not_verified': True,
                'email': advertiser_data.get('email', '')
            }), 403
        
        # Check if account is active
        if not advertiser_data.get('is_active', True):
            activity_tracking_service.track_login_attempt(
                advertiser_data,
                request,
                status='failed',
                failure_reason='account_deactivated',
                login_method='password',
                ip_address=public_ip
            )
            return jsonify({'error': 'Account is deactivated'}), 401
        
        # Track successful login and create session
        session_id = activity_tracking_service.track_login_attempt(
            advertiser_data,
            request,
            status='success',
            login_method='password',
            ip_address=public_ip
        )
        
        # Generate token with user_type
        token = generate_token(advertiser_data, user_type='advertiser')
        
        logging.info(f"✅ Advertiser logged in: {advertiser_data['email']}, session: {session_id}")
        
        return jsonify({
            'message': 'Login successful',
            'token': token,
            'session_id': session_id,
            'user': {
                'id': str(advertiser_data['_id']),
                'email': advertiser_data['email'],
                'first_name': advertiser_data['first_name'],
                'last_name': advertiser_data['last_name'],
                'company_name': advertiser_data['company_name'],
                'user_type': 'advertiser',
                'account_status': advertiser_data.get('account_status', 'pending_approval'),
                'email_verified': advertiser_data.get('email_verified', False)
            }
        }), 200
        
    except Exception as e:
        logging.error(f"Advertiser login error: {str(e)}", exc_info=True)
        return jsonify({'error': 'Login failed'}), 500


@advertiser_auth_bp.route('/profile', methods=['GET'])
@token_required
def get_advertiser_profile():
    """Get advertiser profile (protected)"""
    try:
        user = request.current_user
        
        # Verify this is an advertiser
        if user.get('user_type') != 'advertiser':
            return jsonify({'error': 'Not an advertiser account'}), 403
        
        return jsonify({
            'user': {
                'id': str(user['_id']),
                'email': user['email'],
                'first_name': user.get('first_name'),
                'last_name': user.get('last_name'),
                'company_name': user.get('company_name'),
                'phone_number': user.get('phone_number'),
                'website_url': user.get('website_url'),
                'user_type': 'advertiser',
                'account_status': user.get('account_status', 'pending_approval'),
                'email_verified': user.get('email_verified', False),
                'created_at': user['created_at'].isoformat() if user.get('created_at') else None
            }
        }), 200
    except Exception as e:
        return jsonify({'error': f'Failed to get profile: {str(e)}'}), 500
