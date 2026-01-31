from datetime import datetime, timedelta
from database import db_instance
import logging
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
env_path = Path(__file__).resolve().parent.parent / '.env'
load_dotenv(dotenv_path=env_path)

# Email imports
try:
    import smtplib
    from email.mime.text import MIMEText
    from email.mime.multipart import MIMEMultipart
    EMAIL_AVAILABLE = True
except ImportError:
    EMAIL_AVAILABLE = False
    print("Warning: Email functionality not available")
import os
from threading import Thread
import time

class CapMonitoringService:
    """Service to monitor offer caps and handle auto-pause/alerts"""
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self.offers_collection = db_instance.get_collection('offers')
        self.conversions_collection = db_instance.get_collection('conversions')
        self.alerts_collection = db_instance.get_collection('cap_alerts')
        
        # Email configuration - using new Hostinger SMTP variables
        self.smtp_server = os.getenv('SMTP_HOST', 'smtp.hostinger.com')
        self.smtp_port = int(os.getenv('SMTP_PORT', '465'))
        self.smtp_username = os.getenv('SMTP_USER', '')
        self.smtp_password = os.getenv('SMTP_PASS', '')
        self.from_email = os.getenv('FROM_EMAIL', 'noreply@pepeleads.com')
    
    def check_offer_caps(self, offer_id):
        """
        Check if offer has reached any caps and take action
        
        Args:
            offer_id: Offer ID to check
        
        Returns:
            dict: Cap status information
        """
        try:
            # Get offer
            offer = self.offers_collection.find_one({'offer_id': offer_id, 'is_active': True})
            if not offer:
                return {'error': 'Offer not found'}
            
            # Get current conversion counts
            counts = self._get_conversion_counts(offer_id)
            
            # Check each cap type
            cap_status = {
                'offer_id': offer_id,
                'daily': self._check_daily_cap(offer, counts),
                'weekly': self._check_weekly_cap(offer, counts),
                'monthly': self._check_monthly_cap(offer, counts),
                'total': self._check_total_cap(offer, counts),
                'auto_paused': False,
                'alerts_sent': []
            }
            
            # Check if auto-pause is needed
            if offer.get('auto_pause_on_cap', False):
                should_pause = any([
                    cap_status['daily']['reached'],
                    cap_status['weekly']['reached'],
                    cap_status['monthly']['reached'],
                    cap_status['total']['reached']
                ])
                
                if should_pause and offer.get('status') == 'active':
                    self._auto_pause_offer(offer_id)
                    cap_status['auto_paused'] = True
            
            # Send cap alerts if needed
            cap_alert_emails = offer.get('cap_alert_emails', [])
            if cap_alert_emails:
                alerts_sent = self._send_cap_alerts(offer, cap_status, cap_alert_emails)
                cap_status['alerts_sent'] = alerts_sent
            
            return cap_status
            
        except Exception as e:
            self.logger.error(f"Error checking offer caps: {str(e)}")
            return {'error': str(e)}
    
    def _get_conversion_counts(self, offer_id):
        """Get conversion counts for different time periods"""
        now = datetime.utcnow()
        
        # Define time periods
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        week_start = today_start - timedelta(days=today_start.weekday())
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        
        try:
            # Daily conversions
            daily_count = self.conversions_collection.count_documents({
                'offer_id': offer_id,
                'status': 'approved',
                'conversion_time': {'$gte': today_start}
            })
            
            # Weekly conversions
            weekly_count = self.conversions_collection.count_documents({
                'offer_id': offer_id,
                'status': 'approved',
                'conversion_time': {'$gte': week_start}
            })
            
            # Monthly conversions
            monthly_count = self.conversions_collection.count_documents({
                'offer_id': offer_id,
                'status': 'approved',
                'conversion_time': {'$gte': month_start}
            })
            
            # Total conversions
            total_count = self.conversions_collection.count_documents({
                'offer_id': offer_id,
                'status': 'approved'
            })
            
            return {
                'daily': daily_count,
                'weekly': weekly_count,
                'monthly': monthly_count,
                'total': total_count
            }
            
        except Exception as e:
            self.logger.error(f"Error getting conversion counts: {str(e)}")
            return {'daily': 0, 'weekly': 0, 'monthly': 0, 'total': 0}
    
    def _check_daily_cap(self, offer, counts):
        """Check daily cap status"""
        daily_cap = offer.get('daily_cap')
        if not daily_cap:
            return {'enabled': False, 'current': counts['daily'], 'limit': None, 'reached': False}
        
        reached = counts['daily'] >= daily_cap
        return {
            'enabled': True,
            'current': counts['daily'],
            'limit': daily_cap,
            'reached': reached,
            'percentage': (counts['daily'] / daily_cap) * 100 if daily_cap > 0 else 0
        }
    
    def _check_weekly_cap(self, offer, counts):
        """Check weekly cap status"""
        weekly_cap = offer.get('weekly_cap')
        if not weekly_cap:
            return {'enabled': False, 'current': counts['weekly'], 'limit': None, 'reached': False}
        
        reached = counts['weekly'] >= weekly_cap
        return {
            'enabled': True,
            'current': counts['weekly'],
            'limit': weekly_cap,
            'reached': reached,
            'percentage': (counts['weekly'] / weekly_cap) * 100 if weekly_cap > 0 else 0
        }
    
    def _check_monthly_cap(self, offer, counts):
        """Check monthly cap status"""
        monthly_cap = offer.get('monthly_cap')
        if not monthly_cap:
            return {'enabled': False, 'current': counts['monthly'], 'limit': None, 'reached': False}
        
        reached = counts['monthly'] >= monthly_cap
        return {
            'enabled': True,
            'current': counts['monthly'],
            'limit': monthly_cap,
            'reached': reached,
            'percentage': (counts['monthly'] / monthly_cap) * 100 if monthly_cap > 0 else 0
        }
    
    def _check_total_cap(self, offer, counts):
        """Check total cap status"""
        total_cap = offer.get('limit')  # Using 'limit' field as total cap
        if not total_cap:
            return {'enabled': False, 'current': counts['total'], 'limit': None, 'reached': False}
        
        reached = counts['total'] >= total_cap
        return {
            'enabled': True,
            'current': counts['total'],
            'limit': total_cap,
            'reached': reached,
            'percentage': (counts['total'] / total_cap) * 100 if total_cap > 0 else 0
        }
    
    def _auto_pause_offer(self, offer_id):
        """Auto-pause offer when cap is reached"""
        try:
            result = self.offers_collection.update_one(
                {'offer_id': offer_id},
                {
                    '$set': {
                        'status': 'paused',
                        'auto_paused_at': datetime.utcnow(),
                        'auto_pause_reason': 'Cap limit reached',
                        'updated_at': datetime.utcnow()
                    }
                }
            )
            
            if result.modified_count > 0:
                self.logger.info(f"Auto-paused offer {offer_id} due to cap limit")
                return True
            
            return False
            
        except Exception as e:
            self.logger.error(f"Error auto-pausing offer {offer_id}: {str(e)}")
            return False
    
    def _send_cap_alerts(self, offer, cap_status, alert_emails):
        """Send cap alert emails"""
        alerts_sent = []
        
        try:
            # Check which caps need alerts (80%, 90%, 100%)
            alert_thresholds = [80, 90, 100]
            
            for cap_type in ['daily', 'weekly', 'monthly', 'total']:
                cap_info = cap_status[cap_type]
                
                if not cap_info['enabled']:
                    continue
                
                percentage = cap_info['percentage']
                
                for threshold in alert_thresholds:
                    if percentage >= threshold:
                        # Check if alert already sent for this threshold
                        alert_key = f"{offer['offer_id']}_{cap_type}_{threshold}"
                        
                        if not self._alert_already_sent(alert_key):
                            # Send alert
                            subject = f"Cap Alert: {offer['name']} - {cap_type.title()} Cap {threshold}% Reached"
                            
                            body = self._generate_alert_email_body(offer, cap_type, cap_info, threshold)
                            
                            if self._send_email(alert_emails, subject, body):
                                self._record_alert_sent(alert_key)
                                alerts_sent.append({
                                    'type': cap_type,
                                    'threshold': threshold,
                                    'emails': alert_emails,
                                    'sent_at': datetime.utcnow()
                                })
            
            return alerts_sent
            
        except Exception as e:
            self.logger.error(f"Error sending cap alerts: {str(e)}")
            return []
    
    def _alert_already_sent(self, alert_key):
        """Check if alert was already sent today"""
        today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        
        try:
            existing_alert = self.alerts_collection.find_one({
                'alert_key': alert_key,
                'sent_at': {'$gte': today_start}
            })
            
            return existing_alert is not None
            
        except Exception:
            return False
    
    def _record_alert_sent(self, alert_key):
        """Record that alert was sent"""
        try:
            self.alerts_collection.insert_one({
                'alert_key': alert_key,
                'sent_at': datetime.utcnow()
            })
        except Exception as e:
            self.logger.error(f"Error recording alert: {str(e)}")
    
    def _generate_alert_email_body(self, offer, cap_type, cap_info, threshold):
        """Generate email body for cap alert"""
        return f"""
        <html>
        <body>
            <h2>Cap Alert Notification</h2>
            
            <p><strong>Offer:</strong> {offer['name']} (ID: {offer['offer_id']})</p>
            <p><strong>Campaign:</strong> {offer['campaign_id']}</p>
            
            <h3>{cap_type.title()} Cap Alert - {threshold}% Reached</h3>
            
            <ul>
                <li><strong>Current:</strong> {cap_info['current']} conversions</li>
                <li><strong>Limit:</strong> {cap_info['limit']} conversions</li>
                <li><strong>Percentage:</strong> {cap_info['percentage']:.1f}%</li>
            </ul>
            
            <p><strong>Status:</strong> {'PAUSED (Auto-paused)' if threshold == 100 and offer.get('auto_pause_on_cap') else 'ACTIVE'}</p>
            
            <p>Please review your offer performance and take appropriate action.</p>
            
            <hr>
            <p><small>This is an automated notification from PepeLeads Ascend Platform.</small></p>
        </body>
        </html>
        """
    
    def _send_email(self, recipients, subject, body):
        """Send email notification using Hostinger SMTP - tries STARTTLS 587 first, then SSL 465"""
        if not EMAIL_AVAILABLE:
            self.logger.warning("Email functionality not available, skipping email")
            return False
            
        if not self.smtp_username or not self.smtp_password:
            self.logger.warning("SMTP credentials not configured, skipping email")
            return False
        
        try:
            import ssl
            
            # Debug mode - log email content
            if os.getenv('EMAIL_DEBUG', '').lower() == 'true':
                self.logger.info("=" * 50)
                self.logger.info("📧 EMAIL ALERT (DEBUG MODE)")
                self.logger.info(f"To: {recipients}")
                self.logger.info(f"Subject: {subject}")
                self.logger.info(f"Body: {body}")
                self.logger.info("=" * 50)
                return True
            
            # Create message
            msg = MIMEMultipart('alternative')
            msg['Subject'] = subject
            msg['From'] = self.from_email
            msg['To'] = ', '.join(recipients)
            
            # Add HTML body
            html_part = MIMEText(body, 'html')
            msg.attach(html_part)
            
            ctx = ssl.create_default_context()
            
            # Try port 587 with STARTTLS first (works on more hosting platforms like Render)
            try:
                self.logger.info(f"📧 Trying SMTP STARTTLS on port 587...")
                with smtplib.SMTP(self.smtp_server, 587, timeout=30) as server:
                    server.starttls(context=ctx)
                    server.login(self.smtp_username, self.smtp_password)
                    server.send_message(msg)
                self.logger.info(f"✅ Cap alert email sent via STARTTLS to {recipients}")
                return True
            except Exception as e1:
                self.logger.warning(f"⚠️ STARTTLS 587 failed: {e1}")
                
                # Fallback to port 465 with SSL
                try:
                    self.logger.info(f"📧 Trying SMTP SSL on port 465...")
                    with smtplib.SMTP_SSL(self.smtp_server, self.smtp_port, context=ctx, timeout=30) as server:
                        server.login(self.smtp_username, self.smtp_password)
                        server.send_message(msg)
                    self.logger.info(f"✅ Cap alert email sent via SSL to {recipients}")
                    return True
                except Exception as e2:
                    self.logger.error(f"❌ Both SMTP methods failed. STARTTLS: {e1}, SSL: {e2}")
                    return False
            
        except Exception as e:
            self.logger.error(f"Error sending email: {str(e)}")
            return False
    
    def record_conversion(self, offer_id, conversion_data):
        """
        Record a conversion and check caps
        
        Args:
            offer_id: Offer ID
            conversion_data: Conversion information
        
        Returns:
            dict: Conversion record and cap status
        """
        try:
            # Create conversion record
            conversion_doc = {
                'offer_id': offer_id,
                'click_id': conversion_data.get('click_id'),
                'affiliate_id': conversion_data.get('affiliate_id'),
                'payout': conversion_data.get('payout'),
                'status': conversion_data.get('status', 'pending'),
                'conversion_time': datetime.utcnow(),
                'ip_address': conversion_data.get('ip_address'),
                'user_agent': conversion_data.get('user_agent'),
                'created_at': datetime.utcnow()
            }
            
            # Insert conversion
            result = self.conversions_collection.insert_one(conversion_doc)
            conversion_doc['_id'] = str(result.inserted_id)
            
            # Check caps after recording conversion
            cap_status = self.check_offer_caps(offer_id)
            
            return {
                'conversion': conversion_doc,
                'cap_status': cap_status
            }
            
        except Exception as e:
            self.logger.error(f"Error recording conversion: {str(e)}")
            return {'error': str(e)}
    
    def start_monitoring_service(self):
        """Start background monitoring service"""
        def monitor_loop():
            while True:
                try:
                    # Get all active offers with caps
                    offers = self.offers_collection.find({
                        'is_active': True,
                        'status': 'active',
                        '$or': [
                            {'daily_cap': {'$exists': True, '$ne': None}},
                            {'weekly_cap': {'$exists': True, '$ne': None}},
                            {'monthly_cap': {'$exists': True, '$ne': None}},
                            {'limit': {'$exists': True, '$ne': None}}
                        ]
                    })
                    
                    for offer in offers:
                        self.check_offer_caps(offer['offer_id'])
                    
                    # Sleep for 5 minutes before next check
                    time.sleep(300)
                    
                except Exception as e:
                    self.logger.error(f"Error in monitoring loop: {str(e)}")
                    time.sleep(60)  # Sleep 1 minute on error
        
        # Start monitoring in background thread
        monitor_thread = Thread(target=monitor_loop, daemon=True)
        monitor_thread.start()
        self.logger.info("Cap monitoring service started")
        
        return monitor_thread
