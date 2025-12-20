import smtplib
import os
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime
from typing import List, Dict, Optional
import threading

logger = logging.getLogger(__name__)


class EmailService:
    """Service for sending email notifications"""
    
    def __init__(self):
        self.smtp_server = os.getenv('SMTP_SERVER', 'smtp.gmail.com')
        self.smtp_port = int(os.getenv('SMTP_PORT', '587'))
        self.smtp_username = os.getenv('SMTP_USERNAME')
        self.smtp_password = os.getenv('SMTP_PASSWORD')
        self.from_email = os.getenv('FROM_EMAIL')
        self.email_debug = os.getenv('EMAIL_DEBUG', 'false').lower() == 'true'
        
        # Check if email is configured
        self.is_configured = all([
            self.smtp_username,
            self.smtp_password,
            self.from_email
        ])
        
        if not self.is_configured:
            logger.warning("⚠️ Email service not fully configured. Check SMTP settings in .env")
    
    def _create_offer_update_email_html(self, offer_data: Dict, update_type: str = 'promo_code') -> str:
        """Create HTML email template for offer update notification (promo codes, etc)"""
        
        offer_name = offer_data.get('name', 'Offer Update')
        payout = offer_data.get('payout', 0)
        currency = offer_data.get('currency', 'USD')
        description = offer_data.get('description', 'No description provided')
        category = offer_data.get('category', 'General')
        
        # Get offer image
        offer_image = (
            offer_data.get('image_url') or 
            offer_data.get('thumbnail_url') or
            offer_data.get('preview_url') or 
            offer_data.get('creative_url') or 
            'https://images.unsplash.com/photo-1557821552-17105176677c?w=800&h=400&fit=crop'
        )
        
        # Get current day of week
        days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
        current_day = days[datetime.now().weekday()]
        
        # Determine update message based on type
        update_message = "Offer Updated"
        update_details = "This offer has been updated with new information."
        
        if update_type == 'promo_code':
            update_message = "🎉 New Promo Code Available!"
            update_details = f"A new promo code has been added to {offer_name}. Check it out and boost your conversions!"
        elif update_type == 'payout_increase':
            update_message = "💰 Payout Increased!"
            update_details = f"The payout for {offer_name} has been increased. Don't miss this opportunity!"
        elif update_type == 'general_update':
            update_message = "📢 Offer Updated"
            update_details = f"{offer_name} has been updated with new details. Check the changes!"
        
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
                <!-- Main Container -->
                <table width="600" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
                    
                    <!-- Header -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 40px 20px; text-align: center;">
                            <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: 700;">{update_message}</h1>
                            <p style="margin: 10px 0 0 0; color: #ffffff; font-size: 18px; opacity: 0.95;">Happy {current_day}!</p>
                        </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                        <td style="padding: 40px 30px;">
                            <!-- Message -->
                            <p style="text-align: center; font-size: 18px; color: #1f2937; font-weight: 600; margin: 0 0 30px 0;">
                                {update_details}
                            </p>
                            
                            <!-- Offer Card -->
                            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f9fafb; border-radius: 12px; overflow: hidden; margin: 20px 0;">
                                <!-- Offer Image -->
                                <tr>
                                    <td style="padding: 0; position: relative;">
                                        <img src="{offer_image}" alt="{offer_name}" style="width: 100%; height: auto; max-height: 300px; object-fit: cover; display: block;" />
                                    </td>
                                </tr>
                                
                                <!-- Offer Details -->
                                <tr>
                                    <td style="padding: 30px; background-color: #ffffff;">
                                        <h2 style="margin: 0 0 15px 0; color: #111827; font-size: 24px; font-weight: 700; line-height: 1.3;">{offer_name}</h2>
                                        <span style="display: inline-block; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: #ffffff; padding: 8px 20px; border-radius: 20px; font-size: 14px; font-weight: 600;">📁 {category}</span>
                                    </td>
                                </tr>
                            </table>
                            
                            <!-- CTA Button -->
                            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 30px 0;">
                                <tr>
                                    <td align="center">
                                        <a href="http://localhost:5173/offers" style="display: inline-block; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: #ffffff; padding: 16px 50px; text-decoration: none; border-radius: 50px; font-weight: 700; font-size: 16px; text-transform: uppercase; letter-spacing: 1px; box-shadow: 0 4px 15px rgba(245,158,11,0.4);">VIEW OFFER →</a>
                                    </td>
                                </tr>
                            </table>
                            
                            <!-- Closing -->
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
                    
                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #1f2937; padding: 30px; text-align: center;">
                            <p style="margin: 0 0 15px 0; color: #ffffff; font-size: 20px; font-weight: 700;">MustacheLeads</p>
                            <p style="margin: 0 0 20px 0; color: #9ca3af; font-size: 13px; line-height: 1.6;">This email was sent to you because you are a registered publisher.</p>
                            <p style="margin: 0;">
                                <a href="#" style="color: #60a5fa; text-decoration: none; margin: 0 8px; font-size: 13px;">Manage Email Preferences</a>
                                <span style="color: #6b7280;">|</span>
                                <a href="#" style="color: #60a5fa; text-decoration: none; margin: 0 8px; font-size: 13px;">Unsubscribe</a>
                                <span style="color: #6b7280;">|</span>
                                <a href="#" style="color: #60a5fa; text-decoration: none; margin: 0 8px; font-size: 13px;">Contact Support</a>
                            </p>
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
        offer_id = offer_data.get('offer_id', 'N/A')
        payout = offer_data.get('payout', 0)
        currency = offer_data.get('currency', 'USD')
        description = offer_data.get('description', 'No description provided')
        category = offer_data.get('category', 'General')
        network = offer_data.get('network', 'Unknown')
        countries = offer_data.get('countries', [])
        
        # Get offer image or use default - check multiple possible fields
        # Priority: image_url (main field) -> thumbnail_url -> preview_url -> creative_url -> default
        offer_image = (
            offer_data.get('image_url') or 
            offer_data.get('thumbnail_url') or
            offer_data.get('preview_url') or 
            offer_data.get('creative_url') or 
            'https://images.unsplash.com/photo-1557821552-17105176677c?w=800&h=400&fit=crop'
        )
        logger.info(f"📸 Offer image URL being used: {offer_image}")
        logger.info(f"📦 Available image fields in offer_data: image_url={offer_data.get('image_url')}, thumbnail_url={offer_data.get('thumbnail_url')}, preview_url={offer_data.get('preview_url')}")
        
        # Get current day of week
        days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
        current_day = days[datetime.now().weekday()]
        
        # Format countries
        countries_str = ', '.join(countries) if countries else 'All Countries'
        
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
                <!-- Main Container -->
                <table width="600" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
                    
                    <!-- Header -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 40px 20px; text-align: center;">
                            <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: 700;">Hey All! 👋</h1>
                            <p style="margin: 10px 0 0 0; color: #ffffff; font-size: 18px; opacity: 0.95;">Happy {current_day}!</p>
                        </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                        <td style="padding: 40px 30px;">
                            <!-- Message -->
                            <p style="text-align: center; font-size: 20px; color: #1f2937; font-weight: 600; margin: 0 0 30px 0;">
                                🚀 Please push more traffic on this offer!
                            </p>
                            
                            <!-- Offer Card -->
                            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f9fafb; border-radius: 12px; overflow: hidden; margin: 20px 0;">
                                <!-- Offer Image -->
                                <tr>
                                    <td style="padding: 0; position: relative;">
                                        <img src="{offer_image}" alt="{offer_name}" style="width: 100%; height: auto; max-height: 300px; object-fit: cover; display: block;" />
                                    </td>
                                </tr>
                                
                                <!-- Offer Details -->
                                <tr>
                                    <td style="padding: 30px; background-color: #ffffff;">
                                        <h2 style="margin: 0 0 15px 0; color: #111827; font-size: 24px; font-weight: 700; line-height: 1.3;">{offer_name}</h2>
                                        <span style="display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: #ffffff; padding: 8px 20px; border-radius: 20px; font-size: 14px; font-weight: 600;">📁 {category}</span>
                                    </td>
                                </tr>
                            </table>
                            
                            <!-- CTA Button -->
                            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 30px 0;">
                                <tr>
                                    <td align="center">
                                        <a href="http://localhost:5173/offers" style="display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: #ffffff; padding: 16px 50px; text-decoration: none; border-radius: 50px; font-weight: 700; font-size: 16px; text-transform: uppercase; letter-spacing: 1px; box-shadow: 0 4px 15px rgba(99,102,241,0.4);">CHECK NOW →</a>
                                    </td>
                                </tr>
                            </table>
                            
                            <!-- Closing -->
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
                    
                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #1f2937; padding: 30px; text-align: center;">
                            <p style="margin: 0 0 15px 0; color: #ffffff; font-size: 20px; font-weight: 700;">Ascend Affiliate Network</p>
                            <p style="margin: 0 0 20px 0; color: #9ca3af; font-size: 13px; line-height: 1.6;">This email was sent to you because you are a registered publisher.</p>
                            <p style="margin: 0;">
                                <a href="#" style="color: #60a5fa; text-decoration: none; margin: 0 8px; font-size: 13px;">Manage Email Preferences</a>
                                <span style="color: #6b7280;">|</span>
                                <a href="#" style="color: #60a5fa; text-decoration: none; margin: 0 8px; font-size: 13px;">Unsubscribe</a>
                                <span style="color: #6b7280;">|</span>
                                <a href="#" style="color: #60a5fa; text-decoration: none; margin: 0 8px; font-size: 13px;">Contact Support</a>
                            </p>
                            <p style="margin: 20px 0 0 0; color: #6b7280; font-size: 12px;">© {datetime.now().year} Ascend. All rights reserved.</p>
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
    
    def _send_email(self, to_email: str, subject: str, html_content: str) -> bool:
        """Send email using SMTP"""
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
            with smtplib.SMTP(self.smtp_server, self.smtp_port) as server:
                server.starttls()
                server.login(self.smtp_username, self.smtp_password)
                server.send_message(msg)
            
            logger.info(f"✅ Email sent successfully to: {to_email}")
            return True
            
        except Exception as e:
            logger.error(f"❌ Failed to send email to {to_email}: {str(e)}")
            return False
    
    def send_new_offer_notification(self, offer_data: Dict, recipients: List[str]) -> Dict:
        """
        Send new offer notification to multiple recipients
        
        Args:
            offer_data: Dictionary containing offer details
            recipients: List of email addresses
            
        Returns:
            Dictionary with success/failure counts
        """
        if not self.is_configured:
            logger.warning("⚠️ Email service not configured. Skipping email notifications.")
            return {
                'total': len(recipients),
                'sent': 0,
                'failed': len(recipients),
                'error': 'Email service not configured'
            }
        
        if not recipients:
            logger.warning("⚠️ No recipients provided for email notification")
            return {
                'total': 0,
                'sent': 0,
                'failed': 0,
                'error': 'No recipients'
            }
        
        offer_name = offer_data.get('name', 'New Offer')
        # Get current day for subject
        days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
        current_day = days[datetime.now().weekday()]
        subject = f"🚀 Happy {current_day}! New Offer: {offer_name} - Push More Traffic!"
        
        # Create HTML content
        html_content = self._create_new_offer_email_html(offer_data)
        
        # Send emails
        sent_count = 0
        failed_count = 0
        
        logger.info(f"📧 Sending new offer notification to {len(recipients)} recipients...")
        
        for recipient in recipients:
            if self._send_email(recipient, subject, html_content):
                sent_count += 1
            else:
                failed_count += 1
        
        result = {
            'total': len(recipients),
            'sent': sent_count,
            'failed': failed_count,
            'offer_name': offer_name
        }
        
        logger.info(f"📊 Email notification results: {sent_count} sent, {failed_count} failed")
        
        return result
    
    def send_new_offer_notification_async(self, offer_data: Dict, recipients: List[str]) -> None:
        """
        Send new offer notification asynchronously (non-blocking)
        
        Args:
            offer_data: Dictionary containing offer details
            recipients: List of email addresses
        """
        def send_in_background():
            try:
                logger.info(f"🔄 Background thread started - sending to {len(recipients)} recipients")
                result = self.send_new_offer_notification(offer_data, recipients)
                logger.info(f"✅ Background email sending complete: {result}")
            except Exception as e:
                logger.error(f"❌ Error in background email sending: {str(e)}", exc_info=True)
        
        # Start background thread (non-daemon to ensure completion)
        thread = threading.Thread(target=send_in_background, daemon=False)
        thread.start()
        logger.info(f"📧 Email notification started in background thread for {len(recipients)} recipients")
    
    def send_offer_update_notification(self, offer_data: Dict, recipients: List[str], update_type: str = 'promo_code') -> Dict:
        """
        Send offer update notification to multiple recipients
        
        Args:
            offer_data: Dictionary containing offer details
            recipients: List of email addresses
            update_type: Type of update (promo_code, payout_increase, general_update)
            
        Returns:
            Dictionary with success/failure counts
        """
        if not self.is_configured:
            logger.warning("⚠️ Email service not configured. Skipping email notifications.")
            return {
                'total': len(recipients),
                'sent': 0,
                'failed': len(recipients),
                'error': 'Email service not configured'
            }
        
        if not recipients:
            logger.warning("⚠️ No recipients provided for offer update notification")
            return {
                'total': 0,
                'sent': 0,
                'failed': 0,
                'error': 'No recipients'
            }
        
        offer_name = offer_data.get('name', 'Offer Update')
        
        # Create subject based on update type
        if update_type == 'promo_code':
            subject = f"🎉 New Promo Code Available for {offer_name}!"
        elif update_type == 'payout_increase':
            subject = f"💰 Payout Increased for {offer_name}!"
        else:
            subject = f"📢 {offer_name} Has Been Updated!"
        
        # Create HTML content
        html_content = self._create_offer_update_email_html(offer_data, update_type)
        
        # Send emails
        sent_count = 0
        failed_count = 0
        
        logger.info(f"📧 Sending offer update notification ({update_type}) to {len(recipients)} recipients...")
        
        for recipient in recipients:
            if self._send_email(recipient, subject, html_content):
                sent_count += 1
            else:
                failed_count += 1
        
        result = {
            'total': len(recipients),
            'sent': sent_count,
            'failed': failed_count,
            'offer_name': offer_name,
            'update_type': update_type
        }
        
        logger.info(f"📊 Offer update notification results: {sent_count} sent, {failed_count} failed")
        
        return result
    
    def send_offer_update_notification_async(self, offer_data: Dict, recipients: List[str], update_type: str = 'promo_code') -> None:
        """
        Send offer update notification asynchronously (non-blocking)
        
        Args:
            offer_data: Dictionary containing offer details
            recipients: List of email addresses
            update_type: Type of update (promo_code, payout_increase, general_update)
        """
        def send_in_background():
            try:
                logger.info(f"🔄 Background thread started - sending {update_type} update to {len(recipients)} recipients")
                result = self.send_offer_update_notification(offer_data, recipients, update_type)
                logger.info(f"✅ Background offer update email sending complete: {result}")
            except Exception as e:
                logger.error(f"❌ Error in background offer update email sending: {str(e)}", exc_info=True)
        
        # Start background thread (non-daemon to ensure completion)
        thread = threading.Thread(target=send_in_background, daemon=False)
        thread.start()
        logger.info(f"📧 Offer update notification ({update_type}) started in background thread for {len(recipients)} recipients")
    
    def _create_approval_email_html(self, offer_name: str, status: str, reason: str = '', offer_id: str = '') -> str:
        """Create HTML email template for offer/placement approval notification"""
        
        # Determine status-specific content
        if status == 'approved':
            header_color = '#10b981'  # Green
            header_gradient = 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
            icon = '✅'
            title = 'Offer Approved!'
            message = f'Great news! Your offer "{offer_name}" has been approved and is now live.'
            button_text = 'VIEW OFFER'
            button_color = '#10b981'
        elif status == 'rejected':
            header_color = '#ef4444'  # Red
            header_gradient = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
            icon = '❌'
            title = 'Offer Rejected'
            message = f'Unfortunately, your offer "{offer_name}" was not approved.'
            button_text = 'EDIT OFFER'
            button_color = '#ef4444'
        else:  # pending
            header_color = '#f59e0b'  # Amber
            header_gradient = 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
            icon = '⏳'
            title = 'Offer Under Review'
            message = f'Your offer "{offer_name}" is currently under review.'
            button_text = 'VIEW STATUS'
            button_color = '#f59e0b'
        
        reason_section = ''
        if reason:
            reason_section = f"""
            <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid {header_color};">
                <p style="margin: 0 0 10px 0; color: #374151; font-weight: 600;">Reason:</p>
                <p style="margin: 0; color: #6b7280; line-height: 1.6;">{reason}</p>
            </div>
            """
        
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
                <!-- Main Container -->
                <table width="600" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
                    
                    <!-- Header -->
                    <tr>
                        <td style="background: {header_gradient}; padding: 40px 20px; text-align: center;">
                            <h1 style="margin: 0; color: #ffffff; font-size: 48px; font-weight: 700;">{icon}</h1>
                            <h2 style="margin: 15px 0 0 0; color: #ffffff; font-size: 28px; font-weight: 700;">{title}</h2>
                        </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                        <td style="padding: 40px 30px;">
                            <!-- Message -->
                            <p style="text-align: center; font-size: 18px; color: #1f2937; font-weight: 600; margin: 0 0 30px 0;">
                                {message}
                            </p>
                            
                            <!-- Offer Details Card -->
                            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f9fafb; border-radius: 8px; padding: 20px; margin: 20px 0; border: 1px solid #e5e7eb;">
                                <tr>
                                    <td>
                                        <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 13px; text-transform: uppercase; font-weight: 600; letter-spacing: 0.5px;">Offer Name</p>
                                        <p style="margin: 0 0 20px 0; color: #111827; font-size: 18px; font-weight: 700;">{offer_name}</p>
                                        
                                        {reason_section}
                                    </td>
                                </tr>
                            </table>
                            
                            <!-- CTA Button -->
                            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 30px 0;">
                                <tr>
                                    <td align="center">
                                        <a href="http://localhost:5173/dashboard/offers" style="display: inline-block; background: {header_gradient}; color: #ffffff; padding: 16px 50px; text-decoration: none; border-radius: 50px; font-weight: 700; font-size: 16px; text-transform: uppercase; letter-spacing: 1px; box-shadow: 0 4px 15px rgba(0,0,0,0.2);">{button_text} →</a>
                                    </td>
                                </tr>
                            </table>
                            
                            <!-- Next Steps -->
                            <div style="background-color: #f0f9ff; padding: 20px; border-radius: 8px; border-left: 4px solid #3b82f6; margin: 20px 0;">
                                <p style="margin: 0 0 10px 0; color: #1e40af; font-weight: 600;">Next Steps:</p>
                                <ul style="margin: 0; padding-left: 20px; color: #1e40af; font-size: 14px; line-height: 1.8;">
                                    <li>Review the offer details</li>
                                    <li>Make any necessary updates</li>
                                    <li>Monitor performance in your dashboard</li>
                                </ul>
                            </div>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #1f2937; padding: 30px; text-align: center;">
                            <p style="margin: 0 0 15px 0; color: #ffffff; font-size: 20px; font-weight: 700;">MustacheLeads</p>
                            <p style="margin: 0 0 20px 0; color: #9ca3af; font-size: 13px; line-height: 1.6;">Your gateway to premium affiliate opportunities</p>
                            <p style="margin: 0;">
                                <a href="#" style="color: #60a5fa; text-decoration: none; margin: 0 8px; font-size: 13px;">Manage Email Preferences</a>
                                <span style="color: #6b7280;">|</span>
                                <a href="#" style="color: #60a5fa; text-decoration: none; margin: 0 8px; font-size: 13px;">Contact Support</a>
                            </p>
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
        """
        Send offer/placement approval/rejection notification
        
        Args:
            recipient_email: Publisher's email address
            offer_name: Name of the offer
            status: 'approved', 'rejected', or 'pending'
            reason: Reason for rejection (if applicable)
            offer_id: ID of the offer
            
        Returns:
            Boolean indicating success
        """
        if not self.is_configured:
            logger.warning("⚠️ Email service not configured. Skipping approval notification.")
            return False
        
        if status == 'approved':
            subject = f"✅ Your Offer '{offer_name}' Has Been Approved!"
        elif status == 'rejected':
            subject = f"❌ Your Offer '{offer_name}' Was Not Approved"
        else:
            subject = f"⏳ Your Offer '{offer_name}' Is Under Review"
        
        html_content = self._create_approval_email_html(offer_name, status, reason, offer_id)
        
        return self._send_email(recipient_email, subject, html_content)
    
    def send_approval_notification_async(self, recipient_email: str, offer_name: str, status: str, reason: str = '', offer_id: str = '') -> None:
        """
        Send approval notification asynchronously (non-blocking)
        
        Args:
            recipient_email: Publisher's email address
            offer_name: Name of the offer
            status: 'approved', 'rejected', or 'pending'
            reason: Reason for rejection (if applicable)
            offer_id: ID of the offer
        """
        def send_in_background():
            try:
                logger.info(f"🔄 Background thread started - sending {status} notification to {recipient_email}")
                result = self.send_approval_notification(recipient_email, offer_name, status, reason, offer_id)
                logger.info(f"✅ Background approval notification sending complete: {result}")
            except Exception as e:
                logger.error(f"❌ Error sending approval notification: {str(e)}", exc_info=True)
        
        # Start background thread (non-daemon to ensure completion)
        thread = threading.Thread(target=send_in_background, daemon=False)
        thread.start()
        logger.info(f"📧 Approval notification ({status}) started in background thread for {recipient_email}")
    
    def send_promo_code_assigned_to_offer(self, recipient_email: str, offer_name: str, code: str, bonus_amount: float, bonus_type: str, offer_id: str = '') -> bool:
        """
        Send notification when admin assigns promo code to offer
        
        Args:
            recipient_email: Publisher's email address
            offer_name: Name of the offer
            code: Promo code (e.g., "SUMMER20")
            bonus_amount: Bonus amount (e.g., 20)
            bonus_type: Type of bonus ("percentage" or "fixed")
            offer_id: ID of the offer
            
        Returns:
            Boolean indicating success
        """
        if not self.is_configured:
            logger.warning("⚠️ Email service not configured. Skipping promo code notification.")
            return False
        
        bonus_text = f"{bonus_amount}%" if bonus_type == "percentage" else f"${bonus_amount:.2f}"
        subject = f"🎉 New Bonus Available on {offer_name}! ({code} - {bonus_text})"
        
        html_content = f"""
<html>
<body style="font-family: Arial, sans-serif; background-color: #f3f4f6; margin: 0; padding: 20px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6;">
        <tr>
            <td align="center" style="padding: 20px;">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    
                    <!-- Header -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center; border-radius: 8px 8px 0 0;">
                            <h1 style="color: white; margin: 0; font-size: 28px;">🎉 New Bonus Available!</h1>
                        </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                        <td style="padding: 40px 30px;">
                            <p style="color: #374151; font-size: 16px; margin: 0 0 20px 0;">Hi there,</p>
                            
                            <p style="color: #374151; font-size: 16px; margin: 0 0 30px 0;">
                                Great news! A new bonus is now available on one of your offers:
                            </p>
                            
                            <!-- Offer Details Box -->
                            <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; border-left: 4px solid #667eea; margin: 0 0 30px 0;">
                                <tr>
                                    <td style="padding: 20px;">
                                        <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Offer</p>
                                        <p style="margin: 0 0 20px 0; color: #1f2937; font-size: 18px; font-weight: bold;">{offer_name}</p>
                                        
                                        <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Promo Code</p>
                                        <p style="margin: 0 0 20px 0; color: #667eea; font-size: 24px; font-weight: bold; font-family: 'Courier New', monospace;">{code}</p>
                                        
                                        <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Bonus</p>
                                        <p style="margin: 0; color: #059669; font-size: 20px; font-weight: bold;">{bonus_text}</p>
                                    </td>
                                </tr>
                            </table>
                            
                            <p style="color: #374151; font-size: 16px; margin: 0 0 20px 0;">
                                Your users will earn <strong>{bonus_text}</strong> extra on every conversion from this offer!
                            </p>
                            
                            <!-- CTA Button -->
                            <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                                <tr>
                                    <td align="center">
                                        <a href="http://localhost:3000/admin/offers" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 40px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; font-size: 16px;">
                                            View Offer
                                        </a>
                                    </td>
                                </tr>
                            </table>
                            
                            <p style="color: #6b7280; font-size: 14px; margin: 30px 0 0 0; border-top: 1px solid #e5e7eb; padding-top: 20px;">
                                This bonus will be automatically applied to conversions from this offer.
                            </p>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #f9fafb; padding: 20px 30px; border-top: 1px solid #e5e7eb; border-radius: 0 0 8px 8px; text-align: center;">
                            <p style="margin: 0 0 10px 0; color: #9ca3af; font-size: 13px;">MustacheLeads</p>
                            <p style="margin: 0;">
                                <a href="#" style="color: #60a5fa; text-decoration: none; margin: 0 8px; font-size: 13px;">Manage Preferences</a>
                                <span style="color: #6b7280;">|</span>
                                <a href="#" style="color: #60a5fa; text-decoration: none; margin: 0 8px; font-size: 13px;">Contact Support</a>
                            </p>
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
        """
        Send notification when new promo code is created
        
        Args:
            recipient_email: Publisher's email address
            code: Promo code (e.g., "SUMMER20")
            bonus_amount: Bonus amount (e.g., 20)
            bonus_type: Type of bonus ("percentage" or "fixed")
            description: Code description
            
        Returns:
            Boolean indicating success
        """
        if not self.is_configured:
            logger.warning("⚠️ Email service not configured. Skipping new code notification.")
            return False
        
        bonus_text = f"{bonus_amount}%" if bonus_type == "percentage" else f"${bonus_amount:.2f}"
        subject = f"✨ New Promo Code Available: {code} ({bonus_text} Bonus)"
        
        html_content = f"""
