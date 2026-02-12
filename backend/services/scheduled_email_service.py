"""
Scheduled Email Service
Background service that processes and sends scheduled emails at their scheduled time.
"""

import logging
import threading
import time
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)


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
        self._thread = None
        self._check_interval = 60  # Check every 60 seconds
        logger.info("ScheduledEmailService initialized")
    
    def start_service(self):
        """Start the background email processing service"""
        if self._running:
            logger.warning("Scheduled email service is already running")
            return
        
        self._running = True
        self._thread = threading.Thread(target=self._process_loop, daemon=True)
        self._thread.start()
        logger.info("✅ Scheduled email service started")
    
    def stop_service(self):
        """Stop the background email processing service"""
        self._running = False
        if self._thread:
            self._thread.join(timeout=5)
        logger.info("Scheduled email service stopped")
    
    def _process_loop(self):
        """Main processing loop that checks for due emails"""
        logger.info("📧 Scheduled email processing loop started")
        while self._running:
            try:
                logger.debug("📧 Checking for due emails...")
                self._process_due_emails()
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
                logger.debug("📧 No due emails to process")
                return
            
            logger.info(f"📧 Processing {len(due_emails)} due scheduled emails")
            
            for email in due_emails:
                email_id = str(email.get('_id'))
                subject = email.get('subject', 'No Subject')
                
                try:
                    # Send to all recipients
                    recipients = email.get('recipients', [])
                    body = email.get('body', '')
                    
                    success_count = 0
                    fail_count = 0
                    
                    for recipient in recipients:
                        try:
                            # Use the email service's internal send method
                            result = email_service._send_email(
                                to_email=recipient,
                                subject=subject,
                                html_content=body
                            )
                            if result:
                                success_count += 1
                                logger.info(f"✅ Sent email to {recipient}: {subject}")
                            else:
                                fail_count += 1
                                logger.error(f"❌ Failed to send email to {recipient}")
                        except Exception as send_error:
                            fail_count += 1
                            logger.error(f"❌ Failed to send email to {recipient}: {send_error}")
                    
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
            
            success_count = 0
            errors = []
            
            for recipient in recipients:
                try:
                    result = email_service._send_email(
                        to_email=recipient,
                        subject=subject,
                        html_content=body
                    )
                    if result:
                        success_count += 1
                    else:
                        errors.append(f"{recipient}: Send failed")
                except Exception as e:
                    errors.append(f"{recipient}: {str(e)}")
            
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
