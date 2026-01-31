import smtplib
import ssl
import os
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime
from typing import List, Dict
import threading
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables from the backend/.env file
env_path = Path(__file__).resolve().parent.parent / '.env'
load_dotenv(dotenv_path=env_path)

logger = logging.getLogger(__name__)


class EmailService:
    """Service for sending email notifications via Hostinger SMTP"""
    
    def __init__(self):
        # Hostinger SMTP configuration
        self.smtp_host = os.getenv('SMTP_HOST', 'smtp.hostinger.com')
        self.smtp_port = int(os.getenv('SMTP_PORT', '465'))
        self.smtp_user = os.getenv('SMTP_USER')
        self.smtp_pass = os.getenv('SMTP_PASS')
        self.from_email = os.getenv('FROM_EMAIL', self.smtp_user)
        self.email_debug = os.getenv('EMAIL_DEBUG', 'false').lower() == 'true'
        
        # Debug: Log what we found
        logger.info(f"📧 EmailService Config - Host: {self.smtp_host}, Port: {self.smtp_port}")
        logger.info(f"📧 EmailService Config - User set: {bool(self.smtp_user)}, Pass set: {bool(self.smtp_pass)}, From: {self.from_email}")
        
        # Check if email is configured
        self.is_configured = all([
            self.smtp_host,
            self.smtp_user,
            self.smtp_pass,
            self.from_email
        ])
        
        if not self.is_configured:
            logger.warning(f"⚠️ Email service not configured. Missing: host={bool(self.smtp_host)}, user={bool(self.smtp_user)}, pass={bool(self.smtp_pass)}, from={bool(self.from_email)}")
        else:
            logger.info(f"✅ Email service ready: {self.smtp_host}:{self.smtp_port} from {self.from_email}")
    
    def _send_email_smtp(self, msg) -> bool:
        """
        Send email using Hostinger SMTP with SSL on port 465.
        Creates connection at send time and closes immediately after.
        No persistent connections, no retry loops, no pooling.
        """
        try:
            context = ssl.create_default_context()
            with smtplib.SMTP_SSL(self.smtp_host, self.smtp_port, context=context, timeout=30) as server:
                server.login(self.smtp_user, self.smtp_pass)
                server.send_message(msg)
            return True
        except Exception as e:
            logger.error(f"❌ SMTP send failed: {str(e)}")
            return False
    
    def _send_email(self, to_email: str, subject: str, html_content: str) -> bool:
        """Send email using SMTP - creates connection, sends, closes immediately"""
        try:
            # Create message
            msg = MIMEMultipart('alternative')
            msg['Subject'] = subject
            msg['From'] = self.from_email
            msg['To'] = to_email
            
            # Attach HTML content
            html_part = MIMEText(html_content, 'html')
            msg.attach(html_part)
            
            # Debug mode - just log
            if self.email_debug:
                logger.info(f"📧 [DEBUG MODE] Would send email to: {to_email}")
                logger.info(f"📧 Subject: {subject}")
                return True
            
            # Send email
            if self._send_email_smtp(msg):
                logger.info(f"✅ Email sent successfully to: {to_email}")
                return True
            else:
                logger.error(f"❌ Failed to send email to: {to_email}")
                return False
            
        except Exception as e:
            logger.error(f"❌ Failed to send email to {to_email}: {str(e)}")
            return False
    
    def _create_offer_update_email_html(self, offer_data: Dict, update_type: str = 'promo_code') -> str:
        """Create HTML email template for offer update notification"""
        
        offer_name = offer_data.get('name', 'Offer Update')
        category = offer_data.get('category', 'General')
        
        offer_image = (
            offer_data.get('image_url') or 
            offer_data.get('thumbnail_url') or
            offer_data.get('preview_url') or 
            offer_data.get('creative_url') or 
            'https://images.unsplash.com/photo-1557821552-17105176677c?w=800&h=400&fit=crop'
        )
        
        days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
        current_day = days[datetime.now().weekday()]
        
        if update_type == 'promo_code':
            update_message = "🎉 New Promo Code Available!"
            update_details = f"A new promo code has been added to {offer_name}. Check it out and boost your conversions!"
        elif update_type == 'payout_increase':
            update_message = "💰 Payout Increased!"
            update_details = f"The payout for {offer_name} has been increased. Don't miss this opportunity!"
        else:
            update_message = "📢 Offer Updated"
            update_details = f"{offer_name} has been updated with new details. Check the changes!"
        
        frontend_url = os.getenv('FRONTEND_URL', 'https://moustacheleads.com')
        
        html = f"""
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Offer Update - {offer_name}</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; background-color: #f4f6f9;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f4f6f9; padding: 20px 0;">
        <tr>
            <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
                    <tr>
                        <td style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 40px 20px; text-align: center;">
                            <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: 700;">{update_message}</h1>
                            <p style="margin: 10px 0 0 0; color: #ffffff; font-size: 18px; opacity: 0.95;">Happy {current_day}!</p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 40px 30px;">
                            <p style="text-align: center; font-size: 18px; color: #1f2937; font-weight: 600; margin: 0 0 30px 0;">
                                {update_details}
                            </p>
                            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f9fafb; border-radius: 12px; overflow: hidden; margin: 20px 0;">
                                <tr>
                                    <td style="padding: 0;">
                                        <img src="{offer_image}" alt="{offer_name}" style="width: 100%; height: auto; max-height: 300px; object-fit: cover; display: block;" />
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding: 30px; background-color: #ffffff;">
                                        <h2 style="margin: 0 0 15px 0; color: #111827; font-size: 24px; font-weight: 700; line-height: 1.3;">{offer_name}</h2>
                                        <span style="display: inline-block; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: #ffffff; padding: 8px 20px; border-radius: 20px; font-size: 14px; font-weight: 600;">📁 {category}</span>
                                    </td>
                                </tr>
                            </table>
                            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 30px 0;">
                                <tr>
                                    <td align="center">
                                        <a href="{frontend_url}/offers" style="display: inline-block; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: #ffffff; padding: 16px 50px; text-decoration: none; border-radius: 50px; font-weight: 700; font-size: 16px; text-transform: uppercase; letter-spacing: 1px; box-shadow: 0 4px 15px rgba(245,158,11,0.4);">VIEW OFFER →</a>
                                    </td>
                                </tr>
                            </table>
                            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top: 40px; padding-top: 30px; border-top: 2px solid #e5e7eb;">
                                <tr>
                                    <td align="center">
                                        <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 16px;">Thanks!</p>
                                        <p style="margin: 0; color: #111827; font-size: 18px; font-weight: 600;">Keep pushing! 🚀</p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <tr>
                        <td style="background-color: #1f2937; padding: 30px; text-align: center;">
                            <p style="margin: 0 0 15px 0; color: #ffffff; font-size: 20px; font-weight: 700;">MustacheLeads</p>
                            <p style="margin: 0 0 20px 0; color: #9ca3af; font-size: 13px; line-height: 1.6;">This email was sent to you because you are a registered publisher.</p>
                            <p style="margin: 20px 0 0 0; color: #6b7280; font-size: 12px;">© {datetime.now().year} MustacheLeads. All rights reserved.</p>
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
    
    def _create_new_offer_email_html(self, offer_data: Dict) -> str:
        """Create HTML email template for new offer notification"""
        
        offer_name = offer_data.get('name', 'New Offer')
        category = offer_data.get('category', 'General')
        
        offer_image = (
            offer_data.get('image_url') or 
            offer_data.get('thumbnail_url') or
            offer_data.get('preview_url') or 
            offer_data.get('creative_url') or 
            'https://images.unsplash.com/photo-1557821552-17105176677c?w=800&h=400&fit=crop'
        )
        
        days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
        current_day = days[datetime.now().weekday()]
        frontend_url = os.getenv('FRONTEND_URL', 'https://moustacheleads.com')
        
        html = f"""
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>New Offer Available</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; background-color: #f4f6f9;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f4f6f9; padding: 20px 0;">
        <tr>
            <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
                    <tr>
                        <td style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 40px 20px; text-align: center;">
                            <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: 700;">Hey All! 👋</h1>
                            <p style="margin: 10px 0 0 0; color: #ffffff; font-size: 18px; opacity: 0.95;">Happy {current_day}!</p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 40px 30px;">
                            <p style="text-align: center; font-size: 20px; color: #1f2937; font-weight: 600; margin: 0 0 30px 0;">
                                🚀 Please push more traffic on this offer!
                            </p>
                            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f9fafb; border-radius: 12px; overflow: hidden; margin: 20px 0;">
                                <tr>
                                    <td style="padding: 0;">
                                        <img src="{offer_image}" alt="{offer_name}" style="width: 100%; height: auto; max-height: 300px; object-fit: cover; display: block;" />
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding: 30px; background-color: #ffffff;">
                                        <h2 style="margin: 0 0 15px 0; color: #111827; font-size: 24px; font-weight: 700; line-height: 1.3;">{offer_name}</h2>
                                        <span style="display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: #ffffff; padding: 8px 20px; border-radius: 20px; font-size: 14px; font-weight: 600;">📁 {category}</span>
                                    </td>
                                </tr>
                            </table>
                            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 30px 0;">
                                <tr>
                                    <td align="center">
                                        <a href="{frontend_url}/offers" style="display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: #ffffff; padding: 16px 50px; text-decoration: none; border-radius: 50px; font-weight: 700; font-size: 16px; text-transform: uppercase; letter-spacing: 1px; box-shadow: 0 4px 15px rgba(99,102,241,0.4);">CHECK NOW →</a>
                                    </td>
                                </tr>
                            </table>
                            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top: 40px; padding-top: 30px; border-top: 2px solid #e5e7eb;">
                                <tr>
                                    <td align="center">
                                        <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 16px;">Thanks!</p>
                                        <p style="margin: 0; color: #111827; font-size: 18px; font-weight: 600;">Have a great work! 💼</p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <tr>
                        <td style="background-color: #1f2937; padding: 30px; text-align: center;">
                            <p style="margin: 0 0 15px 0; color: #ffffff; font-size: 20px; font-weight: 700;">MustacheLeads</p>
                            <p style="margin: 0 0 20px 0; color: #9ca3af; font-size: 13px; line-height: 1.6;">This email was sent to you because you are a registered publisher.</p>
                            <p style="margin: 20px 0 0 0; color: #6b7280; font-size: 12px;">© {datetime.now().year} MustacheLeads. All rights reserved.</p>
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
    
    def send_new_offer_notification(self, offer_data: Dict, recipients: List[str]) -> Dict:
        """Send new offer notification to multiple recipients"""
        if not self.is_configured:
            logger.warning("⚠️ Email service not configured. Skipping email notifications.")
            return {'total': len(recipients), 'sent': 0, 'failed': len(recipients), 'error': 'Email service not configured'}
        
        if not recipients:
            return {'total': 0, 'sent': 0, 'failed': 0, 'error': 'No recipients'}
        
        offer_name = offer_data.get('name', 'New Offer')
        days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
        current_day = days[datetime.now().weekday()]
        subject = f"🚀 Happy {current_day}! New Offer: {offer_name} - Push More Traffic!"
        
        html_content = self._create_new_offer_email_html(offer_data)
        
        sent_count = 0
        failed_count = 0
        
        logger.info(f"📧 Sending new offer notification to {len(recipients)} recipients...")
        
        for recipient in recipients:
            if self._send_email(recipient, subject, html_content):
                sent_count += 1
            else:
                failed_count += 1
        
        logger.info(f"📊 Email notification results: {sent_count} sent, {failed_count} failed")
        return {'total': len(recipients), 'sent': sent_count, 'failed': failed_count, 'offer_name': offer_name}
    
    def send_new_offer_notification_async(self, offer_data: Dict, recipients: List[str]) -> None:
        """Send new offer notification asynchronously (non-blocking)"""
        def send_in_background():
            try:
                result = self.send_new_offer_notification(offer_data, recipients)
                logger.info(f"✅ Background email sending complete: {result}")
            except Exception as e:
                logger.error(f"❌ Error in background email sending: {str(e)}")
        
        thread = threading.Thread(target=send_in_background, daemon=False)
        thread.start()
        logger.info(f"📧 Email notification started in background thread for {len(recipients)} recipients")
    
    def send_offer_update_notification(self, offer_data: Dict, recipients: List[str], update_type: str = 'promo_code') -> Dict:
        """Send offer update notification to multiple recipients"""
        if not self.is_configured:
            return {'total': len(recipients), 'sent': 0, 'failed': len(recipients), 'error': 'Email service not configured'}
        
        if not recipients:
            return {'total': 0, 'sent': 0, 'failed': 0, 'error': 'No recipients'}
        
        offer_name = offer_data.get('name', 'Offer Update')
        
        if update_type == 'promo_code':
            subject = f"🎉 New Promo Code Available for {offer_name}!"
        elif update_type == 'payout_increase':
            subject = f"💰 Payout Increased for {offer_name}!"
        else:
            subject = f"📢 {offer_name} Has Been Updated!"
        
        html_content = self._create_offer_update_email_html(offer_data, update_type)
        
        sent_count = 0
        failed_count = 0
        
        for recipient in recipients:
            if self._send_email(recipient, subject, html_content):
                sent_count += 1
            else:
                failed_count += 1
        
        return {'total': len(recipients), 'sent': sent_count, 'failed': failed_count, 'offer_name': offer_name, 'update_type': update_type}
    
    def send_offer_update_notification_async(self, offer_data: Dict, recipients: List[str], update_type: str = 'promo_code') -> None:
        """Send offer update notification asynchronously"""
        def send_in_background():
            try:
                result = self.send_offer_update_notification(offer_data, recipients, update_type)
                logger.info(f"✅ Background offer update email complete: {result}")
            except Exception as e:
                logger.error(f"❌ Error in background offer update email: {str(e)}")
        
        thread = threading.Thread(target=send_in_background, daemon=False)
        thread.start()

    def _create_approval_email_html(self, offer_name: str, status: str, reason: str = '') -> str:
        """Create HTML email template for offer/placement approval notification"""
        
        if status == 'approved':
            header_gradient = 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
            icon = '✅'
            title = 'Offer Approved!'
            message = f'Great news! Your offer "{offer_name}" has been approved and is now live.'
            button_text = 'VIEW OFFER'
        elif status == 'rejected':
            header_gradient = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
            icon = '❌'
            title = 'Offer Rejected'
            message = f'Unfortunately, your offer "{offer_name}" was not approved.'
            button_text = 'EDIT OFFER'
        else:
            header_gradient = 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
            icon = '⏳'
            title = 'Offer Under Review'
            message = f'Your offer "{offer_name}" is currently under review.'
            button_text = 'VIEW STATUS'
        
        reason_section = ''
        if reason:
            reason_section = f"""
            <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 0 0 10px 0; color: #374151; font-weight: 600;">Reason:</p>
                <p style="margin: 0; color: #6b7280; line-height: 1.6;">{reason}</p>
            </div>
            """
        
        frontend_url = os.getenv('FRONTEND_URL', 'https://moustacheleads.com')
        
        html = f"""
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Offer {status.title()} - {offer_name}</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; background-color: #f4f6f9;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f4f6f9; padding: 20px 0;">
        <tr>
            <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
                    <tr>
                        <td style="background: {header_gradient}; padding: 40px 20px; text-align: center;">
                            <h1 style="margin: 0; color: #ffffff; font-size: 48px; font-weight: 700;">{icon}</h1>
                            <h2 style="margin: 15px 0 0 0; color: #ffffff; font-size: 28px; font-weight: 700;">{title}</h2>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 40px 30px;">
                            <p style="text-align: center; font-size: 18px; color: #1f2937; font-weight: 600; margin: 0 0 30px 0;">
                                {message}
                            </p>
                            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f9fafb; border-radius: 8px; padding: 20px; margin: 20px 0; border: 1px solid #e5e7eb;">
                                <tr>
                                    <td>
                                        <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 13px; text-transform: uppercase; font-weight: 600;">Offer Name</p>
                                        <p style="margin: 0 0 20px 0; color: #111827; font-size: 18px; font-weight: 700;">{offer_name}</p>
                                        {reason_section}
                                    </td>
                                </tr>
                            </table>
                            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 30px 0;">
                                <tr>
                                    <td align="center">
                                        <a href="{frontend_url}/dashboard/offers" style="display: inline-block; background: {header_gradient}; color: #ffffff; padding: 16px 50px; text-decoration: none; border-radius: 50px; font-weight: 700; font-size: 16px; text-transform: uppercase; letter-spacing: 1px;">{button_text} →</a>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <tr>
                        <td style="background-color: #1f2937; padding: 30px; text-align: center;">
                            <p style="margin: 0 0 15px 0; color: #ffffff; font-size: 20px; font-weight: 700;">MustacheLeads</p>
                            <p style="margin: 20px 0 0 0; color: #6b7280; font-size: 12px;">© {datetime.now().year} MustacheLeads. All rights reserved.</p>
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
    
    def send_approval_notification(self, recipient_email: str, offer_name: str, status: str, reason: str = '', offer_id: str = '') -> bool:
        """Send offer/placement approval/rejection notification"""
        if not self.is_configured:
            logger.warning("⚠️ Email service not configured. Skipping approval notification.")
            return False
        
        if status == 'approved':
            subject = f"✅ Your Offer '{offer_name}' Has Been Approved!"
        elif status == 'rejected':
            subject = f"❌ Your Offer '{offer_name}' Was Not Approved"
        else:
            subject = f"⏳ Your Offer '{offer_name}' Is Under Review"
        
        html_content = self._create_approval_email_html(offer_name, status, reason)
        return self._send_email(recipient_email, subject, html_content)
    
    def send_approval_notification_async(self, recipient_email: str, offer_name: str, status: str, reason: str = '', offer_id: str = '') -> None:
        """Send approval notification asynchronously"""
        def send_in_background():
            try:
                result = self.send_approval_notification(recipient_email, offer_name, status, reason, offer_id)
                logger.info(f"✅ Background approval notification complete: {result}")
            except Exception as e:
                logger.error(f"❌ Error sending approval notification: {str(e)}")
        
        thread = threading.Thread(target=send_in_background, daemon=False)
        thread.start()
    
    def send_promo_code_assigned_to_offer(self, recipient_email: str, offer_name: str, code: str, bonus_amount: float, bonus_type: str, offer_id: str = '') -> bool:
        """Send notification when admin assigns promo code to offer"""
        if not self.is_configured:
            return False
        
        bonus_text = f"{bonus_amount}%" if bonus_type == "percentage" else f"${bonus_amount:.2f}"
        subject = f"🎉 New Bonus Available on {offer_name}! ({code} - {bonus_text})"
        frontend_url = os.getenv('FRONTEND_URL', 'https://moustacheleads.com')
        
        html_content = f"""
