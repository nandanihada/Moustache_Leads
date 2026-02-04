# Email Verification Service v2.2 - With send_account_activated_email
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
LOGO_URL = "https://moustacheleads.com/logo.png"


class EmailVerificationService:
    def __init__(self):
        self.smtp_host = os.getenv('SMTP_HOST', 'smtp.hostinger.com')
        self.smtp_port = int(os.getenv('SMTP_PORT', '465'))
        self.smtp_user = os.getenv('SMTP_USER')
        self.smtp_pass = os.getenv('SMTP_PASS')
        self.from_email = os.getenv('FROM_EMAIL', self.smtp_user)
        self.email_debug = os.getenv('EMAIL_DEBUG', 'false').lower() == 'true'
        self.frontend_url = os.getenv('FRONTEND_URL', 'https://moustacheleads.com')
        
        logger.info(f"SMTP Config: host={self.smtp_host} user_set={bool(self.smtp_user)} pass_set={bool(self.smtp_pass)}")
        self.is_configured = all([self.smtp_host, self.smtp_user, self.smtp_pass, self.from_email])
        if self.is_configured:
            logger.info(f"Email service READY: {self.smtp_host}:{self.smtp_port}")
        else:
            logger.warning(f"Email NOT configured")
        self.verification_collection = db_instance.get_collection('email_verifications')

    def _send_smtp(self, msg):
        ctx = ssl.create_default_context()
        max_retries = 2
        for attempt in range(max_retries):
            try:
                logger.info(f"Attempt {attempt + 1}: Trying SMTP STARTTLS on port 587...")
                with smtplib.SMTP(self.smtp_host, 587, timeout=30) as s:
                    s.starttls(context=ctx)
                    s.login(self.smtp_user, self.smtp_pass)
                    s.send_message(msg)
                logger.info(f"Email sent via STARTTLS port 587")
                return True
            except Exception as e1:
                logger.warning(f"STARTTLS 587 failed: {e1}")
                try:
                    logger.info(f"Trying SMTP SSL on port 465...")
                    with smtplib.SMTP_SSL(self.smtp_host, 465, context=ctx, timeout=30) as s:
                        s.login(self.smtp_user, self.smtp_pass)
                        s.send_message(msg)
                    logger.info(f"Email sent via SSL port 465")
                    return True
                except Exception as e2:
                    logger.error(f"SSL 465 also failed: {e2}")
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
                logger.info(f"[DEBUG] Would send to: {to}")
                return True
            return self._send_smtp(msg)
        except Exception as e:
            logger.error(f"Send error: {e}")
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
            logger.error(f"Token generation error: {e}")
            return None

    def verify_email_token(self, token):
        try:
            v = self.verification_collection.find_one({'token': token})
            if not v or v.get('verified') or datetime.utcnow() > v.get('expires_at'):
                return False, None, None
            self.verification_collection.update_one(
                {'token': token},
                {'$set': {'verified': True, 'verified_at': datetime.utcnow()}}
            )
            return True, v.get('email'), v.get('user_id')
        except Exception as e:
            logger.error(f"Token verification error: {e}")
            return False, None, None

    def send_verification_email(self, email, token, username):
        if not self.is_configured:
            logger.warning("Email not configured - skipping verification email")
            return False
        link = f"{self.frontend_url}/verify-email?token={token}"
        year = datetime.now().year
        html = f'''<!DOCTYPE html><html><body style="margin:0;padding:0;font-family:Arial;background:#f5f5f5;"><table width="100%" style="background:#f5f5f5;padding:30px 0;"><tr><td align="center"><table width="600" style="background:#fff;border-radius:16px;"><tr><td style="background:#000;padding:40px;text-align:center;"><img src="{LOGO_URL}" style="max-width:200px;margin-bottom:20px;"><h1 style="color:#fff;font-size:32px;margin:0;">Welcome, {username}!</h1></td></tr><tr><td style="padding:40px;text-align:center;"><p style="color:#333;font-size:16px;">Please verify your email to complete registration.</p><a href="{link}" style="display:inline-block;background:#000;color:#fff;padding:16px 48px;text-decoration:none;border-radius:50px;font-weight:700;margin:20px 0;">VERIFY EMAIL</a><p style="font-size:12px;color:#888;">Link expires in 24 hours.</p></td></tr><tr><td style="background:#1a1a1a;padding:30px;text-align:center;"><p style="color:#fff;font-size:18px;font-weight:800;margin:0;">MoustacheLeads</p><p style="color:#666;font-size:11px;margin:10px 0 0;">(c) {year}</p></td></tr></table></td></tr></table></body></html>'''
        result = self._send_email(email, "Verify Your Email - MoustacheLeads", html)
        logger.info(f"Verification email {'sent' if result else 'failed'} to {email}")
        return result

    def send_application_under_review_email(self, email, name):
        logger.info(f"send_application_under_review_email called for {email}")
        if not self.is_configured:
            logger.warning(f"Email not configured")
            return False
        year = datetime.now().year
        html = f'''<!DOCTYPE html><html><body style="margin:0;padding:0;font-family:Arial;background:#f5f5f5;"><table width="100%" style="background:#f5f5f5;padding:30px 0;"><tr><td align="center"><table width="600" style="background:#fff;border-radius:16px;"><tr><td style="background:#000;padding:40px;text-align:center;"><img src="{LOGO_URL}" style="max-width:200px;margin-bottom:20px;"><h1 style="color:#fff;font-size:28px;margin:0;">Application Received!</h1></td></tr><tr><td style="padding:40px;"><p style="color:#333;font-size:16px;line-height:1.8;">Dear <strong>{name}</strong>,</p><p style="color:#333;font-size:16px;line-height:1.8;">We appreciate your interest in MoustacheLeads and the time you have invested in applying as an affiliate.</p><div style="background:#fff3cd;border-left:4px solid #ffc107;padding:15px 20px;margin:20px 0;"><p style="color:#856404;font-size:14px;margin:0;"><strong>IMPORTANT:</strong> MoustacheLeads is an exclusive network and does not accept every affiliate. The information you submitted will be reviewed, and you might receive an account activation email within the next few days.</p></div><p style="color:#333;font-size:14px;">Make sure you do not miss this important email by adding <strong>moustacheleads.com</strong> to your address book, safe sender list, or whitelist.</p><div style="background:#f8f9fa;padding:25px;border-radius:8px;margin:25px 0;"><p style="color:#333;font-size:15px;font-weight:700;margin:0 0 15px;">MoustacheLeads is an exclusive network with 2500+ offers in many verticals and GEOs.</p><p style="color:#333;font-size:14px;margin:0 0 10px;">With MoustacheLeads, you can take full advantage of the following perks:</p><ul style="color:#555;font-size:14px;line-height:2;margin:0;padding-left:20px;"><li>Access to over <strong>2500 offers</strong> in one network</li><li>Get paid <strong>weekly or monthly</strong></li><li>Get any offer you are looking for, even if it is not listed</li><li>Get <strong>better payouts</strong> on offers you already run</li><li>Accurate daily audits to credit skipped sales due to pixel misfires</li><li>Enjoy <strong>VIP support</strong> as our partner</li></ul></div><p style="color:#333;font-size:16px;line-height:1.8;">We look forward to activating your account.</p><p style="color:#333;font-size:16px;line-height:1.8;margin-top:30px;">Best Regards,<br><strong>MoustacheLeads Team</strong></p></td></tr><tr><td style="background:#1a1a1a;padding:30px;text-align:center;"><p style="color:#fff;font-size:18px;font-weight:800;margin:0;">MoustacheLeads</p><p style="color:#666;font-size:11px;margin:10px 0 0;">(c) {year}</p></td></tr></table></td></tr></table></body></html>'''
        result = self._send_email(email, "Your Application is Under Review - MoustacheLeads", html)
        logger.info(f"Under Review email {'sent' if result else 'failed'} to {email}")
        return result

    def send_account_activated_email(self, email, name):
        logger.info(f"send_account_activated_email called for {email}")
        if not self.is_configured:
            logger.warning(f"Email not configured")
            return False
        year = datetime.now().year
        html = f'''<!DOCTYPE html><html><body style="margin:0;padding:0;font-family:Arial;background:#f5f5f5;"><table width="100%" style="background:#f5f5f5;padding:30px 0;"><tr><td align="center"><table width="600" style="background:#fff;border-radius:16px;"><tr><td style="background:#000;padding:40px;text-align:center;"><img src="{LOGO_URL}" style="max-width:200px;margin-bottom:20px;"><h1 style="color:#fff;font-size:28px;margin:0;">Account Activated!</h1></td></tr><tr><td style="padding:40px;"><p style="color:#333;font-size:16px;line-height:1.8;">Dear <strong>{name}</strong>,</p><p style="color:#333;font-size:16px;line-height:1.8;">Great news! Your MoustacheLeads account has been activated by our admin team.</p><div style="background:#d4edda;border-left:4px solid #28a745;padding:15px 20px;margin:20px 0;"><p style="color:#155724;font-size:14px;margin:0;"><strong>Your account is now active!</strong><br>You can now log in and create your first placement to start earning.</p></div><div style="background:#f8f9fa;padding:25px;border-radius:8px;margin:25px 0;"><p style="color:#333;font-size:15px;font-weight:700;margin:0 0 15px;">What is Next?</p><ol style="color:#555;font-size:14px;line-height:2;margin:0;padding-left:20px;"><li>Log in to your account</li><li>Create your first placement</li><li>Wait for placement approval</li><li>Start promoting offers and earning!</li></ol></div><a href="{self.frontend_url}/login" style="display:inline-block;background:#000;color:#fff;padding:16px 48px;text-decoration:none;border-radius:50px;font-weight:700;margin:20px 0;">LOG IN NOW</a><p style="color:#333;font-size:16px;line-height:1.8;margin-top:30px;">Best Regards,<br><strong>MoustacheLeads Team</strong></p></td></tr><tr><td style="background:#1a1a1a;padding:30px;text-align:center;"><p style="color:#fff;font-size:18px;font-weight:800;margin:0;">MoustacheLeads</p><p style="color:#666;font-size:11px;margin:10px 0 0;">(c) {year}</p></td></tr></table></td></tr></table></body></html>'''
        result = self._send_email(email, "Your Account is Activated - MoustacheLeads", html)
        logger.info(f"Account Activated email {'sent' if result else 'failed'} to {email}")
        return result

    def send_placement_created_email(self, email, name, placement_name, placement_id):
        logger.info(f"send_placement_created_email called for {email}")
        if not self.is_configured:
            logger.warning(f"Email not configured")
            return False
        year = datetime.now().year
        html = f'''<!DOCTYPE html><html><body style="margin:0;padding:0;font-family:Arial;background:#f5f5f5;"><table width="100%" style="background:#f5f5f5;padding:30px 0;"><tr><td align="center"><table width="600" style="background:#fff;border-radius:16px;"><tr><td style="background:#000;padding:40px;text-align:center;"><img src="{LOGO_URL}" style="max-width:200px;margin-bottom:20px;"><h1 style="color:#fff;font-size:28px;margin:0;">Placement Created!</h1></td></tr><tr><td style="padding:40px;"><p style="color:#333;font-size:16px;line-height:1.8;">Dear <strong>{name}</strong>,</p><p style="color:#333;font-size:16px;line-height:1.8;">Your placement has been created and is pending review.</p><div style="background:#f8f9fa;padding:25px;border-radius:8px;margin:25px 0;border-left:4px solid #000;"><p style="color:#666;font-size:12px;text-transform:uppercase;margin:0 0 8px;">Placement Name</p><p style="color:#000;font-size:20px;font-weight:700;margin:0 0 15px;">{placement_name}</p><p style="color:#666;font-size:12px;text-transform:uppercase;margin:0 0 8px;">Placement ID</p><p style="color:#000;font-size:14px;font-family:monospace;margin:0;">{placement_id}</p></div><div style="background:#d4edda;border-left:4px solid #28a745;padding:15px 20px;margin:20px 0;"><p style="color:#155724;font-size:14px;margin:0;"><strong>What is Next?</strong><br>Our team will review your placement shortly. Once approved, you can start promoting offers!</p></div><a href="{self.frontend_url}/placements" style="display:inline-block;background:#000;color:#fff;padding:16px 48px;text-decoration:none;border-radius:50px;font-weight:700;margin:20px 0;">VIEW MY PLACEMENTS</a><p style="color:#333;font-size:16px;line-height:1.8;margin-top:20px;">Best Regards,<br><strong>MoustacheLeads Team</strong></p></td></tr><tr><td style="background:#1a1a1a;padding:30px;text-align:center;"><p style="color:#fff;font-size:18px;font-weight:800;margin:0;">MoustacheLeads</p><p style="color:#666;font-size:11px;margin:10px 0 0;">(c) {year}</p></td></tr></table></td></tr></table></body></html>'''
        result = self._send_email(email, f"Placement Created: {placement_name} - MoustacheLeads", html)
        logger.info(f"Placement Created email {'sent' if result else 'failed'} to {email}")
        return result

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
                return False, "No record"
            if v.get('verified'):
                return False, "Already verified"
            self.verification_collection.delete_one({'email': email})
            token = self.generate_verification_token(email, v.get('user_id'))
            if token and self.send_verification_email(email, token, username):
                return True, "Sent"
            return False, "Failed"
        except Exception as e:
            return False, str(e)

    def generate_password_reset_token(self, email, user_id):
        try:
            rc = db_instance.get_collection('password_reset_tokens')
            rc.delete_many({'email': email})
            token = secrets.token_urlsafe(32)
            rc.insert_one({
                'token': token, 'email': email, 'user_id': user_id,
                'created_at': datetime.utcnow(),
                'expires_at': datetime.utcnow() + timedelta(hours=1),
                'used': False
            })
            return token
        except:
            return None

    def verify_password_reset_token(self, token):
        try:
            rc = db_instance.get_collection('password_reset_tokens')
            r = rc.find_one({'token': token})
            if not r or r.get('used') or datetime.utcnow() > r.get('expires_at'):
                return False, None, None
            rc.update_one({'token': token}, {'$set': {'used': True}})
            return True, r.get('email'), r.get('user_id')
        except:
            return False, None, None

    def send_password_reset_email(self, email, token, username):
        if not self.is_configured:
            return False
        link = f"{self.frontend_url}/reset-password?token={token}"
        year = datetime.now().year
        html = f'''<!DOCTYPE html><html><body style="margin:0;padding:0;font-family:Arial;background:#f5f5f5;"><table width="100%" style="background:#f5f5f5;padding:30px 0;"><tr><td align="center"><table width="600" style="background:#fff;border-radius:16px;"><tr><td style="background:#000;padding:40px;text-align:center;"><img src="{LOGO_URL}" style="max-width:200px;margin-bottom:20px;"><h1 style="color:#fff;font-size:28px;margin:0;">Password Reset</h1></td></tr><tr><td style="padding:40px;text-align:center;"><p style="color:#333;font-size:16px;">Hello {username}, click below to reset your password.</p><a href="{link}" style="display:inline-block;background:#000;color:#fff;padding:16px 48px;text-decoration:none;border-radius:50px;font-weight:700;margin:20px 0;">RESET PASSWORD</a><p style="font-size:12px;color:#888;">Link expires in 1 hour.</p></td></tr><tr><td style="background:#1a1a1a;padding:30px;text-align:center;"><p style="color:#fff;font-size:18px;font-weight:800;margin:0;">MoustacheLeads</p></td></tr></table></td></tr></table></body></html>'''
        return self._send_email(email, "Reset Your Password - MoustacheLeads", html)


email_verification_service = EmailVerificationService()


def get_email_verification_service():
    return email_verification_service
