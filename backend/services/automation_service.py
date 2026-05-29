import logging
from datetime import datetime, timedelta
from models.automation_state import AutomationState
from models.offer import Offer
from models.user import User
from database import db_instance
import threading
import time

logger = logging.getLogger(__name__)

_active_offers_cache = None
_active_offers_cache_expiry = 0
_active_offers_cache_ttl = 300 # Cache for 5 minutes

class AutomationService:
    _instance = None
    _lock = threading.Lock()

    def __new__(cls):
        with cls._lock:
            if cls._instance is None:
                cls._instance = super(AutomationService, cls).__new__(cls)
                cls._instance._initialized = False
            return cls._instance

    def __init__(self):
        if self._initialized:
            return
        self.model = AutomationState()
        self.offer_model = Offer()
        self.user_model = User()
        self._initialized = True
        self._running = False
        
        # Pre-warm active offers cache in background
        try:
            threading.Thread(target=self._get_active_offers_cached, daemon=True).start()
        except Exception as e:
            logger.error(f"Failed to start pre-warm thread: {e}")

    def _get_active_offers_cached(self):
        global _active_offers_cache, _active_offers_cache_expiry
        now = time.time()
        if _active_offers_cache is not None and now < _active_offers_cache_expiry:
            return _active_offers_cache
        
        db = db_instance.get_db()
        projection = {
            '_id': 1,
            'categories': 1,
            'category': 1,
            'vertical': 1,
            'countries': 1,
            'approved_count': 1,
            'hits': 1,
            'payout': 1,
            'revenue_share_percent': 1,
            'offer_name': 1,
            'name': 1,
            'network': 1,
            'image_url': 1,
            'thumbnail_url': 1,
            'status': 1
        }
        try:
            offers = list(db.offers.find({'status': 'active'}, projection))
            _active_offers_cache = offers
            _active_offers_cache_expiry = now + _active_offers_cache_ttl
            return offers
        except Exception as e:
            logger.error(f"Error fetching active offers for cache: {e}")
            if _active_offers_cache is not None:
                return _active_offers_cache
            return []

    def handle_user_activity(self, user_id, activity_type='Login', username=None, force_reset=False):
        """Triggered when a user logs in or is active. Enforces cooldown and activity gates."""
        settings = self.model.get_settings()
        if not settings.get('enabled'):
            return

        now = datetime.utcnow()
        state = self.model.get_user_state(user_id)

        # 1. COOLDOWN GATE (Only if not forcing a reset)
        if state and not force_reset:
            cooldown_until = state.get('cooldown_until')
            if cooldown_until and now < cooldown_until:
                logger.info(f"Automation GATED for user {user_id}: Cooldown active until {cooldown_until}")
                if state.get('queue_status') == 'active':
                    self.model.update_user_state(user_id, {'queue_status': 'completed'})
                return

            # If user is already in an active cycle (any step), just update login time
            if state.get('queue_status') == 'active':
                self.model.update_user_state(user_id, {
                    'last_login': now, 
                    'activity_type': activity_type,
                    'username': username or state.get('username')
                })
                return
            
            # If user completed their cycle or was removed, do NOT restart automatically
            # Only force_reset=True (admin action) should restart a completed/removed user
            if state.get('queue_status') in ('completed', 'removed', 'paused'):
                logger.info(f"Automation SKIPPED for user {user_id}: Status is {state.get('queue_status')}, not restarting without force_reset")
                return

        # 4. INITIALIZE / RESTART CYCLE
        if not username:
            user_info = self.user_model.find_by_id(user_id)
            if user_info:
                username = user_info.get('username', 'Unknown')

        logger.info(f"Automation cycle {'FORCED RESTART' if force_reset else 'starting'} for user {user_id} via {activity_type}")
        new_state = {
            'user_id': str(user_id),
            'username': username or "Unknown",
            'queue_status': 'active',
            'current_step': 0,
            'next_mail_time': now + timedelta(hours=float(settings.get('initial_delay_hours', 5))),
            'sent_mail_count': 0,
            'sent_offer_ids': [],
            'delivery_status': 'pending',
            'last_login': now,
            'activity_type': activity_type
        }
        self.model.update_user_state(user_id, new_state)

    def _has_recent_activity(self, user_id):
        """Check if user has any engagement. Note: Logins are handled directly in handle_user_activity now."""
        return True # Broad coverage as per user request

    def process_queue(self):
        """Process active automation steps"""
        settings = self.model.get_settings()
        if not settings.get('enabled'):
            return

        now = datetime.utcnow()
        active_items = self.model.get_active_queue()

        for item in active_items:
            user_id = item.get('user_id')
            cooldown_until = item.get('cooldown_until')
            
            # --- SAFETY CHECK: If cooldown is active, move to completed ---
            if cooldown_until and now < cooldown_until:
                self.model.update_user_state(user_id, {'queue_status': 'completed', 'next_mail_time': None})
                continue

            next_mail_time = item.get('next_mail_time')
            if not next_mail_time or now < next_mail_time:
                continue

            # NEW: If we are at step 0 (initial wait phase over), we need ADMIN AUTHORIZATION to start
            current_step = item.get('current_step', 0)
            if current_step == 0 and not item.get('is_authorized'):
                # We skip sending, it stays in "Ready" status until admin clicks Start
                continue

            # GUARD: If delivery_status is already 'sent' and next_mail_time is in the future, skip
            # This prevents double-sending when manual send_now already advanced the state
            if item.get('delivery_status') == 'sent' and current_step > 0:
                # Re-check from DB to avoid stale data race
                fresh_state = self.model.get_user_state(user_id)
                if fresh_state and fresh_state.get('delivery_status') == 'sent':
                    fresh_next = fresh_state.get('next_mail_time')
                    if fresh_next and now < fresh_next:
                        continue
                    # Also check if step was already advanced by manual send
                    if fresh_state.get('current_step', 0) > current_step:
                        continue

            # Time to send next mail
            user_id = item.get('user_id')
            current_step = item.get('current_step', 0) + 1
            
            # ATOMIC CLAIM: Set delivery_status to 'sending' to prevent race conditions
            claim_result = self.model.collection.update_one(
                {'user_id': user_id, 'delivery_status': {'$ne': 'sending'}, 'current_step': item.get('current_step', 0)},
                {'$set': {'delivery_status': 'sending', 'updated_at': datetime.utcnow()}}
            )
            if claim_result.modified_count == 0:
                # Another process already claimed this user
                continue
            
            # Select offers based on step
            offers, interests = self._get_offers_for_step(current_step, user_id, item) # Pass item (state)
            
            if offers:
                success = self._send_automation_mail(user_id, current_step, offers, item)
                if success:
                    # Track sent IDs to avoid duplicates in the same cycle
                    new_sent_ids = item.get('sent_offer_ids', [])
                    new_sent_ids.extend([str(o.get('_id')) for o in offers])
                    
                    update_data = {
                        'current_step': current_step,
                        'sent_offer_ids': list(set(new_sent_ids)),
                        'sent_mail_count': item.get('sent_mail_count', 0) + 1,
                        'delivery_status': 'sent',
                        'matched_verticals': interests
                    }
                    
                    if current_step >= 5:
                        # End of cycle
                        update_data['queue_status'] = 'completed'
                        update_data['cooldown_until'] = now + timedelta(days=settings.get('cooldown_days', 7))
                        update_data['last_campaign_cycle'] = now
                        update_data['next_mail_time'] = None
                    else:
                        # Schedule next step
                        interval = settings.get('step_interval_minutes', 200)
                        update_data['next_mail_time'] = now + timedelta(minutes=interval)
                    
                    self.model.update_user_state(user_id, update_data)
                    logger.info(f"Automation step {current_step} completed for user {user_id}")
                else:
                    self.model.update_user_state(user_id, {'delivery_status': 'failed'})

    def _get_offers_for_step(self, step, user_id, state):
        """Get best matched offers based on Intelligence (85% Installs / 15% Finance priority)"""
        db = db_instance.get_db()
        
        # 1. Fetch interest signals from user_intelligence
        intel = db.user_intelligence.find_one({'user_id': str(user_id)})
        top_cats = [c.lower() for c in (intel.get('top_categories', []) if intel else [])]
        top_geos = [g.upper() for g in (intel.get('top_geos', []) if intel else [])]
        
        # 2. Get user profile fallbacks
        user = self.user_model.find_by_id(user_id)
        if not user: return [], []
        
        profile_cats = user.get('verticals') or (user.get('signup_preferences', {}).get('verticals')) or []
        if not isinstance(profile_cats, list): profile_cats = [profile_cats]
        profile_cats = [c.lower() for c in profile_cats]
        
        profile_geos = user.get('geos') or (user.get('signup_preferences', {}).get('geos')) or []
        if not isinstance(profile_geos, list): profile_geos = [profile_geos]
        profile_geos = [g.upper() for g in profile_geos]

        interest_cats = list(set(top_cats + profile_cats))
        interest_geos = list(set(top_geos + profile_geos))

        # 4. EMERGENCY FALLBACK: If no interests found, check recent specific offer views/clicks
        if not interest_cats:
            recent_views = list(db.offer_views.find({'user_id': str(user_id)}).sort('timestamp', -1).limit(20))
            for v in recent_views:
                cat = (v.get('category') or v.get('vertical') or '').lower()
                if cat and cat not in interest_cats:
                    interest_cats.append(cat)

        # 5. Get already sent offers in this cycle to avoid duplicates
        sent_ids = state.get('sent_offer_ids', [])
        
        # 6. Score all active offers
        all_offers = self._get_active_offers_cached()
        scored_offers = []
        
        import random
        for offer in all_offers:
            offer_id_str = str(offer.get('_id'))
            if offer_id_str in sent_ids:
                continue # Skip already sent in this cycle
                
            score = 50 # Base score
            # Add small random jitter (0-5) to break ties and ensure diversity among users
            score += random.random() * 5
            
            # Check both category (legacy) and categories (list)
            categories = offer.get('categories', [])
            if not isinstance(categories, list): categories = [categories]
            primary_cat = (offer.get('category') or offer.get('vertical') or '').lower()
            if primary_cat and primary_cat not in [c.lower() for c in categories]:
                categories.append(primary_cat)
            
            offer_cats_lower = [c.lower() for c in categories]
            countries = [c.upper() for c in (offer.get('countries') or [])]
            
            # Geo Match
            if 'WW' in countries:
                score += 5
            elif any(g in countries for g in interest_geos):
                score += 25
                
            # Category Match - INDIVIDUAL PREFERENCE (CRITICAL WEIGHT)
            match_count = sum(1 for c in offer_cats_lower if c in interest_cats)
            if match_count > 0:
                score += 100 + (match_count * 10) # Boost significantly for individual matches
                
            # --- PREFERENCE WEIGHTING (Fallback Priority) ---
            if 'installs' in offer_cats_lower:
                score += 15
            elif 'finance' in offer_cats_lower:
                score += 5
            
            # Performance factors
            score += min(15, (offer.get('approved_count', 0) / 5))
            score += min(10, (offer.get('hits', 0) / 200))
            
            scored_offers.append({'offer': offer, 'score': score})
            
        # Sort by score descending
        scored_offers.sort(key=lambda x: x['score'], reverse=True)
        # One-by-one delivery: Take only the top candidate for this step
        top_offers = [scored_offers[0]['offer']] if scored_offers else []
        
        return top_offers, interest_cats

    def _send_automation_mail(self, user_id, step, offers, state=None):
        """Actually send the automation email using the shared _build_email_html template"""
        try:
            user = self.user_model.find_by_id(user_id)
            if not user or not user.get('email'): return False

            # DEDUPLICATION: Check if an email for this user+step already exists and is pending/sending/sent
            scheduled_emails = db_instance.get_collection('scheduled_emails')
            existing = scheduled_emails.find_one({
                'user_id': str(user_id),
                'step': step,
                'status': {'$in': ['pending', 'sending', 'sent', 'dry_run']},
                'created_at': {'$gte': datetime.utcnow() - timedelta(hours=24)}
            })
            if existing:
                logger.warning(f"⚠️ Duplicate prevention: Automation email for user {user_id} step {step} already exists (id={existing.get('_id')})")
                return True  # Return True to advance state without re-sending

            # Prepare the email content
            primary_offer = offers[0].get('offer_name') or offers[0].get('name')
            
            # Check for admin overrides in state
            subject = state.get('custom_subject') if state and state.get('custom_subject') else f"🔥 Personalized Outreach: {primary_offer} (Top Pick for You)"
            custom_body = state.get('custom_message') if state and state.get('custom_message') else None
            
            # Build message body
            if custom_body:
                message_body = custom_body
            else:
                message_body = f"Hi {user.get('username', 'User')},\n\nWe have found some great offers that match what you are looking for. Check out the offers below and log in to your publisher dashboard to get started.\n\nBest regards,\nPublisher Support Team\nMoustache Leads"

            # Use the shared _build_email_html for consistent template rendering
            import os
            from routes.admin_offer_requests import _build_email_html
            frontend_url = os.environ.get('FRONTEND_URL', 'https://www.moustacheleads.com')
            
            body = _build_email_html(
                message_body,
                frontend_url,
                offers=offers,
                payout_type='publisher',
                template_style='table',
                visible_fields=None,
                default_image='',
                see_more_fields=None,
                mask_preview_links=False,
                payment_terms='',
                custom_preview_url='',
                custom_preview_urls={},
                preview_in_email='both',
                custom_preview_in_email='both'
            )

            # Create a record in 'scheduled_emails' with ALL fields the service expects
            scheduled_emails = db_instance.get_collection('scheduled_emails')
            
            # Check if dry_run mode is enabled
            settings = self.model.get_settings()
            email_status = 'dry_run' if settings.get('dry_run') else 'pending'
            
            scheduled_emails.insert_one({
                'user_id': str(user_id),
                'recipients': [user.get('email')],
                'subject': subject,
                'body': body,
                'type': f'automation_step_{step}',
                'step': step,
                'related_offer_ids': [str(o['_id']) for o in offers],
                'status': email_status,
                'scheduled_at': datetime.utcnow(),
                'created_at': datetime.utcnow(),
                'created_by': 'automation_engine'
            })
            if email_status == 'dry_run':
                logger.info(f"🧪 DRY RUN: Would have sent automation step {step} to user {user_id} ({user.get('email')})")
            return True
        except Exception as e:
            logger.error(f"Failed to schedule automation mail: {e}")
            return False

    def start_service(self):
        """Start the background worker thread"""
        if self._running:
            return
        self._running = True
        self._thread = threading.Thread(target=self._run_loop, daemon=True)
        self._thread.start()
        logger.info("Automation Engine background service started")

    def sync_active_users(self, force_reset=False, user_ids=None):
        """Find users from recent activity logs and ensure they have an automation state"""
        try:
            if user_ids:
                all_active_ids = [str(uid) for uid in user_ids if uid]
            else:
                # 1. Get users with logins in the last 72 hours
                three_days_ago = datetime.utcnow() - timedelta(hours=72)
                logs_col = db_instance.get_collection('login_logs')
                recent_logins = []
                if logs_col is not None:
                    recent_logins = logs_col.distinct('user_id', {'login_time': {'$gte': three_days_ago}})
                
                # 2. Get users with page visits or clicks
                visits_col = db_instance.get_collection('page_visits')
                clicks_col = db_instance.get_collection('click_logs')
                
                recent_visitors = []
                if visits_col is not None:
                    recent_visitors = visits_col.distinct('user_id', {'timestamp': {'$gte': three_days_ago}})
                
                recent_clickers = []
                if clicks_col is not None:
                    recent_clickers = clicks_col.distinct('user_id', {'timestamp': {'$gte': three_days_ago}})
                
                all_active_ids = list(set([str(uid) for uid in (recent_logins + recent_visitors + recent_clickers) if uid]))
                
                # 3. Final fallback: If no active users found, get all registered users
                if not all_active_ids:
                    users_col = db_instance.get_collection('users')
                    if users_col is not None:
                        all_active_ids = [str(u['_id']) for u in users_col.find({}, {'_id': 1})]
            
            count = 0
            for user_id in all_active_ids:
                if not user_id: continue
                # Pass force_reset to ensure they are added/re-initialized even if removed
                self.handle_user_activity(user_id, force_reset=force_reset)
                count += 1
            
            logger.info(f"Synced {count} active users into automation engine (Force Reset: {force_reset})")
            return count
        except Exception as e:
            logger.error(f"Failed to sync active users: {e}")
            return 0

    def _run_loop(self):
        # Initial sync on startup
        self.sync_active_users()
        last_sync = time.time()
        
        while self._running:
            try:
                self.process_queue()
                
                # Auto-sync every 10 minutes
                if time.time() - last_sync > 600:
                    self.sync_active_users()
                    last_sync = time.time()
            except Exception as e:
                logger.error(f"Error in automation loop: {e}")
            time.sleep(60) # Check every minute

    def override_user_state(self, user_id, action, step=None, data=None):
        """Manually override a user's automation state"""
        state = self.model.get_user_state(user_id)
        if not state:
            if action == 'start':
                self.handle_user_activity(user_id, force_reset=True)
                state = self.model.get_user_state(user_id)
                if not state:
                    return False, "Failed to initialize user automation state"
            else:
                return False, "User automation state not found"

        now = datetime.utcnow()
        settings = self.model.get_settings()
        update_data = {}

        if action == 'skip':
            current_step = state.get('current_step', 0)
            if current_step >= 5:
                return False, "User has already completed the cycle"
            
            new_step = current_step + 1
            update_data['current_step'] = new_step
            if new_step >= 5:
                update_data['queue_status'] = 'completed'
                update_data['cooldown_until'] = now + timedelta(days=settings.get('cooldown_days', 7))
                update_data['next_mail_time'] = None
            else:
                interval = settings.get('step_interval_minutes', 200)
                update_data['next_mail_time'] = now + timedelta(minutes=interval)
            update_data['delivery_status'] = 'pending'

        elif action == 'reset':
            update_data['current_step'] = 0
            update_data['queue_status'] = 'active'
            update_data['next_mail_time'] = now + timedelta(hours=float(settings.get('initial_delay_hours', 5)))
            update_data['delivery_status'] = 'pending'
            update_data['cooldown_until'] = now
            update_data['is_authorized'] = False  # Require admin to click "Start" again
            update_data['sent_offer_ids'] = []  # Clear sent history for fresh cycle

        elif action == 'pause':
            update_data['queue_status'] = 'paused'
            update_data['next_mail_time'] = None

        elif action == 'resume':
            update_data['queue_status'] = 'active'
            interval = settings.get('step_interval_minutes', 200)
            update_data['next_mail_time'] = now + timedelta(minutes=interval)

        elif action == 'retry':
            update_data['delivery_status'] = 'pending'
            update_data['next_mail_time'] = now # Trigger immediately

        elif action == 'jump' and step is not None:
            update_data['current_step'] = int(step)
            if int(step) >= 5:
                update_data['queue_status'] = 'completed'
                update_data['cooldown_until'] = now + timedelta(days=settings.get('cooldown_days', 7))
                update_data['next_mail_time'] = None
            else:
                update_data['queue_status'] = 'active'
                interval = settings.get('step_interval_minutes', 200)
                update_data['next_mail_time'] = now + timedelta(minutes=interval)
            update_data['delivery_status'] = 'pending'

        elif action == 'complete':
            update_data['queue_status'] = 'completed'
            update_data['current_step'] = 5
            update_data['cooldown_until'] = now + timedelta(days=settings.get('cooldown_days', 7))
            update_data['next_mail_time'] = None

        elif action == 'remove':
            update_data['queue_status'] = 'removed'
            update_data['next_mail_time'] = None

        elif action == 'delete_permanent':
            self.model.delete_user_state(user_id)
            return True, "User permanently deleted from database"

        elif action == 'restore':
            update_data['queue_status'] = 'active'
            # Give them a 30 min buffer to resume
            update_data['next_mail_time'] = now + timedelta(minutes=30)
            update_data['delivery_status'] = 'pending'
            update_data['is_authorized'] = False  # Require admin to click "Start" again

        elif action == 'pin' and step is not None:
            # Here 'step' parameter is repurposed as offer_id string
            update_data['pinned_offer_id'] = str(step)
            
        elif action == 'save-content' and data:
            update_data['custom_subject'] = data.get('subject')
            update_data['custom_message'] = data.get('message')
            
        elif action == 'start':
            update_data['is_authorized'] = True
            update_data['queue_status'] = 'active'
            # Start immediately
            update_data['next_mail_time'] = datetime.utcnow()
            
        if update_data:
            self.model.update_user_state(user_id, update_data)
            return True, f"Action {action} applied successfully"
        
        return False, "Invalid action"

    def preview_next_offers(self, user_id):
        """Get the predicted offers for the remaining steps of the cycle for this user"""
        state = self.model.get_user_state(user_id)
        if not state:
            return [], []
        
        current_step = state.get('current_step', 0)
        if state.get('queue_status') == 'completed':
            return [], []
            
        simulated_sent_ids = list(state.get('sent_offer_ids', []))
        simulated_state = dict(state)
        
        predicted_offers = []
        interests = []
        
        for step in range(current_step + 1, 6):
            simulated_state['sent_offer_ids'] = simulated_sent_ids
            offers, step_interests = self._get_offers_for_step(step, user_id, simulated_state)
            if step_interests:
                for cat in step_interests:
                    if cat not in interests:
                        interests.append(cat)
                
            if offers:
                offer = offers[0]
                offer_id_str = str(offer.get('_id'))
                simulated_sent_ids.append(offer_id_str)
                
                payout = offer.get('payout', 0)
                rev_share = offer.get('revenue_share_percent', 0)
                
                payout_display = "$0.00"
                if payout and payout > 0:
                    payout_display = f"${payout:,.2f}"
                elif rev_share and rev_share > 0:
                    payout_display = f"{rev_share}% Rev"
                    
                predicted_offers.append({
                    'id': offer_id_str,
                    'name': offer.get('offer_name') or offer.get('name'),
                    'payout': payout,
                    'payout_display': payout_display,
                    'category': offer.get('category') or offer.get('vertical'),
                    'countries': offer.get('countries') or [],
                    'network': offer.get('network') or 'Direct',
                    'image_url': offer.get('image_url') or '',
                    'thumbnail_url': offer.get('thumbnail_url') or ''
                })
            else:
                break
                
        return predicted_offers, interests

    def get_sent_history(self, user_id):
        """Get the full history of sent offers for this user"""
        state = self.model.get_user_state(user_id)
        if not state:
            return []
            
        sent_ids = state.get('sent_offer_ids', [])
        if not sent_ids:
            return []
            
        db = db_instance.get_db()
        from bson import ObjectId
        obj_ids = []
        for sid in sent_ids:
            try:
                obj_ids.append(ObjectId(sid))
            except:
                continue
                
        offers = list(db.offers.find({'_id': {'$in': obj_ids}}))
        
        cleaned_offers = []
        for o in offers:
            payout = o.get('payout', 0)
            rev_share = o.get('revenue_share_percent', 0)
            
            payout_display = "$0.00"
            if payout and payout > 0:
                payout_display = f"${payout:,.2f}"
            elif rev_share and rev_share > 0:
                payout_display = f"{rev_share}% Rev"

            cleaned_offers.append({
                'id': str(o.get('_id')),
                'name': o.get('offer_name') or o.get('name'),
                'payout': payout,
                'payout_display': payout_display,
                'category': o.get('category') or o.get('vertical'),
                'countries': o.get('countries') or [],
                'network': o.get('network') or 'Direct',
                'image_url': o.get('image_url') or '',
                'thumbnail_url': o.get('thumbnail_url') or ''
            })
            
        return cleaned_offers

    def send_now(self, user_id, data, admin_username='admin'):
        """Manually trigger an outreach and advance the state"""
        try:
            db = db_instance.get_db()
            user = self.user_model.find_by_id(user_id)
            if not user or not user.get('email'):
                return False, "User not found or has no email"

            offer_ids = data.get('offer_ids', [])
            if not offer_ids:
                return False, "No offers selected"

            # DEDUPLICATION CHECK 1: If user already completed their cycle (step >= 5), block completely
            state = self.model.get_user_state(user_id)
            if state and state.get('current_step', 0) >= 5:
                logger.warning(f"⚠️ Blocked: User {user_id} already completed cycle (step={state.get('current_step')})")
                return False, "This user has already completed their 5-step cycle. Wait for cooldown to expire or reset their state manually."

            # DEDUPLICATION CHECK 2: If user already has ANY email in the last step_interval period, block
            scheduled_emails_col = db_instance.get_collection('scheduled_emails')
            settings = self.model.get_settings()
            step_interval = settings.get('step_interval_minutes', 179)
            interval_ago = datetime.utcnow() - timedelta(minutes=step_interval)
            recent_email = scheduled_emails_col.find_one({
                'user_id': str(user_id),
                'status': {'$in': ['pending', 'sending', 'sent', 'dry_run']},
                'created_at': {'$gte': interval_ago}
            })
            if recent_email:
                logger.warning(f"⚠️ Duplicate prevention: User {user_id} already has an email within the last {step_interval} min (step={recent_email.get('step')}, created={recent_email.get('created_at')})")
                return False, f"This user already received an email within the last {step_interval} minutes. The automation engine handles the remaining steps automatically."

            # DEDUPLICATION CHECK 3: If user is in active cycle (step > 0), the background engine handles it
            if state and state.get('queue_status') == 'active' and state.get('current_step', 0) > 0:
                logger.warning(f"⚠️ Blocked: User {user_id} already in active cycle at step {state.get('current_step')}. Background engine will continue.")
                return False, f"This user is already in an active automation cycle (Step {state.get('current_step')}/5). The background engine will send the remaining steps automatically. No manual intervention needed."

            # Auto-create automation state if user doesn't have one
            if not state:
                self.handle_user_activity(user_id, activity_type='ManualOutreach', username=user.get('username'), force_reset=True)
                state = self.model.get_user_state(user_id)
            
            # IMMEDIATELY mark as 'sending' to prevent background engine from picking up this user
            self.model.update_user_state(user_id, {'delivery_status': 'sending', 'queue_status': 'active'})

            # 1. Fetch offers — try both offer_id field AND _id (MongoDB ObjectId)
            from bson import ObjectId as BsonObjectId
            offers_col = db_instance.get_collection('offers')
            offers = list(offers_col.find({'offer_id': {'$in': offer_ids}}))
            
            # Fallback: if no offers found by offer_id, try by MongoDB _id
            if not offers:
                obj_ids = []
                for oid in offer_ids:
                    try:
                        obj_ids.append(BsonObjectId(oid))
                    except Exception:
                        pass
                if obj_ids:
                    offers = list(offers_col.find({'_id': {'$in': obj_ids}}))
            if not offers:
                return False, "Selected offers not found in database"

            # DEDUPLICATE offers — ensure each offer appears only once (by _id)
            seen_offer_ids = set()
            unique_offers = []
            for o in offers:
                oid = str(o.get('_id'))
                if oid not in seen_offer_ids:
                    seen_offer_ids.add(oid)
                    unique_offers.append(o)
            offers = unique_offers
            
            # HARD CAP: Maximum 5 offers per user regardless of how many were selected
            offers = offers[:5]

            # Apply Payout Overrides
            payout_overrides = data.get('payout_overrides', {})
            for o in offers:
                o_id = o.get('offer_id')
                if o_id in payout_overrides:
                    custom_val = payout_overrides[o_id]
                    try:
                        o['payout'] = float(custom_val)
                        o['payout_display'] = f"${float(custom_val):,.2f}"
                    except:
                        o['payout_display'] = custom_val # Fallback if not a number

            # 2. Build Email Body
            from routes.admin_offer_requests import _build_email_html
            import os
            frontend_url = os.environ.get('FRONTEND_URL', 'https://www.moustacheleads.com')
            
            message_body = data.get('message_body', '')
            template_style = data.get('template_style', 'table')
            visible_fields = data.get('visible_fields')
            see_more_fields = data.get('see_more_fields')
            default_image = data.get('default_image', '')
            payout_type = data.get('payout_type', 'publisher')
            mask_preview_links = data.get('mask_preview_links', False)
            payment_terms = data.get('payment_terms', '')
            custom_preview_url = data.get('custom_preview_url', '')
            custom_preview_urls = data.get('custom_preview_urls', {})
            preview_in_email = data.get('preview_in_email', 'both')
            custom_preview_in_email = data.get('custom_preview_in_email', 'both')

            html_body = _build_email_html(
                message_body, 
                frontend_url, 
                offers=offers, 
                payout_type=payout_type, 
                template_style=template_style, 
                visible_fields=visible_fields, 
                default_image=default_image, 
                see_more_fields=see_more_fields, 
                mask_preview_links=mask_preview_links, 
                payment_terms=payment_terms, 
                custom_preview_url=custom_preview_url, 
                custom_preview_urls=custom_preview_urls, 
                preview_in_email=preview_in_email, 
                custom_preview_in_email=custom_preview_in_email
            )

            # 3. Schedule the email
            subject = data.get('subject') or f"🔥 Exclusive Offers Hand-Picked for {user.get('username', 'You')}"
            scheduled_emails = db_instance.get_collection('scheduled_emails')
            
            # Get current step
            state = self.model.get_user_state(user_id)
            current_step = (state.get('current_step', 0) if state else 0) + 1
            
            # Support custom scheduling if provided
            scheduled_at = datetime.utcnow()
            if data.get('scheduled_at'):
                try:
                    # Expecting ISO format string from frontend
                    scheduled_at = datetime.fromisoformat(data.get('scheduled_at').replace('Z', '+00:00'))
                except Exception as e:
                    logger.error(f"Error parsing scheduled_at: {e}")

            # Send mode: all_in_one sends all offers in one email, one_by_one sends each offer separately using global step_interval
            send_mode = data.get('send_mode', 'all_in_one')
            settings = self.model.get_settings()
            step_interval = settings.get('step_interval_minutes', 180)
            
            # Check dry_run mode
            email_status = 'dry_run' if settings.get('dry_run') else 'pending'

            if send_mode == 'one_by_one':
                # ONE BY ONE MODE: Use intelligence engine to pick PERSONALIZED offers per user
                # Ignore frontend offer_ids — use _get_offers_for_step for each step
                personalized_offers = []
                simulated_state = dict(state) if state else {'sent_offer_ids': []}
                simulated_sent_ids = list(simulated_state.get('sent_offer_ids', []))
                
                for step in range(1, 6):  # Steps 1-5
                    simulated_state['sent_offer_ids'] = simulated_sent_ids
                    step_offers, _ = self._get_offers_for_step(step, user_id, simulated_state)
                    if step_offers:
                        personalized_offers.append(step_offers[0])
                        simulated_sent_ids.append(str(step_offers[0].get('_id')))
                    else:
                        break  # No more offers available
                
                if not personalized_offers:
                    # Fallback to frontend-selected offers if intelligence finds nothing
                    personalized_offers = offers[:5]
                
                total_offers = len(personalized_offers)
                logger.info(f"📧 One-by-one mode (personalized): {total_offers} offers for user {user_id}: {[o.get('offer_name') or o.get('name') for o in personalized_offers]}")
                
                # Build all email HTML upfront
                email_payloads = []
                for idx in range(total_offers):
                    offer = personalized_offers[idx]
                    step_number = current_step + idx
                    if step_number > 5:
                        break
                    
                    offer_html = _build_email_html(
                        message_body, frontend_url, offers=[offer], 
                        payout_type=payout_type, template_style=template_style, 
                        visible_fields=visible_fields, default_image=default_image, 
                        see_more_fields=see_more_fields, mask_preview_links=mask_preview_links, 
                        payment_terms=payment_terms, custom_preview_url=custom_preview_url, 
                        custom_preview_urls=custom_preview_urls, preview_in_email=preview_in_email, 
                        custom_preview_in_email=custom_preview_in_email
                    )
                    offset_time = scheduled_at + timedelta(minutes=step_interval * idx)
                    email_payloads.append({
                        'offer': offer, 'html': offer_html, 
                        'step': step_number, 'send_at': offset_time
                    })
                
                # Send Step 1 directly NOW
                if email_payloads and email_status != 'dry_run':
                    try:
                        from services.email_service import get_email_service
                        email_svc = get_email_service()
                        if email_svc.is_configured:
                            from email.mime.multipart import MIMEMultipart
                            from email.mime.text import MIMEText
                            msg = MIMEMultipart('alternative')
                            msg['Subject'] = subject
                            msg['From'] = email_svc.from_email
                            msg['To'] = user.get('email')
                            msg.attach(MIMEText(email_payloads[0]['html'], 'html'))
                            email_svc._send_email_smtp(msg)
                    except Exception as e:
                        logger.error(f"Direct SMTP send failed for step 1: {e}")
                
                # Schedule Steps 2-5 in a background thread that sends directly via SMTP
                if len(email_payloads) > 1 and email_status != 'dry_run':
                    remaining = email_payloads[1:]
                    user_email = user.get('email')
                    def send_remaining_steps(payloads, recipient, subj):
                        import time as _time
                        for payload in payloads:
                            # Wait until send_at time
                            wait_seconds = (payload['send_at'] - datetime.utcnow()).total_seconds()
                            if wait_seconds > 0:
                                _time.sleep(wait_seconds)
                            try:
                                from services.email_service import get_email_service
                                svc = get_email_service()
                                if svc.is_configured:
                                    from email.mime.multipart import MIMEMultipart
                                    from email.mime.text import MIMEText
                                    m = MIMEMultipart('alternative')
                                    m['Subject'] = subj
                                    m['From'] = svc.from_email
                                    m['To'] = recipient
                                    m.attach(MIMEText(payload['html'], 'html'))
                                    svc._send_email_smtp(m)
                                    # Update status in DB
                                    scheduled_emails.update_one(
                                        {'user_id': str(user_id), 'step': payload['step'], 'type': f"automation_manual_{payload['step']}"},
                                        {'$set': {'status': 'sent', 'sent_at': datetime.utcnow()}}
                                    )
                                    logger.info(f"✅ Step {payload['step']} sent to {recipient}")
                            except Exception as ex:
                                logger.error(f"❌ Failed to send step {payload['step']} to {recipient}: {ex}")
                                scheduled_emails.update_one(
                                    {'user_id': str(user_id), 'step': payload['step'], 'type': f"automation_manual_{payload['step']}"},
                                    {'$set': {'status': 'failed', 'error_message': str(ex)}}
                                )
                    
                    t = threading.Thread(target=send_remaining_steps, args=(remaining, user_email, subject), daemon=True)
                    t.start()
                
                # Store ALL steps in DB for history tracking (status: sent for step 1, scheduled_future for rest)
                for idx, payload in enumerate(email_payloads):
                    scheduled_emails.insert_one({
                        'user_id': str(user_id),
                        'recipients': [user.get('email')],
                        'subject': subject,
                        'body': payload['html'],
                        'type': f'automation_manual_{payload["step"]}',
                        'step': payload['step'],
                        'related_offer_ids': [payload['offer'].get('offer_id', str(payload['offer'].get('_id', '')))],
                        'status': 'sent' if (idx == 0 and email_status != 'dry_run') else ('scheduled_future' if email_status != 'dry_run' else email_status),
                        'scheduled_at': payload['send_at'],
                        'created_at': datetime.utcnow(),
                        'created_by': admin_username,
                        'sent_at': datetime.utcnow() if idx == 0 else None
                    })
                
                # Advance state to the LAST step we scheduled so background engine doesn't duplicate
                final_step = min(current_step + total_offers - 1, 5)
                current_step = final_step  # Override for state advancement below
            else:
                # all_in_one: single email with all offers — send directly
                all_in_one_status = email_status
                if email_status != 'dry_run':
                    try:
                        from services.email_service import get_email_service
                        email_svc = get_email_service()
                        if email_svc.is_configured:
                            from email.mime.multipart import MIMEMultipart
                            from email.mime.text import MIMEText
                            msg = MIMEMultipart('alternative')
                            msg['Subject'] = subject
                            msg['From'] = email_svc.from_email
                            msg['To'] = user.get('email')
                            msg.attach(MIMEText(html_body, 'html'))
                            email_svc._send_email_smtp(msg)
                            all_in_one_status = 'sent'
                        else:
                            all_in_one_status = 'pending'
                    except Exception as send_err:
                        logger.error(f"Direct send failed for all_in_one: {send_err}")
                        all_in_one_status = 'pending'
                
                scheduled_emails.insert_one({
                    'user_id': str(user_id),
                    'recipients': [user.get('email')],
                    'subject': subject,
                    'body': html_body,
                    'type': f'automation_manual_{current_step}',
                    'step': current_step,
                    'related_offer_ids': offer_ids,
                    'status': all_in_one_status,
                    'scheduled_at': scheduled_at,
                    'created_at': datetime.utcnow(),
                    'created_by': admin_username
                })

            if email_status == 'dry_run':
                logger.info(f"🧪 DRY RUN: Manual send for user {user_id} ({user.get('email')}) - step {current_step}, {len(offers)} offers")

            # 4. Advance State — mark as sent and schedule next step for background engine
            settings = self.model.get_settings()
            now = datetime.utcnow()
            
            new_sent_ids = (state.get('sent_offer_ids', []) if state else [])
            new_sent_ids.extend(offer_ids)
            
            update_data = {
                'current_step': current_step,
                'sent_offer_ids': list(set(new_sent_ids)),
                'sent_mail_count': (state.get('sent_mail_count', 0) if state else 0) + 1,
                'delivery_status': 'sent',
                'is_authorized': True,
                'last_manual_send_at': now  # Track when admin last sent manually
            }
            
            if current_step >= 5:
                update_data['queue_status'] = 'completed'
                update_data['cooldown_until'] = now + timedelta(days=settings.get('cooldown_days', 7))
                update_data['next_mail_time'] = None
            else:
                interval = settings.get('step_interval_minutes', 200)
                update_data['next_mail_time'] = now + timedelta(minutes=interval)
                update_data['queue_status'] = 'active'

            self.model.update_user_state(user_id, update_data)
            
            return True, "Manual outreach scheduled and state advanced"
        except Exception as e:
            logger.error(f"Manual send failed: {e}", exc_info=True)
            return False, str(e)

def get_automation_service():
    return AutomationService()
