import secrets
import os
import logging
from datetime import datetime, timedelta
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import smtplib
from database import db_instance
from typing import Tuple, Optional, Dict

logger = logging.getLogger(__name__)


class EmailVerificationService:
    """Service for email verification during registration"""
    
    def __init__(self):
        self.smtp_server = os.getenv('SMTP_SERVER', 'smtp.gmail.com')
        self.smtp_port = int(os.getenv('SMTP_PORT', '587'))
        self.smtp_username = os.getenv('SMTP_USERNAME')
        self.smtp_password = os.getenv('SMTP_PASSWORD')
        self.from_email = os.getenv('FROM_EMAIL')
        self.email_debug = os.getenv('EMAIL_DEBUG', 'false').lower() == 'true'
        self.frontend_url = os.getenv('FRONTEND_URL', 'http://localhost:5173')
        
        # Check if email is configured
        self.is_configured = all([
            self.smtp_username,
            self.smtp_password,
            self.from_email
        ])
        
        if not self.is_configured:
            logger.warning("⚠️ Email verification service not fully configured. Check SMTP settings in .env")
        
        self.verification_collection = db_instance.get_collection('email_verifications')
    
    def generate_verification_token(self, email: str, user_id: str) -> str:
        """
        Generate a unique verification token for email verification
        
        Args:
            email: User email address
            user_id: User ID
            
        Returns:
            Verification token string
        """
        # Generate random token
        token = secrets.token_urlsafe(32)
        
        # Store token in database with expiration (24 hours)
        expiration_time = datetime.utcnow() + timedelta(hours=24)
        
        try:
            self.verification_collection.insert_one({
                'token': token,
                'email': email,
                'user_id': user_id,
                'created_at': datetime.utcnow(),
                'expires_at': expiration_time,
                'verified': False,
                'attempts': 0
            })
            
            logger.info(f"✅ Generated verification token for {email}")
            return token
            
        except Exception as e:
            logger.error(f"❌ Error generating verification token: {str(e)}")
            return None
    
    def verify_email_token(self, token: str) -> Tuple[bool, Optional[str], Optional[str]]:
        """
        Verify an email verification token
        
        Args:
            token: Verification token to verify
            
        Returns:
            Tuple of (is_valid, email, user_id) or (False, None, None) if invalid
        """
        try:
            # Find token in database
            verification = self.verification_collection.find_one({'token': token})
            
            if not verification:
                logger.warning(f"❌ Verification token not found: {token}")
                return False, None, None
            
            # Check if already verified
            if verification.get('verified'):
                logger.warning(f"⚠️ Token already verified: {token}")
                return False, None, None
            
            # Check if expired
            if datetime.utcnow() > verification.get('expires_at'):
                logger.warning(f"❌ Verification token expired: {token}")
                return False, None, None
            
            # Mark as verified
            self.verification_collection.update_one(
                {'token': token},
                {
                    '$set': {
                        'verified': True,
                        'verified_at': datetime.utcnow()
                    }
                }
            )
            
            email = verification.get('email')
            user_id = verification.get('user_id')
            
            logger.info(f"✅ Email verified successfully for {email}")
            return True, email, user_id
            
        except Exception as e:
            logger.error(f"❌ Error verifying email token: {str(e)}")
            return False, None, None
    
    def send_verification_email(self, email: str, token: str, username: str) -> bool:
        """
        Send verification email to user
        
        Args:
            email: Recipient email address
            token: Verification token
            username: Username for personalization
            
        Returns:
            True if email sent successfully, False otherwise
        """
        if not self.is_configured:
            logger.warning("⚠️ Email service not configured. Skipping verification email.")
            return False
        
        try:
            # Create verification link
            verification_link = f"{self.frontend_url}/verify-email?token={token}"
            
            # Create HTML email
            html_content = self._create_verification_email_html(username, verification_link)
            
            # Create message
            msg = MIMEMultipart('alternative')
            msg['Subject'] = "🔐 Verify Your Email Address"
            msg['From'] = self.from_email
            msg['To'] = email
            
            # Attach HTML content
            html_part = MIMEText(html_content, 'html')
            msg.attach(html_part)
            
            # Debug mode - just log
            if self.email_debug:
                logger.info(f"📧 [DEBUG MODE] Would send verification email to: {email}")
                logger.info(f"📧 Verification link: {verification_link}")
                return True
            
            # Send email
            with smtplib.SMTP(self.smtp_server, self.smtp_port) as server:
                server.starttls()
                server.login(self.smtp_username, self.smtp_password)
                server.send_message(msg)
            
            logger.info(f"✅ Verification email sent successfully to: {email}")
            return True
            
        except Exception as e:
            logger.error(f"❌ Failed to send verification email to {email}: {str(e)}")
            return False
    
    def _create_verification_email_html(self, username: str, verification_link: str) -> str:
        """Create HTML email template for email verification"""
        
        html = f"""
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Verify Your Email - MustacheLeads</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: linear-gradient(135deg, #f5f5f5 0%, #e8e8e8 100%);">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background: linear-gradient(135deg, #f5f5f5 0%, #e8e8e8 100%); padding: 30px 0;">
        <tr>
            <td align="center">
                <!-- Main Container -->
                <table width="600" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 8px 32px rgba(0,0,0,0.12);">
                    
                    <!-- Header with Black Background -->
                    <tr>
                        <td style="background-color: #000000; padding: 50px 30px; text-align: center;">
                            <h1 style="margin: 0; color: #ffffff; font-size: 36px; font-weight: 800; letter-spacing: -1px;">Welcome, {username}!</h1>
                            <p style="margin: 15px 0 0 0; color: #cccccc; font-size: 16px; font-weight: 300;">Nice to meet you!</p>
                        </td>
                    </tr>
                    
                    <!-- Decorative Section -->
                    <tr>
                        <td style="background-color: #f9f9f9; padding: 40px 30px; text-align: center; border-bottom: 1px solid #e5e5e5;">
                            <p style="margin: 0 0 25px 0; color: #333333; font-size: 16px; line-height: 1.6;">
                                Thank you for joining <strong style="font-weight: 700;">MustacheLeads</strong>! To complete your registration and unlock exclusive opportunities, please verify your email address.
                            </p>
                        </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                        <td style="padding: 50px 30px; text-align: center;">
                            
                            <!-- Verification Button -->
                            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 0 0 40px 0;">
                                <tr>
                                    <td align="center">
                                        <a href="{verification_link}" style="display: inline-block; background-color: #000000; color: #ffffff; padding: 16px 48px; text-decoration: none; border-radius: 50px; font-weight: 700; font-size: 15px; text-transform: uppercase; letter-spacing: 1.5px; box-shadow: 0 4px 16px rgba(0,0,0,0.2); transition: all 0.3s ease;">VERIFY EMAIL</a>
                                    </td>
                                </tr>
                            </table>
                            
                            <!-- Alternative Link Section -->
                            <p style="font-size: 12px; color: #888888; line-height: 1.6; margin: 30px 0;">
                                Or copy and paste this link:<br>
                                <span style="word-break: break-all; color: #666666; font-size: 11px; font-family: 'Courier New', monospace;">
                                    <a href="{verification_link}" style="color: #000000; text-decoration: none;">{verification_link}</a>
                                </span>
                            </p>
                            
                        </td>
                    </tr>
                    
                    <!-- Security Note Section -->
                    <tr>
                        <td style="background-color: #f5f5f5; padding: 25px 30px; border-top: 1px solid #e5e5e5; border-bottom: 1px solid #e5e5e5;">
                            <table width="100%" cellpadding="0" cellspacing="0" border="0">
                                <tr>
                                    <td style="color: #555555; font-size: 13px; line-height: 1.8; text-align: center;">
                                        <strong style="color: #000000;">🔒 Security Note:</strong><br>
                                        This verification link expires in <strong>24 hours</strong>. If you didn't create this account, please ignore this email.
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #1a1a1a; padding: 40px 30px; text-align: center;">
                            <p style="margin: 0 0 20px 0; color: #ffffff; font-size: 20px; font-weight: 800; letter-spacing: -0.5px;">MustacheLeads</p>
                            <p style="margin: 0 0 25px 0; color: #999999; font-size: 13px; line-height: 1.8;">Your gateway to premium affiliate opportunities</p>
                            
                            <!-- Contact Info -->
                            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 20px 0;">
                                <tr>
                                    <td align="center">
                                        <p style="margin: 0; color: #666666; font-size: 12px;">Questions? We're here to help</p>
                                        <p style="margin: 8px 0 0 0; color: #ffffff; font-size: 13px; font-weight: 600;">
                                            <a href="mailto:nandani.h@pepeleads.com" style="color: #ffffff; text-decoration: none;">nandani.h@pepeleads.com</a>
                                        </p>
                                    </td>
                                </tr>
                            </table>
                            
                            <!-- Links -->
                            <p style="margin: 25px 0 0 0; padding-top: 20px; border-top: 1px solid #333333;">
                                <a href="#" style="color: #999999; text-decoration: none; margin: 0 10px; font-size: 12px;">Privacy Policy</a>
                                <span style="color: #555555;">|</span>
                                <a href="#" style="color: #999999; text-decoration: none; margin: 0 10px; font-size: 12px;">Terms of Service</a>
                            </p>
                            
                            <p style="margin: 20px 0 0 0; color: #666666; font-size: 11px;">© {datetime.now().year} MustacheLeads. All rights reserved.</p>
                        </td>
                    </tr>
                    
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
"""
        return html
    
    def get_verification_status(self, user_id: str) -> Dict:
        """
        Get email verification status for a user
        
        Args:
            user_id: User ID
            
        Returns:
            Dictionary with verification status
        """
        try:
            verification = self.verification_collection.find_one(
                {'user_id': user_id},
                sort=[('created_at', -1)]
            )
            
            if not verification:
                return {
                    'verified': False,
                    'pending': False,
                    'message': 'No verification record found'
                }
            
            if verification.get('verified'):
                return {
                    'verified': True,
                    'verified_at': verification.get('verified_at'),
                    'message': 'Email verified'
                }
            
            # Check if expired
            if datetime.utcnow() > verification.get('expires_at'):
                return {
                    'verified': False,
                    'pending': False,
                    'expired': True,
                    'message': 'Verification link expired'
                }
            
            return {
                'verified': False,
                'pending': True,
                'expires_at': verification.get('expires_at'),
                'message': 'Verification pending'
            }
            
        except Exception as e:
            logger.error(f"❌ Error getting verification status: {str(e)}")
            return {'error': str(e)}
    
    def resend_verification_email(self, email: str, username: str) -> Tuple[bool, str]:
        """
        Resend verification email to user
        
        Args:
            email: User email address
            username: Username for personalization
            
        Returns:
            Tuple of (success, message)
        """
        try:
            # Find existing verification record
            verification = self.verification_collection.find_one({'email': email})
            
            if not verification:
                return False, "No verification record found for this email"
            
            # Check if already verified
            if verification.get('verified'):
                return False, "Email is already verified"
            
            # Delete old token
            self.verification_collection.delete_one({'email': email})
            
            # Generate new token
            token = self.generate_verification_token(email, verification.get('user_id'))
            
            if not token:
                return False, "Failed to generate verification token"
            
            # Send new verification email
            if self.send_verification_email(email, token, username):
                return True, "Verification email resent successfully"
            else:
                return False, "Failed to send verification email"
            
        except Exception as e:
            logger.error(f"❌ Error resending verification email: {str(e)}")
            return False, f"Error: {str(e)}"
    
    def generate_password_reset_token(self, email: str, user_id: str) -> str:
        """
        Generate a unique token for password reset
        
        Args:
            email: User email address
            user_id: User ID
            
        Returns:
            Reset token string
        """
        # Generate random token
        token = secrets.token_urlsafe(32)
        
        # Store token in database with shorter expiration (1 hour for security)
        expiration_time = datetime.utcnow() + timedelta(hours=1)
        
        try:
            # Use separate collection for password reset tokens
            reset_collection = db_instance.get_collection('password_reset_tokens')
            
            # Delete any existing reset tokens for this email
            reset_collection.delete_many({'email': email})
            
            reset_collection.insert_one({
                'token': token,
                'email': email,
                'user_id': user_id,
                'created_at': datetime.utcnow(),
                'expires_at': expiration_time,
                'used': False
            })
            
            logger.info(f"✅ Generated password reset token for {email}")
            return token
            
        except Exception as e:
            logger.error(f"❌ Error generating password reset token: {str(e)}")
            return None
    
    def verify_password_reset_token(self, token: str) -> Tuple[bool, Optional[str], Optional[str]]:
        """
        Verify a password reset token
        
        Args:
            token: Reset token to verify
            
        Returns:
            Tuple of (is_valid, email, user_id) or (False, None, None) if invalid
        """
        try:
            reset_collection = db_instance.get_collection('password_reset_tokens')
            
            # Find token in database
            reset = reset_collection.find_one({'token': token})
            
            if not reset:
                logger.warning(f"❌ Password reset token not found: {token}")
                return False, None, None
            
            # Check if already used
            if reset.get('used'):
                logger.warning(f"⚠️ Password reset token already used: {token}")
                return False, None, None
            
            # Check if expired
            if datetime.utcnow() > reset.get('expires_at'):
                logger.warning(f"❌ Password reset token expired: {token}")
                return False, None, None
            
            # Mark as used
            reset_collection.update_one(
                {'token': token},
                {
                    '$set': {
                        'used': True,
                        'used_at': datetime.utcnow()
                    }
                }
            )
            
            email = reset.get('email')
            user_id = reset.get('user_id')
            
            logger.info(f"✅ Password reset token verified for {email}")
            return True, email, user_id
            
        except Exception as e:
            logger.error(f"❌ Error verifying password reset token: {str(e)}")
            return False, None, None
    
    def send_password_reset_email(self, email: str, token: str, username: str) -> bool:
        """
        Send password reset email to user
        
        Args:
            email: Recipient email address
            token: Reset token
            username: Username for personalization
            
        Returns:
            True if email sent successfully, False otherwise
        """
        if not self.is_configured:
            logger.warning("⚠️ Email service not configured. Skipping password reset email.")
            return False
        
        try:
            # Create reset link
            reset_link = f"{self.frontend_url}/reset-password?token={token}"
            
            # Create HTML email
            html_content = self._create_password_reset_email_html(username, reset_link)
            
            # Create message
            msg = MIMEMultipart('alternative')
            msg['Subject'] = "🔑 Reset Your Password"
            msg['From'] = self.from_email
            msg['To'] = email
            
            # Attach HTML content
            html_part = MIMEText(html_content, 'html')
            msg.attach(html_part)
            
            # Debug mode - just log
            if self.email_debug:
                logger.info(f"📧 [DEBUG MODE] Would send password reset email to: {email}")
                logger.info(f"📧 Reset link: {reset_link}")
                return True
            
            # Send email
            with smtplib.SMTP(self.smtp_server, self.smtp_port) as server:
                server.starttls()
                server.login(self.smtp_username, self.smtp_password)
                server.send_message(msg)
            
            logger.info(f"✅ Password reset email sent successfully to: {email}")
            return True
            
        except Exception as e:
            logger.error(f"❌ Failed to send password reset email to {email}: {str(e)}")
            return False
    
    def _create_password_reset_email_html(self, username: str, reset_link: str) -> str:
        """Create HTML email template for password reset"""
        
        html = f"""
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reset Your Password - MustacheLeads</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: linear-gradient(135deg, #f5f5f5 0%, #e8e8e8 100%);">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background: linear-gradient(135deg, #f5f5f5 0%, #e8e8e8 100%); padding: 30px 0;">
        <tr>
            <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 8px 32px rgba(0,0,0,0.12);">
                    
                    <tr>
                        <td style="background-color: #000000; padding: 50px 30px; text-align: center;">
                            <h1 style="margin: 0; color: #ffffff; font-size: 36px; font-weight: 800; letter-spacing: -1px;">Password Reset</h1>
                            <p style="margin: 15px 0 0 0; color: #cccccc; font-size: 16px; font-weight: 300;">Hello, {username}!</p>
                        </td>
                    </tr>
                    
                    <tr>
                        <td style="background-color: #f9f9f9; padding: 40px 30px; text-align: center; border-bottom: 1px solid #e5e5e5;">
                            <p style="margin: 0 0 25px 0; color: #333333; font-size: 16px; line-height: 1.6;">
                                We received a request to reset your password. Click the button below to create a new password.
                            </p>
                        </td>
                    </tr>
                    
                    <tr>
                        <td style="padding: 50px 30px; text-align: center;">
                            
                            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 0 0 40px 0;">
                                <tr>
                                    <td align="center">
                                        <a href="{reset_link}" style="display: inline-block; background-color: #000000; color: #ffffff; padding: 16px 48px; text-decoration: none; border-radius: 50px; font-weight: 700; font-size: 15px; text-transform: uppercase; letter-spacing: 1.5px; box-shadow: 0 4px 16px rgba(0,0,0,0.2);">RESET PASSWORD</a>
                                    </td>
                                </tr>
                            </table>
                            
                            <p style="font-size: 12px; color: #888888; line-height: 1.6; margin: 30px 0;">
                                Or copy and paste this link:<br>
                                <span style="word-break: break-all; color: #666666; font-size: 11px; font-family: 'Courier New', monospace;">
                                    <a href="{reset_link}" style="color: #000000; text-decoration: none;">{reset_link}</a>
                                </span>
                            </p>
                            
                        </td>
                    </tr>
                    
                    <tr>
                        <td style="background-color: #f5f5f5; padding: 25px 30px; border-top: 1px solid #e5e5e5; border-bottom: 1px solid #e5e5e5;">
                            <table width="100%" cellpadding="0" cellspacing="0" border="0">
                                <tr>
                                    <td style="color: #555555; font-size: 13px; line-height: 1.8; text-align: center;">
                                        <strong style="color: #000000;">🔒 Security Note:</strong><br>
                                        This reset link expires in <strong>1 hour</strong>. If you didn't request this, please ignore this email and your password will remain unchanged.
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    
                    <tr>
                        <td style="background-color: #1a1a1a; padding: 40px 30px; text-align: center;">
                            <p style="margin: 0 0 20px 0; color: #ffffff; font-size: 20px; font-weight: 800; letter-spacing: -0.5px;">MustacheLeads</p>
                            <p style="margin: 0 0 25px 0; color: #999999; font-size: 13px; line-height: 1.8;">Your gateway to premium affiliate opportunities</p>
                            
                            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 20px 0;">
                                <tr>
                                    <td align="center">
                                        <p style="margin: 0; color: #666666; font-size: 12px;">Questions? We're here to help</p>
                                        <p style="margin: 8px 0 0 0; color: #ffffff; font-size: 13px; font-weight: 600;">
                                            <a href="mailto:nandani.h@pepeleads.com" style="color: #ffffff; text-decoration: none;">nandani.h@pepeleads.com</a>
                                        </p>
                                    </td>
                                </tr>
                            </table>
                            
                            <p style="margin: 25px 0 0 0; padding-top: 20px; border-top: 1px solid #333333;">
                                <a href="#" style="color: #999999; text-decoration: none; margin: 0 10px; font-size: 12px;">Privacy Policy</a>
                                <span style="color: #555555;">|</span>
                                <a href="#" style="color: #999999; text-decoration: none; margin: 0 10px; font-size: 12px;">Terms of Service</a>
                            </p>
                            
                            <p style="margin: 20px 0 0 0; color: #666666; font-size: 11px;">© {datetime.now().year} MustacheLeads. All rights reserved.</p>
                        </td>
                    </tr>
                    
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
"""
        return html


# Singleton instance
_verification_service_instance = None


def get_email_verification_service() -> EmailVerificationService:
    """Get or create email verification service singleton"""
    global _verification_service_instance
    if _verification_service_instance is None:
        _verification_service_instance = EmailVerificationService()
    return _verification_service_instance
