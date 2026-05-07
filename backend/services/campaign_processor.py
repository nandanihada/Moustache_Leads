"""
Campaign Processor Service
Background service that processes campaign email queues and sends emails at scheduled times.
Integrates with existing EmailService and ScheduledEmailService.
"""

import logging
import threading
import time
from datetime import datetime, timedelta
from models.email_campaign import EmailCampaign
from services.email_service import get_email_service
from database import db_instance

logger = logging.getLogger(__name__)


class CampaignProcessor:
    """Background service for processing campaign email queues"""
    
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
        self._thread = None
        self._check_interval = 30  # Check every 30 seconds
        logger.info("CampaignProcessor initialized")
    
    def start(self):
        """Start the background processor"""
        if self._running:
            return
        self._running = True
        self._thread = threading.Thread(target=self._process_loop, daemon=True)
        self._thread.start()
        logger.info("📧 CampaignProcessor started")
    
    def stop(self):
        """Stop the background processor"""
        self._running = False
        if self._thread:
            self._thread.join(timeout=5)
        logger.info("📧 CampaignProcessor stopped")
    
    def _process_loop(self):
        """Main processing loop"""
        while self._running:
            try:
                self._process_due_emails()
            except Exception as e:
                logger.error(f"CampaignProcessor error: {e}", exc_info=True)
            time.sleep(self._check_interval)
    
    def _process_due_emails(self):
        """Find and send emails that are due"""
        due_emails = EmailCampaign.get_due_emails(limit=20)
        
        if not due_emails:
            return
        
        logger.info(f"📧 Processing {len(due_emails)} due campaign emails")
        
        for email_doc in due_emails:
            if not self._running:
                break
            
            try:
                # Check if campaign is still active (not paused/cancelled)
                campaign = EmailCampaign.get_campaign(email_doc.get('campaign_id'))
                if not campaign:
                    EmailCampaign.update_email_status(email_doc['_id'], EmailCampaign.EMAIL_CANCELLED)
                    continue
                
                if campaign.get('status') in (EmailCampaign.STATUS_PAUSED, EmailCampaign.STATUS_CANCELLED):
                    continue
                
                # Check cooldown - don't send if user received email too recently
                cooldown_days = campaign.get('cooldown_days', 1)
                if self._check_cooldown(email_doc.get('user_id'), cooldown_days):
                    # Reschedule for later
                    new_time = datetime.utcnow() + timedelta(hours=cooldown_days * 24)
                    EmailCampaign.update_email_status(
                        email_doc['_id'], 
                        EmailCampaign.EMAIL_PENDING,
                        {'scheduled_at': new_time}
                    )
                    continue
                
                # Send the email
                self._send_email(email_doc, campaign)
                
            except Exception as e:
                logger.error(f"Error processing email {email_doc.get('_id')}: {e}")
                EmailCampaign.update_email_status(
                    email_doc['_id'],
                    EmailCampaign.EMAIL_FAILED,
                    {'error_message': str(e), 'retry_count': email_doc.get('retry_count', 0) + 1}
                )
        
        # Update campaign progress for affected campaigns
        campaign_ids = set(e.get('campaign_id') for e in due_emails if e.get('campaign_id'))
        for cid in campaign_ids:
            EmailCampaign.update_campaign_progress(cid)
    
    def _check_cooldown(self, user_id: str, cooldown_days: int) -> bool:
        """Check if user received an email within cooldown period"""
        if not user_id or cooldown_days <= 0:
            return False
        
        emails_col = EmailCampaign.get_emails_collection()
        if emails_col is None:
            return False
        
        cutoff = datetime.utcnow() - timedelta(days=cooldown_days)
        recent = emails_col.find_one({
            'user_id': user_id,
            'status': EmailCampaign.EMAIL_SENT,
            'sent_at': {'$gte': cutoff}
        })
        
        return recent is not None
    
    def _send_email(self, email_doc: dict, campaign: dict):
        """Send a single campaign email"""
        recipient_email = email_doc.get('email', '')
        subject = email_doc.get('subject', '')
        html_body = email_doc.get('html_body', '')
        
        if not recipient_email or not html_body:
            EmailCampaign.update_email_status(
                email_doc['_id'],
                EmailCampaign.EMAIL_FAILED,
                {'error_message': 'Missing recipient email or body'}
            )
            return
        
        # Status already set to 'sending' by atomic get_due_emails claim
        
        # Send via EmailService
        email_service = get_email_service()
        
        if not email_service.is_configured:
            logger.error(f"❌ Campaign email FAILED: EmailService not configured (SMTP credentials missing)")
            EmailCampaign.update_email_status(
                email_doc['_id'],
                EmailCampaign.EMAIL_FAILED,
                {'error_message': 'SMTP not configured on server', 'retry_count': email_doc.get('retry_count', 0) + 1}
            )
            return
        
        try:
            success = email_service._send_email(recipient_email, subject, html_body)
        except Exception as send_err:
            logger.error(f"❌ Campaign email send exception: {send_err}")
            success = False
        
        if success:
            EmailCampaign.update_email_status(
                email_doc['_id'],
                EmailCampaign.EMAIL_SENT,
                {'sent_at': datetime.utcnow()}
            )
            
            # Track sent offers
            offer_ids = email_doc.get('offer_ids', [])
            user_id = email_doc.get('user_id', '')
            if offer_ids and user_id:
                EmailCampaign.track_offer_sent(user_id, offer_ids, email_doc.get('campaign_id'))
            
            # Log to email_activity_logs for backward compatibility
            self._log_activity(email_doc, campaign)
            
            logger.info(f"✅ Campaign email sent to {recipient_email} ({len(email_doc.get('offer_ids', []))} offers)")
        else:
            retry_count = email_doc.get('retry_count', 0) + 1
            logger.warning(f"⚠️ Campaign email FAILED to {recipient_email} (attempt {retry_count})")
            if retry_count >= 3:
                EmailCampaign.update_email_status(
                    email_doc['_id'],
                    EmailCampaign.EMAIL_FAILED,
                    {'error_message': 'Max retries exceeded', 'retry_count': retry_count}
                )
            else:
                # Retry in 5 minutes
                EmailCampaign.update_email_status(
                    email_doc['_id'],
                    EmailCampaign.EMAIL_PENDING,
                    {
                        'scheduled_at': datetime.utcnow() + timedelta(minutes=5),
                        'retry_count': retry_count,
                        'error_message': 'Send failed, retrying...'
                    }
                )
    
    def _log_activity(self, email_doc: dict, campaign: dict):
        """Log email send to activity logs collection"""
        try:
            logs_col = db_instance.get_collection('email_activity_logs')
            if logs_col is None:
                return
            
            logs_col.insert_one({
                'type': 'campaign_email',
                'campaign_id': email_doc.get('campaign_id'),
                'batch_name': campaign.get('batch_name', ''),
                'user_id': email_doc.get('user_id'),
                'username': email_doc.get('username'),
                'recipient_email': email_doc.get('email'),
                'subject': email_doc.get('subject'),
                'offer_ids': email_doc.get('offer_ids', []),
                'offer_names': email_doc.get('offer_names', []),
                'offer_count': email_doc.get('offer_count', 0),
                'status': 'sent',
                'sent_at': datetime.utcnow(),
                'created_at': datetime.utcnow(),
            })
        except Exception as e:
            logger.warning(f"Failed to log campaign email activity: {e}")


# Singleton accessor
_processor_instance = None

def get_campaign_processor() -> CampaignProcessor:
    global _processor_instance
    if _processor_instance is None:
        _processor_instance = CampaignProcessor()
    return _processor_instance
