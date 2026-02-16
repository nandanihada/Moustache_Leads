# Email Verification Service v3.0 - Fixed token verification + backend GET link
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
        # NOTE: We get fresh collection references in each method call

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

    def _send_email(self, to, subj, html, plain_text=None):
        try:
            msg = MIMEMultipart('alternative')
            msg['Subject'] = subj
            msg['From'] = self.from_email
            msg['To'] = to
            if plain_text:
                msg.attach(MIMEText(plain_text, 'plain'))
            msg.attach(MIMEText(html, 'html'))
            if self.email_debug:
                logger.info(f"[DEBUG] Would send to: {to}")
                return True
            return self._send_smtp(msg)
        except Exception as e:
            logger.error(f"Send error: {e}")
            return False
    def generate_verification_token(self, email, user_id):
        """Generate a verification token and store it in the database."""
        token = secrets.token_urlsafe(32)
        try:
            verification_collection = db_instance.get_collection('email_verifications')
            if verification_collection is None:
                logger.error("Could not get email_verifications collection")
                return None
            verification_collection.insert_one({
                'token': token,
                'email': email,
                'user_id': user_id,
                'created_at': datetime.utcnow(),
                'expires_at': datetime.utcnow() + timedelta(hours=24),
                'verified': False
            })
            logger.info(f"Token generated for {email}, len={len(token)}")
            return token
        except Exception as e:
            logger.error(f"Token generation error: {e}")
            return None

    def verify_email_token(self, token):
        """Verify an email verification token. Returns (success, email, user_id)."""
        try:
            if token:
                token = token.strip()
            if not token:
                logger.error("verify_email_token: Empty token")
                return False, None, None

            logger.info(f"verify_email_token: len={len(token)}, starts={token[:20]}...")

            # Get fresh collection reference each time
            verification_collection = db_instance.get_collection('email_verifications')
            if verification_collection is None:
                logger.error("Could not get email_verifications collection")
                return False, None, None

            v = verification_collection.find_one({'token': token})
            if not v:
                logger.warning(f"Token NOT found in DB: {token[:30]}...")
                return False, None, None

            logger.info(f"Token found for email={v.get('email')}, verified={v.get('verified')}")

            # Already verified? Return success (handles double-click)
            if v.get('verified'):
                return True, v.get('email'), v.get('user_id')

            # Check expiry
            expires_at = v.get('expires_at')
            if expires_at and datetime.utcnow() > expires_at:
                logger.warning(f"Token expired for {v.get('email')}")
                return False, None, None

            # Mark as verified (NOTE: must use $set not set)
            result = verification_collection.update_one(
                {'token': token},
                {'$set': {'verified': True, 'verified_at': datetime.utcnow()}}
            )
            logger.info(f"Token verified for {v.get('email')}, modified={result.modified_count}")
            return True, v.get('email'), v.get('user_id')

        except Exception as e:
            logger.error(f"Token verification error: {e}", exc_info=True)
            return False, None, None

    def send_verification_email(self, email, token, username):
        """Send verification email with clickable link pointing to backend GET endpoint."""
        if not self.is_configured:
            logger.warning("Email not configured - skipping verification email")
            return False

        backend_url = os.getenv('BACKEND_URL', 'https://moustacheleads-backend.onrender.com')
        link = f"{backend_url}/api/auth/verify-email-link?token={token}"
        frontend_link = f"{self.frontend_url}/verify-email?token={token}"
        year = datetime.now().year

        plain_text = f"""Welcome to MoustacheLeads, {username}!

Please verify your email to complete registration.

Click this link to verify your email:
{link}

Or copy and paste this URL into your browser:
{frontend_link}

This link expires in 24 hours.

Best regards,
MoustacheLeads Team
(c) {year}
"""

        html = f"""<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;background-color:#f5f5f5;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f5f5f5;padding:30px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" border="0" style="background-color:#ffffff;border-radius:16px;overflow:hidden;">
<tr><td style="background-color:#000000;padding:40px;text-align:center;">
<img src="{LOGO_URL}" alt="MoustacheLeads" style="max-width:200px;margin-bottom:20px;" border="0" />
<h1 style="color:#ffffff;font-size:32px;margin:0;">Welcome, {username}!</h1>
</td></tr>
<tr><td style="padding:40px;text-align:center;">
<p style="color:#333333;font-size:16px;margin-bottom:30px;">Please verify your email to complete registration.</p>
<table cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
<tr><td align="center" style="background-color:#000000;border-radius:50px;">
<a href="{link}" target="_blank" style="display:inline-block;background-color:#000000;color:#ffffff;padding:16px 48px;text-decoration:none;border-radius:50px;font-weight:700;font-size:16px;font-family:Arial,sans-serif;">VERIFY EMAIL</a>
</td></tr>
</table>
<p style="font-size:12px;color:#888888;margin-top:30px;">Link expires in 24 hours.</p>
<div style="background-color:#f5f5f5;padding:15px;border-radius:8px;margin-top:20px;text-align:left;">
<p style="font-size:12px;color:#666666;margin:0 0 10px 0;">If the button does not work, copy and paste this link:</p>
<p style="font-size:11px;color:#333333;word-break:break-all;margin:0;font-family:monospace;background-color:#ffffff;padding:10px;border-radius:4px;">
<a href="{link}" target="_blank" style="color:#0066cc;text-decoration:underline;">{link}</a>
</p>
</div>
</td></tr>
<tr><td style="background-color:#1a1a1a;padding:30px;text-align:center;">
<p style="color:#ffffff;font-size:18px;font-weight:800;margin:0;">MoustacheLeads</p>
<p style="color:#666666;font-size:11px;margin:10px 0 0 0;">(c) {year}</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>"""

        result = self._send_email(email, "Verify Your Email - MoustacheLeads", html, plain_text)
        logger.info(f"Verification email {'sent' if result else 'failed'} to {email}")
        return result

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
            v = db_instance.get_collection('email_verifications').find_one({'user_id': user_id}, sort=[('created_at', -1)])
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
            v = db_instance.get_collection('email_verifications').find_one({'email': email})
            if not v:
                return False, 'No record'
            if v.get('verified'):
                return False, 'Already verified'
            db_instance.get_collection('email_verifications').delete_one({'email': email})
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