<html>
<body style="font-family: Arial, sans-serif; background-color: #f3f4f6; margin: 0; padding: 20px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6;">
        <tr>
            <td align="center" style="padding: 20px;">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <tr>
                        <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center; border-radius: 8px 8px 0 0;">
                            <h1 style="color: white; margin: 0; font-size: 28px;">🎉 New Bonus Available!</h1>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 40px 30px;">
                            <p style="color: #374151; font-size: 16px; margin: 0 0 20px 0;">Hi there,</p>
                            <p style="color: #374151; font-size: 16px; margin: 0 0 30px 0;">Great news! A new bonus is now available on one of your offers:</p>
                            <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; border-left: 4px solid #667eea; margin: 0 0 30px 0;">
                                <tr>
                                    <td style="padding: 20px;">
                                        <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 12px; text-transform: uppercase;">Offer</p>
                                        <p style="margin: 0 0 20px 0; color: #1f2937; font-size: 18px; font-weight: bold;">{offer_name}</p>
                                        <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 12px; text-transform: uppercase;">Promo Code</p>
                                        <p style="margin: 0 0 20px 0; color: #667eea; font-size: 24px; font-weight: bold; font-family: monospace;">{code}</p>
                                        <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 12px; text-transform: uppercase;">Bonus</p>
                                        <p style="margin: 0; color: #059669; font-size: 20px; font-weight: bold;">{bonus_text}</p>
                                    </td>
                                </tr>
                            </table>
                            <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                                <tr>
                                    <td align="center">
                                        <a href="{frontend_url}/admin/offers" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 40px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">View Offer</a>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <tr>
                        <td style="background-color: #f9fafb; padding: 20px 30px; border-top: 1px solid #e5e7eb; border-radius: 0 0 8px 8px; text-align: center;">
                            <p style="margin: 0; color: #9ca3af; font-size: 13px;">MustacheLeads</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
