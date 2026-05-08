import logging
import threading
import time
from datetime import datetime, timedelta
from bson import ObjectId
from database import db_instance
from models.automation import AutomationState, AutomationSettings
from models.offer import Offer
from services.email_service import get_email_service

logger = logging.getLogger(__name__)

class AutomationEngineService:
    def __init__(self):
        self.offer_model = Offer()
        self._worker_thread = None
        self._running = False

    def trigger_activity(self, user_data):
        """Called on user login/activity to check and start automation cycles"""
        user_id = str(user_data.get('_id') or user_data.get('id'))
        if not user_id: return

        state = AutomationState.get_by_user_id(user_id)
        settings = AutomationSettings.get_settings()
        
        if not settings.get('enabled', True): return

        now = datetime.utcnow()
        
        # Check cooldown
        if state and state.get('cooldown_until'):
            if now < state['cooldown_until']:
                logger.info(f"User {user_id} is in cooldown until {state['cooldown_until']}")
                return

        # If already in an active cycle, just update last activity
        if state and state.get('queue_status') == 'active':
            AutomationState.update_state(user_id, {'last_activity': now})
            return

        # Start new cycle
        initial_delay = settings.get('initial_delay_hours', 5)
        next_mail_time = now + timedelta(hours=initial_delay)
        
        new_state = {
            'user_id': user_id,
            'username': user_data.get('username'),
            'email': user_data.get('email'),
            'last_login': now,
            'last_activity': now,
            'current_step': 1,
            'queue_status': 'active',
            'next_mail_time': next_mail_time,
            'sent_mail_count': 0,
            'cooldown_until': None,
            'delivery_status': 'pending',
            'updated_at': now
        }
        
        AutomationState.update_state(user_id, new_state)
        logger.info(f"Started automation cycle for user {user_id}. Next mail at {next_mail_time}")

    def start_worker(self):
        if self._worker_thread and self._worker_thread.is_alive():
            return
        
        self._running = True
        self._worker_thread = threading.Thread(target=self._worker_loop, daemon=True)
        self._worker_thread.start()
        logger.info("Automation Engine Worker started")

    def _worker_loop(self):
        while self._running:
            try:
                self.process_queue()
            except Exception as e:
                logger.error(f"Error in automation worker loop: {e}", exc_info=True)
            time.sleep(60) # Check every minute

    def process_queue(self):
        pending = AutomationState.get_pending_queue()
        if not pending: return

        settings = AutomationSettings.get_settings()
        interval_mins = settings.get('step_interval_minutes', 200)

        for state in pending:
            user_id = state['user_id']
            step = state['current_step']
            
            success = self.send_step_email(state, step)
            
            if success:
                new_step = step + 1
                updates = {
                    'sent_mail_count': state.get('sent_mail_count', 0) + 1,
                    'last_campaign_cycle': datetime.utcnow()
                }
                
                if new_step > 5:
                    # Cycle completed
                    updates['queue_status'] = 'completed'
                    updates['next_mail_time'] = None
                    cooldown_days = settings.get('cooldown_days', 7)
                    updates['cooldown_until'] = datetime.utcnow() + timedelta(days=cooldown_days)
                    updates['current_step'] = 0
                else:
                    updates['current_step'] = new_step
                    updates['next_mail_time'] = datetime.utcnow() + timedelta(minutes=interval_mins)
                
                AutomationState.update_state(user_id, updates)
            else:
                # Retry handling or mark as failed
                AutomationState.update_state(user_id, {'delivery_status': 'failed'})

    def send_step_email(self, state, step):
        user_id = state['user_id']
        email = state['email']
        username = state['username']
        
        offers = self.get_personalized_offers(user_id, step)
        if not offers:
            logger.warning(f"No offers found for user {user_id} at step {step}")
            return True # Skip to next step if no offers found

        # Prepare email content based on step
        subject, body = self._prepare_email_content(username, step, offers)
        
        try:
            email_service = get_email_service()
            email_service._send_email(email, subject, body)
            logger.info(f"Sent automation email Step {step} to {email}")
            return True
        except Exception as e:
            logger.error(f"Failed to send automation email to {email}: {e}")
            return False

    def get_personalized_offers(self, user_id, step):
        # Logic to fetch offers based on personalization rules
        # Mocking for now, would integrate with Offer model and User activity
        query = {'status': 'active'}
        
        # Add basic personalization (e.g. by user country if known)
        # This is a simplification
        
        if step == 1: # Most Approved
            return list(self.offer_model.collection.find(query).sort('conversions', -1).limit(3))
        elif step == 2: # Newly Added
            return list(self.offer_model.collection.find(query).sort('created_at', -1).limit(3))
        elif step == 3: # Highly Clicked
            return list(self.offer_model.collection.find(query).sort('hits', -1).limit(3))
        elif step == 4: # Trending Recommended
            return list(self.offer_model.collection.find(query).limit(3)) # Should be geo-based
        elif step == 5: # Final Personalized Reminder
            return list(self.offer_model.collection.find(query).sort('payout', -1).limit(3))
        
        return []

    def _prepare_email_content(self, username, step, offers):
        step_titles = {
            1: "Recommended Offers Just for You",
            2: "Newest Campaigns You Might Like",
            3: "Our Top Trending Offers Right Now",
            4: "Exclusive Geo-Based Opportunities",
            5: "Final Reminder: Don't Miss These Top Performers"
        }
        
        subject = step_titles.get(step, "Special Update from Moustache Leads")
        
        offer_html = ""
        for offer in offers:
            offer_html += f"<li><b>{offer.get('name')}</b> - Payout: ${offer.get('payout')}</li>"
        
        body = f"""
        <html>
        <body>
            <h2>Hello {username},</h2>
            <p>{subject}</p>
            <ul>
                {offer_html}
            </ul>
            <p>Check them out in your dashboard!</p>
        </body>
        </html>
        """
        return subject, body

# Global instance
automation_engine_service = AutomationEngineService()
