"""
Scheduled Email Service
Background service that processes and sends scheduled emails at their scheduled time.
"""

import logging
import threading
import time
from datetime import datetime, timedelta
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

logger = logging.getLogger(__name__)

# Global email pause flag - stored in memory and database
_email_paused = False  # START ACTIVE BY DEFAULT so scheduled emails get sent


class ScheduledEmailService:
    """Service for processing and sending scheduled emails"""
    
    _instance = None
    _lock = threading.Lock()
    
    def __new__(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
                    cls._instance._initialized = False
        return cls._instance
    
    def __init__(self):
        if self._initialized:
            return
        
        self._initialized = True
        self._running = False
        self._paused = False  # START ACTIVE BY DEFAULT
        self._thread = None
        self._check_interval = 60  # Check every 60 seconds
        self._load_pause_state()
        logger.info(f"ScheduledEmailService initialized (paused: {self._paused})")
    
    def _load_pause_state(self):
        """Load pause state from database.
        Defaults to active (not paused) so scheduled emails get processed.
        """
        try:
            from database import db_instance
            db = db_instance.get_db()
            if db is not None:
                settings = db['system_settings'].find_one({'key': 'email_service_paused'})
                if settings:
                    # If it was paused by the old default, force-unpause once
                    if settings.get('value') is True and not settings.get('manually_set'):
                        db['system_settings'].update_one(
                            {'key': 'email_service_paused'},
                            {'$set': {'value': False, 'manually_set': False, 'updated_at': datetime.utcnow()}}
                        )
                        self._paused = False
                        logger.info("📧 Email service auto-unpaused (was paused by old default)")
                    else:
                        self._paused = settings.get('value', False)
                else:
                    # Create default setting (active)
                    db['system_settings'].update_one(
                        {'key': 'email_service_paused'},
                        {'$set': {'value': False, 'manually_set': False, 'updated_at': datetime.utcnow()}},
                        upsert=True
                    )
                    self._paused = False
        except Exception as e:
            logger.error(f"Error loading pause state: {e}")
            self._paused = False  # Default to active on error
    
    def _save_pause_state(self):
        """Save pause state to database"""
        try:
            from database import db_instance
            db = db_instance.get_db()
            if db is not None:
                db['system_settings'].update_one(
                    {'key': 'email_service_paused'},
                    {'$set': {'value': self._paused, 'manually_set': True, 'updated_at': datetime.utcnow()}},
                    upsert=True
                )
        except Exception as e:
            logger.error(f"Error saving pause state: {e}")
    
    def pause(self):
        """Pause all email sending"""
        self._paused = True
        self._save_pause_state()
        logger.info("📧 Email service PAUSED - no emails will be sent")
        return True
    
    def resume(self):
        """Resume email sending"""
        self._paused = False
        self._save_pause_state()
        logger.info("📧 Email service RESUMED - emails will be sent")
        return True
    
    def is_paused(self):
        """Check if email service is paused"""
        return self._paused
    
    def get_status(self):
        """Get current service status with pending email diagnostics"""
        status = {
            'running': self._running,
            'paused': self._paused,
            'check_interval': self._check_interval,
            'current_utc': datetime.utcnow().isoformat() + 'Z'
        }
        
        # Add pending email counts for diagnostics
        try:
            from database import db_instance
            now = datetime.utcnow()
            
            insight_col = db_instance.get_collection('insight_email_logs')
            if insight_col is not None:
                pending = list(insight_col.find(
                    {'status': 'scheduled'},
                    {'_id': 1, 'scheduled_at': 1, 'type': 1, 'subject': 1}
                ))
                status['pending_insight_emails'] = len(pending)
                status['pending_insight_details'] = [
                    {
                        'id': str(p['_id']),
                        'type': p.get('type', 'insight'),
                        'subject': p.get('subject', 'N/A')[:60],
                        'scheduled_at': p.get('scheduled_at').isoformat() + 'Z' if isinstance(p.get('scheduled_at'), datetime) else str(p.get('scheduled_at')),
                        'is_due': p.get('scheduled_at') <= now if isinstance(p.get('scheduled_at'), datetime) else 'unknown'
                    }
                    for p in pending
                ]
        except Exception as e:
            status['diagnostics_error'] = str(e)
        
        return status
    
    def start_service(self):
        """Start the background email processing service"""
        if self._running:
            logger.warning("Scheduled email service is already running")
            return
        
        self._running = True
        self._thread = threading.Thread(target=self._process_loop, daemon=True)
        self._thread.start()
        logger.info(f"✅ Scheduled email service started (paused={self._paused}, interval={self._check_interval}s)")
        
        # Log pending scheduled emails on startup for diagnostics
        try:
            from database import db_instance
            now = datetime.utcnow()
            logger.info(f"📧 Current UTC time: {now.isoformat()}")
            
            # Check insight_email_logs for scheduled emails
            insight_col = db_instance.get_collection('insight_email_logs')
            if insight_col is not None:
                pending = list(insight_col.find({'status': 'scheduled'}, {'_id': 1, 'scheduled_at': 1, 'type': 1, 'subject': 1}))
                if pending:
                    logger.info(f"📧 Found {len(pending)} pending insight emails:")
                    for p in pending:
                        sched = p.get('scheduled_at', 'N/A')
                        is_due = sched <= now if isinstance(sched, datetime) else 'unknown'
                        logger.info(f"   - ID={p['_id']}, type={p.get('type','insight')}, scheduled_at={sched}, due_now={is_due}, subject={p.get('subject','N/A')[:50]}")
                else:
                    logger.info("📧 No pending scheduled insight emails found")
            
            # Check scheduled_emails collection too
            sched_col = db_instance.get_collection('scheduled_emails')
            if sched_col is not None:
                pending2 = list(sched_col.find({'status': 'pending'}, {'_id': 1, 'scheduled_at': 1, 'subject': 1}))
                if pending2:
                    logger.info(f"📧 Found {len(pending2)} pending scheduled emails (legacy):")
                    for p in pending2:
                        sched = p.get('scheduled_at', 'N/A')
                        logger.info(f"   - ID={p['_id']}, scheduled_at={sched}, subject={p.get('subject','N/A')[:50]}")
        except Exception as e:
            logger.warning(f"📧 Could not check pending emails on startup: {e}")
    
    def stop_service(self):
        """Stop the background email processing service"""
        self._running = False
        if self._thread:
            self._thread.join(timeout=5)
        logger.info("Scheduled email service stopped")
    
    def _process_loop(self):
        """Main processing loop that checks for due emails"""
        logger.info("📧 Scheduled email processing loop started")
        cycle_count = 0
        while self._running:
            try:
                cycle_count += 1
                # Check if paused
                if self._paused:
                    if cycle_count % 5 == 1:  # Log every 5 cycles (~5 min) to avoid spam
                        logger.info("📧 Email service is PAUSED - skipping email processing")
                else:
                    if cycle_count % 5 == 1:  # Log heartbeat every 5 cycles
                        logger.info(f"📧 Email service heartbeat - cycle #{cycle_count}, UTC now: {datetime.utcnow().isoformat()}")
                    self._process_due_emails()
                    self._process_due_insight_emails()
            except Exception as e:
                logger.error(f"Error in scheduled email processing loop: {e}")
            
            # Sleep for the check interval
            time.sleep(self._check_interval)
    
    def _process_due_emails(self):
        """Process all emails that are due to be sent"""
        try:
            from models.scheduled_email import ScheduledEmail
            from services.email_service import get_email_service
            
            # Get email service instance
            email_service = get_email_service()
            if not email_service.is_configured:
                logger.warning("Email service not configured, skipping scheduled email processing")
                return
            
            # Get all pending emails that are due
            due_emails = ScheduledEmail.get_due_emails()
            
            if not due_emails:
                return
            
            logger.info(f"📧 Processing {len(due_emails)} due scheduled emails")
            
            for email in due_emails:
                email_id = str(email.get('_id'))
                subject = email.get('subject', 'No Subject')
                
                try:
                    # Send to all recipients via BCC (single email, not individual)
                    recipients = email.get('recipients', [])
                    body = email.get('body', '')
                    
                    if not recipients:
                        ScheduledEmail.mark_sent(email_id)
                        continue
                    
                    batch_size = 50
                    success_count = 0
                    fail_count = 0
                    
                    for i in range(0, len(recipients), batch_size):
                        batch = recipients[i:i + batch_size]
                        try:
                            msg = MIMEMultipart('alternative')
                            msg['Subject'] = subject
                            msg['From'] = email_service.from_email
                            msg['To'] = email_service.from_email
                            msg['Bcc'] = ', '.join(batch)
                            msg.attach(MIMEText(body, 'html'))
                            
                            if email_service._send_email_smtp(msg):
                                success_count += len(batch)
                                logger.info(f"✅ BCC batch sent to {len(batch)} recipients: {subject}")
                            else:
                                fail_count += len(batch)
                                logger.error(f"❌ BCC batch failed for {len(batch)} recipients")
                        except Exception as send_error:
                            fail_count += len(batch)
                            logger.error(f"❌ BCC batch error: {send_error}")
                    
                    # Update email status based on results
                    if fail_count == 0:
                        ScheduledEmail.mark_sent(email_id)
                        logger.info(f"✅ Email {email_id} sent successfully to {success_count} recipients")
                    elif success_count > 0:
                        # Partial success
                        ScheduledEmail.mark_sent(email_id)
                        logger.warning(f"⚠️ Email {email_id} partially sent: {success_count} success, {fail_count} failed")
                    else:
                        # Complete failure
                        ScheduledEmail.mark_failed(email_id, f"Failed to send to all {fail_count} recipients")
                        logger.error(f"❌ Email {email_id} failed to send to all recipients")
                        
                except Exception as e:
                    logger.error(f"Error processing email {email_id}: {e}")
                    ScheduledEmail.mark_failed(email_id, str(e))
                    
        except Exception as e:
            logger.error(f"Error in _process_due_emails: {e}")

    def _process_due_insight_emails(self):
        """Process scheduled emails from insight_email_logs collection (Offer Insights & custom campaigns)."""
        try:
            from database import db_instance
            from bson import ObjectId

            insight_logs_col = db_instance.get_collection('insight_email_logs')
            if insight_logs_col is None:
                return

            now = datetime.utcnow()

            # Find all scheduled insight emails that are due
            due_emails = list(insight_logs_col.find({
                'status': 'scheduled',
                'scheduled_at': {'$lte': now}
            }))

            if not due_emails:
                return

            logger.info(f"📧 Processing {len(due_emails)} due insight emails from insight_email_logs")

            users_collection = db_instance.get_collection('users')

            for email_doc in due_emails:
                email_id = str(email_doc['_id'])
                try:
                    email_type = email_doc.get('type', '')

                    if email_type == 'custom_campaign':
                        self._send_custom_campaign(email_doc, users_collection, insight_logs_col)
                    else:
                        # Legacy insight email (send_insight_email style)
                        self._send_insight_campaign(email_doc, users_collection, insight_logs_col)

                except Exception as e:
                    logger.error(f"❌ Error processing insight email {email_id}: {e}", exc_info=True)
                    insight_logs_col.update_one(
                        {'_id': email_doc['_id']},
                        {'$set': {'status': 'failed', 'error': str(e), 'sent_at': now}}
                    )

        except Exception as e:
            logger.error(f"Error in _process_due_insight_emails: {e}", exc_info=True)

    def _send_custom_campaign(self, email_doc, users_collection, logs_col):
        """Send a scheduled custom campaign email (one batch)."""
        from bson import ObjectId
        from services.email_verification_service import EmailVerificationService

        email_service = EmailVerificationService()
        if not email_service.is_configured:
            logger.warning("Email service not configured, skipping custom campaign")
            return

        subject = email_doc.get('subject', '')
        content = email_doc.get('content', '')
        partner_ids = email_doc.get('partner_ids', [])
        custom_emails = email_doc.get('custom_emails', [])
        batch_num = email_doc.get('batch_number', 1)
        total_batches = email_doc.get('total_batches', 1)

        logger.info(f"📧 Sending custom campaign batch {batch_num}/{total_batches}, subject: {subject[:50]}")

        sent_count = 0
        failed_count = 0

        # Import the HTML generator from the route module
        from routes.offer_insights_email import generate_custom_campaign_html

        # Send to registered partners
        for partner_id in partner_ids:
            try:
                partner = users_collection.find_one({'_id': ObjectId(partner_id)})
                if not partner:
                    failed_count += 1
                    continue

                partner_email = partner.get('email')
                partner_name = partner.get('username', 'Partner')

                email_html = generate_custom_campaign_html(
                    subject=subject,
                    content=content,
                    partner_name=partner_name
                )

                if email_service._send_email(partner_email, subject, email_html):
                    sent_count += 1
                else:
                    failed_count += 1
            except Exception as e:
                logger.error(f"Error sending to partner {partner_id}: {e}")
                failed_count += 1

        # Send to custom email addresses
        import re
        email_regex = re.compile(r'^[^\s@]+@[^\s@]+\.[^\s@]+$')
        for raw_email in (custom_emails or []):
            try:
                email_addr = raw_email.strip().lower()
                if not email_addr or not email_regex.match(email_addr):
                    failed_count += 1
                    continue

                email_html = generate_custom_campaign_html(
                    subject=subject,
                    content=content,
                    partner_name=email_addr.split('@')[0]
                )

                if email_service._send_email(email_addr, subject, email_html):
                    sent_count += 1
                else:
                    failed_count += 1
            except Exception as e:
                logger.error(f"Error sending to custom email {raw_email}: {e}")
                failed_count += 1

        # Update status
        now = datetime.utcnow()
        logs_col.update_one(
            {'_id': email_doc['_id']},
            {'$set': {
                'status': 'sent',
                'sent_at': now,
                'sent_count': sent_count,
                'failed_count': failed_count
            }}
        )

        # Also log to email_activity_logs
        try:
            from database import db_instance
            activity_col = db_instance.get_collection('email_activity_logs')
            if activity_col is not None:
                activity_col.insert_one({
                    'action': 'sent',
                    'source': email_doc.get('source_card', 'scheduled'),
                    'offer_ids': email_doc.get('offer_ids', []),
                    'offer_names': email_doc.get('offer_names', []),
                    'offer_count': len(email_doc.get('offer_ids', [])),
                    'recipient_type': 'specific_users',
                    'recipient_count': len(partner_ids) + len(custom_emails or []),
                    'admin_username': email_doc.get('created_by', 'system'),
                    'subject': subject,
                    'sent_count': sent_count,
                    'failed_count': failed_count,
                    'created_at': now,
                    'was_scheduled': True,
                    'originally_scheduled_at': email_doc.get('scheduled_at'),
                })
        except Exception as e:
            logger.error(f"Error logging activity for custom campaign: {e}")

        logger.info(f"✅ Custom campaign sent: {sent_count} sent, {failed_count} failed")

    def _send_insight_campaign(self, email_doc, users_collection, logs_col):
        """Send a scheduled insight email campaign (offer-based template emails)."""
        from bson import ObjectId
        from services.email_verification_service import EmailVerificationService
        from routes.offer_insights_email import generate_multi_offer_email_html, EMAIL_TEMPLATES

        email_service = EmailVerificationService()
        if not email_service.is_configured:
            logger.warning("Email service not configured, skipping insight campaign")
            return

        insight_type = email_doc.get('insight_type', '')
        offers = email_doc.get('offers', [])
        partner_ids = email_doc.get('partner_ids', [])
        custom_message = email_doc.get('custom_message', '')

        template = EMAIL_TEMPLATES.get(insight_type)
        if not template:
            logger.error(f"Unknown insight type: {insight_type}")
            logs_col.update_one(
                {'_id': email_doc['_id']},
                {'$set': {'status': 'failed', 'error': f'Unknown insight type: {insight_type}'}}
            )
            return

        sent_count = 0
        failed_count = 0

        for partner_id in partner_ids:
            try:
                partner = users_collection.find_one({'_id': ObjectId(partner_id)})
                if not partner:
                    failed_count += 1
                    continue

                partner_email = partner.get('email')
                partner_name = partner.get('username', 'Partner')

                email_html = generate_multi_offer_email_html(
                    template=template,
                    offers=offers,
                    partner_name=partner_name,
                    custom_message=custom_message
                )

                if len(offers) == 1:
                    subject = template['subject'].format(offer_name=offers[0].get('name', 'Offer'))
                else:
                    subject = f"🔥 {len(offers)} Hot Offers You Should Check Out!"

                if email_service._send_email(partner_email, subject, email_html):
                    sent_count += 1
                else:
                    failed_count += 1
            except Exception as e:
                logger.error(f"Error sending insight email to partner {partner_id}: {e}")
                failed_count += 1

        now = datetime.utcnow()
        logs_col.update_one(
            {'_id': email_doc['_id']},
            {'$set': {
                'status': 'sent',
                'sent_at': now,
                'sent_count': sent_count,
                'failed_count': failed_count
            }}
        )

        logger.info(f"✅ Insight campaign ({insight_type}) sent: {sent_count} sent, {failed_count} failed")

    
    def send_email_now(self, email_id: str) -> dict:
        """Manually trigger sending of a specific scheduled email"""
        try:
            from models.scheduled_email import ScheduledEmail
            from services.email_service import get_email_service
            
            email = ScheduledEmail.get_by_id(email_id)
            if not email:
                return {'success': False, 'error': 'Email not found'}
            
            if email.get('status') != 'pending':
                return {'success': False, 'error': f"Email status is '{email.get('status')}', not 'pending'"}
            
            email_service = get_email_service()
            if not email_service.is_configured:
                return {'success': False, 'error': 'Email service not configured'}
            
            recipients = email.get('recipients', [])
            subject = email.get('subject', 'No Subject')
            body = email.get('body', '')
            
            if not recipients:
                ScheduledEmail.mark_sent(email_id)
                return {'success': True, 'message': 'No recipients'}
            
            # Send via BCC (single email, not individual)
            batch_size = 50
            success_count = 0
            errors = []
            
            for i in range(0, len(recipients), batch_size):
                batch = recipients[i:i + batch_size]
                try:
                    msg = MIMEMultipart('alternative')
                    msg['Subject'] = subject
                    msg['From'] = email_service.from_email
                    msg['To'] = email_service.from_email
                    msg['Bcc'] = ', '.join(batch)
                    msg.attach(MIMEText(body, 'html'))
                    
                    if email_service._send_email_smtp(msg):
                        success_count += len(batch)
                    else:
                        errors.append(f"BCC batch of {len(batch)} failed")
                except Exception as e:
                    errors.append(f"BCC batch error: {str(e)}")
            
            if success_count == len(recipients):
                ScheduledEmail.mark_sent(email_id)
                return {'success': True, 'message': f'Sent to {success_count} recipients'}
            elif success_count > 0:
                ScheduledEmail.mark_sent(email_id)
                return {
                    'success': True, 
                    'message': f'Partially sent: {success_count}/{len(recipients)}',
                    'errors': errors
                }
            else:
                ScheduledEmail.mark_failed(email_id, '; '.join(errors))
                return {'success': False, 'error': 'Failed to send to all recipients', 'errors': errors}
                
        except Exception as e:
            logger.error(f"Error in send_email_now: {e}")
            return {'success': False, 'error': str(e)}


# Singleton instance
scheduled_email_service = ScheduledEmailService()


def get_scheduled_email_service():
    """Get the singleton scheduled email service instance"""
    return scheduled_email_service
