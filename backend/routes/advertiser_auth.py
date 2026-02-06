"""Advertiser authentication routes - separate from Publisher auth"""
from flask import Blueprint, request, jsonify
from models.advertiser import Advertiser
from utils.auth import generate_token, token_required
from services.email_verification_service import get_email_verification_service
import logging
import re
import threading
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
        
        # Generate token with user_type
        token = generate_token(advertiser_data, user_type='advertiser')
        
        logging.info(f"✅ Advertiser registered: {advertiser_data['email']}")
        
        # Send emails asynchronously (non-blocking)
        def send_emails_async():
            """Send confirmation and under review emails in background"""
            try:
                verification_service = get_email_verification_service()
                email = advertiser_data['email']
                name = advertiser_data.get('first_name') or advertiser_data.get('company_name', 'Advertiser')
                company = advertiser_data.get('company_name', '')
                
                # Email 1: Confirmation email (registration received)
                logging.info(f"📧 Sending Advertiser Confirmation email to {email}")
                confirmation_sent = verification_service.send_advertiser_confirmation_email(email, name, company)
                if confirmation_sent:
                    logging.info(f"✅ Advertiser Confirmation email sent to {email}")
                else:
                    logging.warning(f"⚠️ Failed to send Advertiser Confirmation email to {email}")
                
                # Email 2: Under Review email
                logging.info(f"📧 Sending Advertiser Under Review email to {email}")
                review_sent = verification_service.send_advertiser_under_review_email(email, name, company)
                if review_sent:
                    logging.info(f"✅ Advertiser Under Review email sent to {email}")
                else:
                    logging.warning(f"⚠️ Failed to send Advertiser Under Review email to {email}")
                    
            except Exception as e:
                logging.error(f"❌ Background email error for advertiser: {str(e)}")
        
        # Start email sending in background thread
        email_thread = threading.Thread(target=send_emails_async, daemon=True)
        email_thread.start()
        logging.info(f"📧 Advertiser emails queued for {advertiser_data['email']}")
        
        return jsonify({
            'message': 'Advertiser registered successfully. Your application is under review.',
            'token': token,
            'user': {
                'id': str(advertiser_data['_id']),
                'email': advertiser_data['email'],
                'first_name': advertiser_data['first_name'],
                'last_name': advertiser_data['last_name'],
                'company_name': advertiser_data['company_name'],
                'user_type': 'advertiser',
                'account_status': advertiser_data.get('account_status', 'pending_approval')
            }
        }), 201
        
    except Exception as e:
        logging.error(f"Advertiser registration error: {str(e)}", exc_info=True)
        return jsonify({'error': f'Registration failed: {str(e)}'}), 500


@advertiser_auth_bp.route('/login', methods=['POST'])
def login_advertiser():
    """Authenticate an advertiser"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        email = data.get('email', '').strip()
        password = data.get('password', '')
        
        if not email:
            return jsonify({'error': 'Email is required'}), 400
        
        if not password:
            return jsonify({'error': 'Password is required'}), 400
        
        # Verify credentials
        advertiser_model = Advertiser()
        advertiser_data = advertiser_model.verify_password(email, password)
        
        if not advertiser_data:
            # Generic error message - don't reveal which field is wrong
            return jsonify({'error': 'Invalid email or password'}), 401
        
        # Check if account is active
        if not advertiser_data.get('is_active', True):
            return jsonify({'error': 'Account is deactivated'}), 401
        
        # Generate token with user_type
        token = generate_token(advertiser_data, user_type='advertiser')
        
        logging.info(f"✅ Advertiser logged in: {advertiser_data['email']}")
        
        return jsonify({
            'message': 'Login successful',
            'token': token,
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