"""
        return self._send_email(recipient_email, subject, html_content)
    
    def send_new_promo_code_available(self, recipient_email: str, code: str, bonus_amount: float, bonus_type: str, description: str = '') -> bool:
        """Send notification when new promo code is created"""
        if not self.is_configured:
            return False
        
        bonus_text = f"{bonus_amount}%" if bonus_type == "percentage" else f"${bonus_amount:.2f}"
        subject = f"✨ New Promo Code Available: {code} ({bonus_text} Bonus)"
        frontend_url = os.getenv('FRONTEND_URL', 'https://moustacheleads.com')
        
        desc_html = f'<p style="color: #374151; font-size: 14px; margin: 0 0 20px 0;"><strong>About this code:</strong><br/>{description}</p>' if description else ''
        
        html_content = f"""
<html>
<body style="font-family: Arial, sans-serif; background-color: #f3f4f6; margin: 0; padding: 20px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6;">
        <tr>
            <td align="center" style="padding: 20px;">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <tr>
                        <td style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); padding: 40px 20px; text-align: center; border-radius: 8px 8px 0 0;">
                            <h1 style="color: white; margin: 0; font-size: 28px;">✨ New Promo Code!</h1>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 40px 30px;">
                            <p style="color: #374151; font-size: 16px; margin: 0 0 30px 0;">A new promo code is now available for you to use!</p>
                            <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); border-radius: 8px; margin: 0 0 30px 0;">
                                <tr>
                                    <td style="padding: 30px; text-align: center;">
                                        <p style="margin: 0 0 10px 0; color: rgba(255,255,255,0.9); font-size: 12px; text-transform: uppercase;">Promo Code</p>
                                        <p style="margin: 0 0 20px 0; color: white; font-size: 32px; font-weight: bold; font-family: monospace; letter-spacing: 2px;">{code}</p>
                                        <p style="margin: 0; color: rgba(255,255,255,0.9); font-size: 14px;">Earn <strong>{bonus_text}</strong> on every conversion</p>
                                    </td>
                                </tr>
                            </table>
                            {desc_html}
                            <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                                <tr>
                                    <td align="center">
                                        <a href="{frontend_url}/dashboard/promo-codes" style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 14px 40px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">View Promo Codes</a>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <tr>
                        <td style="background-color: #f9fafb; padding: 20px 30px; border-top: 1px solid #e5e7eb; border-radius: 0 0 8px 8px; text-align: center;">
                            <p style="margin: 0; color: #9ca3af; font-size: 13px;">MustacheLeads</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
