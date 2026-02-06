# Email Verification Service v2.3 - With Advertiser Email Methods
import secrets
import os
import logging
from datetime import datetime, timedelta
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import smtplib
import ssl
from pathlib import Path
from dotenv import load_dotenv

env_path = Path(__file__).resolve().parent.parent / '.env'
load_dotenv(dotenv_path=env_path)

from database import db_instance
from typing import Tuple, Optional, Dict

logger = logging.getLogger(__name__)
LOGO_URL = 'https://moustacheleads.com/logo.png'


class EmailVerificationService:
    def __init__(self):
        self.smtp_host = os.getenv('SMTP_HOST', 'smtp.hostinger.com')
        self.smtp_port = int(os.getenv('SMTP_PORT', '465'))
        self.smtp_user = os.getenv('SMTP_USER')
        self.smtp_pass = os.getenv('SMTP_PASS')
        self.from_email = os.getenv('FROM_EMAIL', self.smtp_user)
        self.email_debug = os.getenv('EMAIL_DEBUG', 'false').lower() == 'true'
        self.frontend_url = os.getenv('FRONTEND_URL', 'https://moustacheleads.com')
        
        logger.info(f'SMTP Config: host={self.smtp_host} user_set={bool(self.smtp_user)} pass_set={bool(self.smtp_pass)}')
        self.is_configured = all([self.smtp_host, self.smtp_user, self.smtp_pass, self.from_email])
        if self.is_configured:
            logger.info(f'Email service READY: {self.smtp_host}:{self.smtp_port}')
        else:
            logger.warning(f'Email NOT configured')
        self.verification_collection = db_instance.get_collection('email_verifications')

    def _send_smtp(self, msg):
        ctx = ssl.create_default_context()
        max_retries = 2
        for attempt in range(max_retries):
            try:
                with smtplib.SMTP(self.smtp_host, 587, timeout=30) as s:
                    s.starttls(context=ctx)
                    s.login(self.smtp_user, self.smtp_pass)
                    s.send_message(msg)
                return True
            except Exception as e1:
                try:
                    with smtplib.SMTP_SSL(self.smtp_host, 465, context=ctx, timeout=30) as s:
                        s.login(self.smtp_user, self.smtp_pass)
                        s.send_message(msg)
                    return True
                except Exception as e2:
                    if attempt < max_retries - 1:
                        import time
                        time.sleep(2)
        return False

    def _send_email(self, to, subj, html):
        try:
            msg = MIMEMultipart('alternative')
            msg['Subject'] = subj
            msg['From'] = self.from_email
            msg['To'] = to
            msg.attach(MIMEText(html, 'html'))
            if self.email_debug:
                return True
            return self._send_smtp(msg)
        except Exception as e:
            logger.error(f'Send error: {e}')
            return False

    def generate_verification_token(self, email, user_id):
        token = secrets.token_urlsafe(32)
        try:
            self.verification_collection.insert_one({
                'token': token, 'email': email, 'user_id': user_id,
                'created_at': datetime.utcnow(),
                'expires_at': datetime.utcnow() + timedelta(hours=24),
                'verified': False
            })
            return token
        except Exception as e:
            return None

    def verify_email_token(self, token):
        try:
            v = self.verification_collection.find_one({'token': token})
            if not v or v.get('verified') or datetime.utcnow() > v.get('expires_at'):
                return False, None, None
            self.verification_collection.update_one({'token': token}, {'set': {'verified': True, 'verified_at': datetime.utcnow()}})
            return True, v.get('email'), v.get('user_id')
        except:
            return False, None, None

    def send_verification_email(self, email, token, username):
        if not self.is_configured:
            return False
        link = f'{self.frontend_url}/verify-email?token={token}'
        year = datetime.now().year
        html = f'<!DOCTYPE html><html><body><p>Welcome {username}! Verify: {link}</p></body></html>'
        return self._send_email(email, 'Verify Your Email - MoustacheLeads', html)

    def send_application_under_review_email(self, email, name):
        if not self.is_configured:
            return False
        year = datetime.now().year
        html = f'<!DOCTYPE html><html><body><p>Dear {name}, your application is under review.</p></body></html>'
        return self._send_email(email, 'Your Application is Under Review - MoustacheLeads', html)

    def send_account_activated_email(self, email, name):
        if not self.is_configured:
            return False
        year = datetime.now().year
        html = f'<!DOCTYPE html><html><body><p>Dear {name}, your account is activated!</p></body></html>'
        return self._send_email(email, 'Your Account is Activated - MoustacheLeads', html)

    def send_placement_created_email(self, email, name, placement_name, placement_id):
        if not self.is_configured:
            return False
        html = f'<!DOCTYPE html><html><body><p>Dear {name}, placement {placement_name} created.</p></body></html>'
        return self._send_email(email, f'Placement Created: {placement_name} - MoustacheLeads', html)

    def get_verification_status(self, user_id):
        try:
            v = self.verification_collection.find_one({'user_id': user_id}, sort=[('created_at', -1)])
            if not v:
                return {'verified': False, 'pending': False}
            if v.get('verified'):
                return {'verified': True}
            if datetime.utcnow() > v.get('expires_at'):
                return {'verified': False, 'expired': True}
            return {'verified': False, 'pending': True}
        except:
            return {'error': True}

    def resend_verification_email(self, email, username):
        try:
            v = self.verification_collection.find_one({'email': email})
            if not v:
                return False, 'No record'
            if v.get('verified'):
                return False, 'Already verified'
            self.verification_collection.delete_one({'email': email})
            token = self.generate_verification_token(email, v.get('user_id'))
            if token and self.send_verification_email(email, token, username):
                return True, 'Sent'
            return False, 'Failed'
        except Exception as e:
            return False, str(e)

    def generate_password_reset_token(self, email, user_id):
        try:
            rc = db_instance.get_collection('password_reset_tokens')
            rc.delete_many({'email': email})
            token = secrets.token_urlsafe(32)
            rc.insert_one({'token': token, 'email': email, 'user_id': user_id, 'created_at': datetime.utcnow(), 'expires_at': datetime.utcnow() + timedelta(hours=1), 'used': False})
            return token
        except:
            return None

    def verify_password_reset_token(self, token):
        try:
            rc = db_instance.get_collection('password_reset_tokens')
            r = rc.find_one({'token': token})
            if not r or r.get('used') or datetime.utcnow() > r.get('expires_at'):
                return False, None, None
            rc.update_one({'token': token}, {'set': {'used': True}})
            return True, r.get('email'), r.get('user_id')
        except:
            return False, None, None

    def send_password_reset_email(self, email, token, username):
        if not self.is_configured:
            return False
        link = f'{self.frontend_url}/reset-password?token={token}'
        html = f'<!DOCTYPE html><html><body><p>Hello {username}, reset password: {link}</p></body></html>'
        return self._send_email(email, 'Reset Your Password - MoustacheLeads', html)

    # ADVERTISER EMAIL METHODS
    def send_advertiser_confirmation_email(self, email, name, company_name=''):
        if not self.is_configured:
            return False
        html = f'<!DOCTYPE html><html><body><p>Dear {name}, thank you for registering as advertiser!</p></body></html>'
        return self._send_email(email, 'Welcome to MoustacheLeads - Advertiser Registration Received', html)

    def send_advertiser_under_review_email(self, email, name, company_name=''):
        if not self.is_configured:
            return False
        html = f'<!DOCTYPE html><html><body><p>Dear {name}, your advertiser application is under review.</p></body></html>'
        return self._send_email(email, 'Your Advertiser Application is Under Review - MoustacheLeads', html)

    def send_advertiser_account_activated_email(self, email, name, company_name=''):
        if not self.is_configured:
            return False
        html = f'<!DOCTYPE html><html><body><p>Dear {name}, your advertiser account is activated!</p></body></html>'
        return self._send_email(email, 'Your Advertiser Account is Activated - MoustacheLeads', html)


email_verification_service = EmailVerificationService()

def get_email_verification_service():
    return email_verification_service
