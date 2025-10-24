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
                self.send_new_offer_notification(offer_data, recipients)
            except Exception as e:
                logger.error(f"❌ Error in background email sending: {str(e)}")
        
        # Start background thread
        thread = threading.Thread(target=send_in_background, daemon=True)
        thread.start()
        logger.info("📧 Email notification started in background thread")


# Singleton instance
_email_service_instance = None

def get_email_service() -> EmailService:
    """Get or create email service singleton"""
    global _email_service_instance
    if _email_service_instance is None:
        _email_service_instance = EmailService()
    return _email_service_instance