"""
        return self._send_email(recipient_email, subject, html_content)
    
    def send_gift_card_email(self, recipient_email: str, user_name: str, gift_card_code: str, 
                            gift_card_name: str, gift_card_amount: float, 
                            gift_card_image: str = '', expiry_date: datetime = None) -> bool:
        """Send gift card email to user"""
        if not self.is_configured:
            return False
        
        expiry_text = f"Valid until {expiry_date.strftime('%B %d, %Y')}" if expiry_date else ''
        if not gift_card_image:
            gift_card_image = 'https://images.unsplash.com/photo-1549465220-1a8b9238cd48?w=800&h=400&fit=crop'
        
        subject = f"🎁 You've Received a Gift Card: ${gift_card_amount:.2f}!"
        frontend_url = os.getenv('FRONTEND_URL', 'https://moustacheleads.com')
        
        expiry_html = f'<p style="text-align: center; color: #f59e0b; font-size: 14px; font-weight: 600; margin: 20px 0;">⏰ {expiry_text}</p>' if expiry_text else ''
        
        html_content = f"""
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Gift Card - {gift_card_name}</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; background-color: #f4f6f9;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f4f6f9; padding: 20px 0;">
        <tr>
            <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
                    <tr>
                        <td style="background: linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%); padding: 40px 20px; text-align: center;">
                            <h1 style="margin: 0; color: #ffffff; font-size: 48px; font-weight: 700;">🎁</h1>
                            <h2 style="margin: 15px 0 0 0; color: #ffffff; font-size: 28px; font-weight: 700;">You've Got a Gift!</h2>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 40px 30px;">
                            <p style="text-align: center; font-size: 20px; color: #1f2937; font-weight: 600; margin: 0 0 30px 0;">Hi {user_name}! 👋</p>
                            <p style="text-align: center; font-size: 16px; color: #6b7280; margin: 0 0 30px 0;">You've received a special gift card! Redeem it now to add credits to your account.</p>
                            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 20px 0;">
                                <tr>
                                    <td style="padding: 0;">
                                        <img src="{gift_card_image}" alt="{gift_card_name}" style="width: 100%; height: auto; max-height: 300px; object-fit: cover; display: block; border-radius: 8px;" />
                                    </td>
                                </tr>
                            </table>
                            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background: linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%); border-radius: 12px; margin: 20px 0; padding: 30px; text-align: center;">
                                <tr>
                                    <td>
                                        <p style="margin: 0 0 10px 0; color: rgba(255,255,255,0.9); font-size: 14px; text-transform: uppercase;">Gift Card</p>
                                        <h3 style="margin: 0 0 20px 0; color: #ffffff; font-size: 24px; font-weight: 700;">{gift_card_name}</h3>
                                        <p style="margin: 0 0 10px 0; color: rgba(255,255,255,0.9); font-size: 14px; text-transform: uppercase;">Amount</p>
                                        <p style="margin: 0 0 30px 0; color: #ffffff; font-size: 48px; font-weight: 700;">${gift_card_amount:.2f}</p>
                                        <p style="margin: 0 0 10px 0; color: rgba(255,255,255,0.9); font-size: 14px; text-transform: uppercase;">Your Code</p>
                                        <p style="margin: 0; color: #ffffff; font-size: 32px; font-weight: 700; font-family: monospace; letter-spacing: 3px; background-color: rgba(255,255,255,0.2); padding: 15px; border-radius: 8px;">{gift_card_code}</p>
                                    </td>
                                </tr>
                            </table>
                            {expiry_html}
                            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 30px 0;">
                                <tr>
                                    <td align="center">
                                        <a href="{frontend_url}/dashboard/gift-cards" style="display: inline-block; background: linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%); color: #ffffff; padding: 16px 50px; text-decoration: none; border-radius: 50px; font-weight: 700; font-size: 16px; text-transform: uppercase;">REDEEM NOW →</a>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <tr>
                        <td style="background-color: #1f2937; padding: 30px; text-align: center;">
                            <p style="margin: 0 0 15px 0; color: #ffffff; font-size: 20px; font-weight: 700;">MustacheLeads</p>
                            <p style="margin: 20px 0 0 0; color: #6b7280; font-size: 12px;">© {datetime.now().year} MustacheLeads. All rights reserved.</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
"""
        return self._send_email(recipient_email, subject, html_content)


# Singleton instance
email_service = EmailService()


def get_email_service() -> EmailService:
    """Get the singleton email service instance"""
    return email_service


def send_gift_card_email(recipient_email: str, user_name: str, gift_card_code: str, 
                         gift_card_name: str, gift_card_amount: float, 
                         gift_card_image: str = '', expiry_date: datetime = None) -> bool:
    """Convenience function to send gift card email"""
    return email_service.send_gift_card_email(
        recipient_email, user_name, gift_card_code, 
        gift_card_name, gift_card_amount, gift_card_image, expiry_date
    )