<html>
<body style="font-family: Arial, sans-serif; background-color: #f3f4f6; margin: 0; padding: 20px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6;">
        <tr>
            <td align="center" style="padding: 20px;">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    
                    <!-- Header -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); padding: 40px 20px; text-align: center; border-radius: 8px 8px 0 0;">
                            <h1 style="color: white; margin: 0; font-size: 28px;">✨ New Promo Code!</h1>
                        </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                        <td style="padding: 40px 30px;">
                            <p style="color: #374151; font-size: 16px; margin: 0 0 20px 0;">Hi there,</p>
                            
                            <p style="color: #374151; font-size: 16px; margin: 0 0 30px 0;">
                                A new promo code is now available for you to use!
                            </p>
                            
                            <!-- Code Details Box -->
                            <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); border-radius: 8px; margin: 0 0 30px 0;">
                                <tr>
                                    <td style="padding: 30px; text-align: center;">
                                        <p style="margin: 0 0 10px 0; color: rgba(255,255,255,0.9); font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Promo Code</p>
                                        <p style="margin: 0 0 20px 0; color: white; font-size: 32px; font-weight: bold; font-family: 'Courier New', monospace; letter-spacing: 2px;">{code}</p>
                                        
                                        <p style="margin: 0; color: rgba(255,255,255,0.9); font-size: 14px;">Earn <strong>{bonus_text}</strong> on every conversion</p>
                                    </td>
                                </tr>
                            </table>
                            
                            {f'<p style="color: #374151; font-size: 14px; margin: 0 0 20px 0;"><strong>About this code:</strong><br/>{description}</p>' if description else ''}
                            
                            <p style="color: #374151; font-size: 16px; margin: 0 0 20px 0;">
                                You can apply this code to any offer you're promoting to start earning <strong>{bonus_text}</strong> extra on conversions!
                            </p>
                            
                            <!-- CTA Button -->
                            <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                                <tr>
                                    <td align="center">
                                        <a href="http://localhost:3000/dashboard/promo-codes" style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 14px 40px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; font-size: 16px;">
                                            View Promo Codes
                                        </a>
                                    </td>
                                </tr>
                            </table>
                            
                            <p style="color: #6b7280; font-size: 14px; margin: 30px 0 0 0; border-top: 1px solid #e5e7eb; padding-top: 20px;">
                                This code is valid until the expiration date. Apply it to your offers to maximize your earnings!
                            </p>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #f9fafb; padding: 20px 30px; border-top: 1px solid #e5e7eb; border-radius: 0 0 8px 8px; text-align: center;">
                            <p style="margin: 0 0 10px 0; color: #9ca3af; font-size: 13px;">MustacheLeads</p>
                            <p style="margin: 0;">
                                <a href="#" style="color: #60a5fa; text-decoration: none; margin: 0 8px; font-size: 13px;">Manage Preferences</a>
                                <span style="color: #6b7280;">|</span>
                                <a href="#" style="color: #60a5fa; text-decoration: none; margin: 0 8px; font-size: 13px;">Contact Support</a>
                            </p>
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
        """
        Send gift card email to user
        
        Args:
            recipient_email: User's email address
            user_name: User's name
            gift_card_code: Gift card code
            gift_card_name: Gift card name/title
            gift_card_amount: Gift card amount
            gift_card_image: Gift card image URL (optional)
            expiry_date: Expiry date (optional)
            
        Returns:
            Boolean indicating success
        """
        if not self.is_configured:
            logger.warning("⚠️ Email service not configured. Skipping gift card email.")
            return False
        
        # Format expiry date
        expiry_text = ''
        if expiry_date:
            expiry_text = f"Valid until {expiry_date.strftime('%B %d, %Y')}"
        
        # Default image if none provided
        if not gift_card_image:
            gift_card_image = 'https://images.unsplash.com/photo-1549465220-1a8b9238cd48?w=800&h=400&fit=crop'
        
        subject = f"🎁 You've Received a Gift Card: ${gift_card_amount:.2f}!"
        
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
                <!-- Main Container -->
                <table width="600" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
                    
                    <!-- Header -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%); padding: 40px 20px; text-align: center;">
                            <h1 style="margin: 0; color: #ffffff; font-size: 48px; font-weight: 700;">🎁</h1>
                            <h2 style="margin: 15px 0 0 0; color: #ffffff; font-size: 28px; font-weight: 700;">You've Got a Gift!</h2>
                        </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                        <td style="padding: 40px 30px;">
                            <!-- Greeting -->
                            <p style="text-align: center; font-size: 20px; color: #1f2937; font-weight: 600; margin: 0 0 30px 0;">
                                Hi {user_name}! 👋
                            </p>
                            
                            <p style="text-align: center; font-size: 16px; color: #6b7280; margin: 0 0 30px 0;">
                                You've received a special gift card! Redeem it now to add credits to your account.
                            </p>
                            
                            <!-- Gift Card Image -->
                            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 20px 0;">
                                <tr>
                                    <td style="padding: 0;">
                                        <img src="{gift_card_image}" alt="{gift_card_name}" style="width: 100%; height: auto; max-height: 300px; object-fit: cover; display: block; border-radius: 8px;" />
                                    </td>
                                </tr>
                            </table>
                            
                            <!-- Gift Card Details -->
                            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background: linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%); border-radius: 12px; margin: 20px 0; padding: 30px; text-align: center;">
                                <tr>
                                    <td>
                                        <p style="margin: 0 0 10px 0; color: rgba(255,255,255,0.9); font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">Gift Card</p>
                                        <h3 style="margin: 0 0 20px 0; color: #ffffff; font-size: 24px; font-weight: 700;">{gift_card_name}</h3>
                                        
                                        <p style="margin: 0 0 10px 0; color: rgba(255,255,255,0.9); font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">Amount</p>
                                        <p style="margin: 0 0 30px 0; color: #ffffff; font-size: 48px; font-weight: 700;">${gift_card_amount:.2f}</p>
                                        
                                        <p style="margin: 0 0 10px 0; color: rgba(255,255,255,0.9); font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">Your Code</p>
                                        <p style="margin: 0; color: #ffffff; font-size: 32px; font-weight: 700; font-family: 'Courier New', monospace; letter-spacing: 3px; background-color: rgba(255,255,255,0.2); padding: 15px; border-radius: 8px;">{gift_card_code}</p>
                                    </td>
                                </tr>
                            </table>
                            
                            {f'<p style="text-align: center; color: #f59e0b; font-size: 14px; font-weight: 600; margin: 20px 0;">⏰ {expiry_text}</p>' if expiry_text else ''}
                            
                            <!-- Instructions -->
                            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f0f9ff; padding: 20px; border-radius: 8px; border-left: 4px solid #3b82f6; margin: 30px 0;">
                                <tr>
                                    <td>
                                        <p style="margin: 0 0 10px 0; color: #1e40af; font-weight: 600; font-size: 16px;">How to Redeem:</p>
                                        <ol style="margin: 0; padding-left: 20px; color: #1e40af; font-size: 14px; line-height: 1.8;">
                                            <li>Log in to your account</li>
                                            <li>Go to "Avail Gift Card" section</li>
                                            <li>Enter the code: <strong>{gift_card_code}</strong></li>
                                            <li>Click "Redeem" and enjoy your credits! 🎉</li>
                                        </ol>
                                    </td>
                                </tr>
                            </table>
                            
                            <!-- CTA Button -->
                            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 30px 0;">
                                <tr>
                                    <td align="center">
                                        <a href="http://localhost:5173/dashboard/gift-cards" style="display: inline-block; background: linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%); color: #ffffff; padding: 16px 50px; text-decoration: none; border-radius: 50px; font-weight: 700; font-size: 16px; text-transform: uppercase; letter-spacing: 1px; box-shadow: 0 4px 15px rgba(236,72,153,0.4);">REDEEM NOW →</a>
                                    </td>
                                </tr>
                            </table>
                            
                            <!-- Closing -->
                            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top: 40px; padding-top: 30px; border-top: 2px solid #e5e7eb;">
                                <tr>
                                    <td align="center">
                                        <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 16px;">Enjoy your gift!</p>
                                        <p style="margin: 0; color: #111827; font-size: 18px; font-weight: 600;">Happy Earning! 💰</p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #1f2937; padding: 30px; text-align: center;">
                            <p style="margin: 0 0 15px 0; color: #ffffff; font-size: 20px; font-weight: 700;">Ascend Affiliate Network</p>
                            <p style="margin: 0 0 20px 0; color: #9ca3af; font-size: 13px; line-height: 1.6;">This gift card was sent to you as a special reward.</p>
                            <p style="margin: 0;">
                                <a href="#" style="color: #60a5fa; text-decoration: none; margin: 0 8px; font-size: 13px;">Contact Support</a>
                            </p>
                            <p style="margin: 20px 0 0 0; color: #6b7280; font-size: 12px;">© {datetime.now().year} Ascend. All rights reserved.</p>
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
_email_service_instance = None

def get_email_service() -> EmailService:
    """Get or create email service singleton"""
    global _email_service_instance
    if _email_service_instance is None:
        _email_service_instance = EmailService()
    return _email_service_instance


def send_gift_card_email(to_email: str, user_name: str, gift_card_code: str, 
                        gift_card_name: str, gift_card_amount: float, 
                        gift_card_image: str = '', expiry_date: datetime = None) -> bool:
    """
    Standalone function to send gift card email
    
    Args:
        to_email: Recipient email address
        user_name: User's name
        gift_card_code: Gift card code
        gift_card_name: Gift card name/title
        gift_card_amount: Gift card amount
        gift_card_image: Gift card image URL (optional)
        expiry_date: Expiry date (optional)
        
    Returns:
        Boolean indicating success
    """
    email_service = get_email_service()
    return email_service.send_gift_card_email(
        to_email, user_name, gift_card_code, 
        gift_card_name, gift_card_amount, 
        gift_card_image, expiry_date
    )
