import logging
from datetime import datetime, timedelta
from models.automation_state import AutomationState
from models.offer import Offer
from models.user import User
from database import db_instance
import threading
import time

logger = logging.getLogger(__name__)

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

            if state.get('queue_status') == 'active':
                self.model.update_user_state(user_id, {
                    'last_login': now, 
                    'activity_type': activity_type,
                    'username': username or state.get('username')
                })
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
            'next_mail_time': now + timedelta(hours=settings.get('initial_delay_hours', 5)),
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

            # Time to send next mail
            user_id = item.get('user_id')
            current_step = item.get('current_step', 0) + 1
            
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
        all_offers = list(db.offers.find({'status': 'active'}))
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
        """Actually send the automation email with proper content"""
        try:
            user = self.user_model.find_by_id(user_id)
            if not user or not user.get('email'): return False

            # Prepare the email content
            primary_offer = offers[0].get('offer_name') or offers[0].get('name')
            
            # Check for admin overrides in state
            subject = state.get('custom_subject') if state and state.get('custom_subject') else f"🔥 Personalized Outreach: {primary_offer} (Top Pick for You)"
            custom_body = state.get('custom_message') if state and state.get('custom_message') else None
            
            if custom_body:
                # Use custom body if provided by admin
                body = custom_body
                # We keep the overrides until the admin explicitly changes them or the cycle resets
            else:
                # Premium Email Template with Table
                body = f"""
                <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 800px; margin: 0 auto; color: #334155; line-height: 1.6;">
                <div style="background: linear-gradient(135deg, #185FA5 0%, #2563EB 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
                    <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Top Performing Offers</h1>
                    <p style="color: #bfdbfe; margin: 10px 0 0 0; font-size: 14px;">Personalized for <strong>{user.get('username', 'User')}</strong> based on recent activity</p>
                </div>
                
                <div style="padding: 25px; background: #ffffff; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
                    <p style="font-size: 16px; margin-bottom: 20px;">Hello {user.get('username', 'User')},</p>
                    <p style="margin-bottom: 25px;">Our intelligence engine has identified several high-converting opportunities tailored to your traffic profile. Here are your top matches for today:</p>
                    
                    <div style="overflow-x: auto; margin-bottom: 30px;">
                        <table style="width: 100%; border-collapse: collapse; min-width: 600px;">
                            <thead>
                                <tr style="background-color: #f8fafc; border-bottom: 2px solid #e2e8f0;">
                                    <th style="padding: 12px 8px; text-align: left; font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em;">ID</th>
                                    <th style="padding: 12px 8px; text-align: left; font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em;">Offer Name</th>
                                    <th style="padding: 12px 8px; text-align: left; font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em;">Payout</th>
                                    <th style="padding: 12px 8px; text-align: left; font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em;">Network</th>
                                    <th style="padding: 12px 8px; text-align: left; font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em;">Countries</th>
                                    <th style="padding: 12px 8px; text-align: left; font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em;">Category</th>
                                </tr>
                            </thead>
                            <tbody>
            """
            
            for o in offers:
                payout = o.get('payout', 0)
                payout_display = f"${payout:,.2f}" if payout else "RevShare"
                countries = ", ".join(o.get('countries', ['WW']))
                if len(countries) > 20: countries = countries[:17] + "..."
                
                body += f"""
                                <tr style="border-bottom: 1px solid #f1f5f9;">
                                    <td style="padding: 12px 8px; font-size: 11px; font-family: monospace; color: #94a3b8;">{str(o.get('_id'))[-6:].upper()}</td>
                                    <td style="padding: 12px 8px; font-size: 13px; font-weight: 600; color: #1e293b;">{o.get('offer_name') or o.get('name')}</td>
                                    <td style="padding: 12px 8px; font-size: 13px; font-weight: 700; color: #059669;">{payout_display}</td>
                                    <td style="padding: 12px 8px; font-size: 12px; color: #64748b;">{o.get('network') or 'Direct'}</td>
                                    <td style="padding: 12px 8px; font-size: 11px; color: #64748b;">{countries}</td>
                                    <td style="padding: 12px 8px;">
                                        <span style="display: inline-block; padding: 2px 8px; background: #eff6ff; color: #3b82f6; border-radius: 4px; font-size: 10px; font-weight: 700; text-transform: uppercase;">{o.get('category') or o.get('vertical')}</span>
                                    </td>
                                </tr>
                """
            
            body += """
                            </tbody>
                        </table>
                    </div>
                    
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="https://www.moustacheleads.com/dashboard/offers" style="background: #2563EB; color: #ffffff; padding: 14px 35px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 16px; box-shadow: 0 4px 6px rgba(37, 99, 235, 0.2);">Grab Your Deals Now</a>
                    </div>
                    
                    <p style="font-size: 12px; color: #94a3b8; text-align: center; margin-top: 40px; border-top: 1px solid #f1f5f9; padding-top: 20px;">
                        You received this email because you are a registered partner with Moustache Leads.<br/>
                        &copy; 2026 Moustache Leads - High Velocity Affiliate Network
                    </p>
                </div>
            </div>
            """

            # Create a record in 'scheduled_emails' with ALL fields the service expects
            scheduled_emails = db_instance.get_collection('scheduled_emails')
            scheduled_emails.insert_one({
                'user_id': str(user_id),
                'recipients': [user.get('email')],
                'subject': subject,
                'body': body,
                'type': f'automation_step_{step}',
                'step': step,
                'related_offer_ids': [str(o['_id']) for o in offers],
                'status': 'pending',
                'scheduled_at': datetime.utcnow(),
                'created_at': datetime.utcnow(),
                'created_by': 'automation_engine'
            })
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
            update_data['next_mail_time'] = now + timedelta(hours=settings.get('initial_delay_hours', 5))
            update_data['delivery_status'] = 'pending'
            update_data['cooldown_until'] = now

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
        """Get the offers that will be sent in the next step for this user"""
        state = self.model.get_user_state(user_id)
        if not state:
            return [], []
        
        current_step = state.get('current_step', 0)
        next_step = current_step + 1
        if next_step > 5:
            # Check if we can show current step offers if already completed/finished
            if state.get('queue_status') == 'completed':
                next_step = 5
            else:
                return [], []
            
        offers, interests = self._get_offers_for_step(next_step, user_id, state)
        
        # Clean up offer objects for JSON
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
            'network': o.get('network') or 'Direct'
        })
        return cleaned_offers, interests

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
                'network': o.get('network') or 'Direct'
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

            # 1. Fetch offers
            offers_col = db_instance.get_collection('offers')
            offers = list(offers_col.find({'offer_id': {'$in': offer_ids}}))
            if not offers:
                return False, "Selected offers not found in database"

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

            scheduled_emails.insert_one({
                'user_id': str(user_id),
                'recipients': [user.get('email')],
                'subject': subject,
                'body': html_body,
                'type': f'automation_manual_{current_step}',
                'step': current_step,
                'related_offer_ids': offer_ids,
                'status': 'pending',
                'scheduled_at': scheduled_at,
                'created_at': datetime.utcnow(),
                'created_by': admin_username
            })

            # 4. Advance State
            settings = self.model.get_settings()
            now = datetime.utcnow()
            
            new_sent_ids = (state.get('sent_offer_ids', []) if state else [])
            new_sent_ids.extend(offer_ids)
            
            update_data = {
                'current_step': current_step,
                'sent_offer_ids': list(set(new_sent_ids)),
                'sent_mail_count': (state.get('sent_mail_count', 0) if state else 0) + 1,
                'delivery_status': 'sent',
                'is_authorized': True
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
