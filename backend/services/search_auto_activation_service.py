"""
Search Auto-Activation Service
Monitors publisher searches for "yellow" (in_inventory_not_active) offers.
After a configurable delay (default 3 hours), automatically grants 7 best-matching
inactive offers exclusively to that publisher.

Key behaviors:
- Only targets searches with inventory_status == 'in_inventory_not_active'
- Waits configurable hours (default 3) after the search before activating
- Picks top 7 offers by relevance (category match + click count + payout)
- Creates per-user offer_grants so the offer appears only for that user
- Tracks everything in 'search_auto_activations' collection
- 30-day expiry cycle: if no click within 30 days, deactivates the grant
- If a click happens, expiry resets (extends 30 more days)
- Duplicate prevention: won't send same offers to same user twice
- Service can be paused/resumed and delay can be changed via admin API
"""

import logging
from datetime import datetime, timedelta
from threading import Thread
import time
from database import db_instance
from models.offer_grant import OfferGrant

logger = logging.getLogger(__name__)

# Default configuration
DEFAULT_DELAY_HOURS = 3
DEFAULT_MAX_OFFERS = 7
CHECK_INTERVAL_SECONDS = 30 * 60  # Check every 30 minutes
GRANT_DURATION_DAYS = 30


class SearchAutoActivationService:
    """Background service that auto-activates offers for publishers based on their searches."""

    def __init__(self):
        self.search_logs_col = db_instance.get_collection('search_logs')
        self.offers_col = db_instance.get_collection('offers')
        self.activations_col = db_instance.get_collection('search_auto_activations')
        self.settings_col = db_instance.get_collection('platform_settings')
        self.clicks_col = db_instance.get_collection('offerwall_clicks_detailed')
        self.offer_grant = OfferGrant()
        self.running = False
        self._thread = None

    def _get_settings(self):
        """Get service settings from DB (allows admin to change without restart)."""
        defaults = {
            'enabled': True,
            'delay_hours': DEFAULT_DELAY_HOURS,
            'max_offers': DEFAULT_MAX_OFFERS,
            'grant_duration_days': GRANT_DURATION_DAYS,
        }
        if self.settings_col is None:
            return defaults
        try:
            doc = self.settings_col.find_one({'key': 'search_auto_activation'})
            if doc:
                return {
                    'enabled': doc.get('enabled', True),
                    'delay_hours': doc.get('delay_hours', DEFAULT_DELAY_HOURS),
                    'max_offers': doc.get('max_offers', DEFAULT_MAX_OFFERS),
                    'grant_duration_days': doc.get('grant_duration_days', GRANT_DURATION_DAYS),
                }
        except Exception as e:
            logger.warning(f"Failed to read auto-activation settings: {e}")
        return defaults

    def _update_settings(self, updates: dict):
        """Update service settings in DB."""
        if self.settings_col is None:
            return False
        try:
            self.settings_col.update_one(
                {'key': 'search_auto_activation'},
                {'$set': {**updates, 'updated_at': datetime.utcnow()}},
                upsert=True
            )
            return True
        except Exception as e:
            logger.error(f"Failed to update auto-activation settings: {e}")
            return False

    def _get_already_activated_offers(self, user_id: str) -> set:
        """Get offer_ids already auto-activated for this user (to prevent duplicates)."""
        if self.activations_col is None:
            return set()
        try:
            docs = self.activations_col.find(
                {'user_id': user_id},
                {'offer_ids': 1}
            )
            activated = set()
            for doc in docs:
                for oid in doc.get('offer_ids', []):
                    activated.add(oid)
            return activated
        except Exception:
            return set()

    def _find_best_offers(self, keyword: str, user_id: str, max_offers: int) -> list:
        """
        Find the best inactive offers matching the search keyword.
        Priority: category match > click count > payout
        Only picks offers that are in inventory but NOT active.
        """
        if self.offers_col is None:
            return []

        already_activated = self._get_already_activated_offers(user_id)

        # Search for offers matching the keyword (inactive ones)
        search_regex = {'$regex': keyword, '$options': 'i'}
        query = {
            '$or': [
                {'name': search_regex},
                {'offer_id': search_regex},
                {'category': search_regex},
                {'vertical': search_regex},
                {'categories': search_regex},
            ],
            'status': {'$in': ['inactive', 'paused']},
            '$and': [
                {'$or': [{'deleted': {'$exists': False}}, {'deleted': False}, {'deleted': None}]},
            ]
        }

        candidates = list(self.offers_col.find(query).limit(50))

        if not candidates:
            return []

        # Filter out already-activated offers for this user
        candidates = [c for c in candidates if c.get('offer_id') not in already_activated]

        if not candidates:
            return []

        # Score each candidate
        scored = []
        for offer in candidates:
            score = 0
            offer_id = offer.get('offer_id', '')

            # Category/keyword relevance (higher if name matches directly)
            name_lower = (offer.get('name') or '').lower()
            keyword_lower = keyword.lower()
            if keyword_lower in name_lower:
                score += 50
            elif any(keyword_lower in (cat or '').lower() for cat in (offer.get('categories') or [])):
                score += 40
            elif keyword_lower in (offer.get('category') or '').lower():
                score += 35
            elif keyword_lower in (offer.get('vertical') or '').lower():
                score += 30

            # Click popularity (from offer's total_clicks or click count)
            total_clicks = offer.get('total_clicks', 0) or offer.get('click_count', 0) or 0
            score += min(total_clicks, 100)  # Cap at 100 points

            # Payout value
            payout = 0
            try:
                payout = float(offer.get('payout', 0) or 0)
            except (ValueError, TypeError):
                pass
            score += min(payout * 10, 50)  # Cap at 50 points

            scored.append((score, offer))

        # Sort by score descending, take top N
        scored.sort(key=lambda x: x[0], reverse=True)
        return [item[1] for item in scored[:max_offers]]

    def _send_activation_email(self, user_id: str, username: str, keywords: list, offers: list):
        """Send an email to the publisher notifying them about the auto-activated offers."""
        try:
            # Get user email
            users_col = db_instance.get_collection('users')
            if users_col is None:
                return

            from bson import ObjectId as ObjId
            target_user = None
            if ObjId.is_valid(user_id):
                target_user = users_col.find_one({'_id': ObjId(user_id)})
            if not target_user or not target_user.get('email'):
                logger.warning(f"Cannot send auto-activation email: user {user_id} has no email")
                return

            recipient_email = target_user['email']
            recipient_name = target_user.get('first_name') or target_user.get('username', username)

            # Get configurable email content from settings
            settings = self._get_settings()
            email_subject = settings.get('email_subject', 'Recommended Offers for You')
            email_message = settings.get('email_message',
                f"Hi {recipient_name},\n\n"
                f"We have handpicked {len(offers)} offers that we think are a great fit for you. "
                f"Check them out and start earning!"
            )
            # Replace placeholders in message
            email_message = email_message.replace('{name}', recipient_name)
            email_message = email_message.replace('{count}', str(len(offers)))

            subject = email_subject.replace('{name}', recipient_name).replace('{count}', str(len(offers)))

            # Prepare offers data for the email template
            offers_for_email = []
            for o in offers:
                offers_for_email.append({
                    'offer_id': o.get('offer_id', ''),
                    'name': o.get('name', ''),
                    'payout': o.get('payout', 0),
                    'category': o.get('category', '') or o.get('vertical', ''),
                    'network': o.get('network', ''),
                    'image_url': o.get('image_url', ''),
                    'preview_url': o.get('preview_url', ''),
                    'target_url': o.get('target_url', ''),
                    'description': o.get('description', ''),
                })

            # Build HTML using the shared email template builder
            from utils.email_template_builder import build_offer_email_html

            html_content = build_offer_email_html(
                offers=offers_for_email,
                recipient_name=recipient_name,
                custom_message=email_message,
                template_style=settings.get('template_style', 'table'),
                payout_type=settings.get('payout_type', 'publisher'),
            )

            # Send the email
            from services.email_service import EmailService
            email_svc = EmailService()
            success = email_svc._send_email(recipient_email, subject, html_content)

            if success:
                logger.info(f"📧 Auto-activation email sent to {username} ({recipient_email}) - {len(offers)} offers")
            else:
                logger.warning(f"⚠️ Failed to send auto-activation email to {username} ({recipient_email})")

            # Log email activity
            email_logs_col = db_instance.get_collection('email_activity_logs')
            if email_logs_col is not None:
                email_logs_col.insert_one({
                    'action': 'sent' if success else 'failed',
                    'source': 'search_auto_activation',
                    'offer_ids': [o.get('offer_id', '') for o in offers],
                    'offer_names': [o.get('name', '') for o in offers],
                    'offer_count': len(offers),
                    'recipient_type': 'specific_user',
                    'recipient_email': recipient_email,
                    'recipient_count': 1,
                    'user_id': user_id,
                    'recipient_user_ids': [user_id],
                    'keyword': ', '.join(keywords[:3]),
                    'admin_id': 'system',
                    'admin_username': 'auto_activation_system',
                    'subject': subject,
                    'created_at': datetime.utcnow(),
                })

        except Exception as e:
            logger.error(f"❌ Error sending auto-activation email to {username}: {e}")

    def process_pending_searches(self):
        """
        Main processing loop:
        1. Find searches with inventory_status='in_inventory_not_active' older than delay_hours
        2. Group by user
        3. For each user, pick 7 best offers and create grants
        """
        settings = self._get_settings()
        if not settings['enabled']:
            return 0

        delay_hours = settings['delay_hours']
        max_offers = settings['max_offers']
        grant_duration_days = settings['grant_duration_days']

        if self.search_logs_col is None or self.activations_col is None:
            return 0

        cutoff_time = datetime.utcnow() - timedelta(hours=delay_hours)

        try:
            # Find yellow searches that haven't been processed yet
            # We mark processed searches with 'auto_activation_processed' flag
            pipeline = [
                {
                    '$match': {
                        'inventory_status': 'in_inventory_not_active',
                        'searched_at': {'$lt': cutoff_time},
                        '$or': [
                            {'auto_activation_processed': {'$exists': False}},
                            {'auto_activation_processed': False}
                        ]
                    }
                },
                {
                    '$group': {
                        '_id': '$user_id',
                        'username': {'$first': '$username'},
                        'keywords': {'$addToSet': '$keyword'},
                        'search_ids': {'$push': '$_id'},
                        'search_count': {'$sum': 1},
                        'latest_search': {'$max': '$searched_at'}
                    }
                }
            ]

            user_groups = list(self.search_logs_col.aggregate(pipeline))

            if not user_groups:
                return 0

            total_activated = 0

            for group in user_groups:
                user_id = group['_id']
                username = group.get('username', 'Unknown')
                keywords = group.get('keywords', [])
                search_ids = group.get('search_ids', [])

                if not user_id or not keywords:
                    continue

                # Find best offers across all keywords for this user
                all_offers = []
                for keyword in keywords:
                    offers = self._find_best_offers(keyword, user_id, max_offers * 2)
                    all_offers.extend(offers)

                # Deduplicate and take top max_offers
                seen_ids = set()
                unique_offers = []
                for offer in all_offers:
                    oid = offer.get('offer_id')
                    if oid and oid not in seen_ids:
                        seen_ids.add(oid)
                        unique_offers.append(offer)

                unique_offers = unique_offers[:max_offers]

                if not unique_offers:
                    # Mark searches as processed even if no offers found
                    self.search_logs_col.update_many(
                        {'_id': {'$in': search_ids}},
                        {'$set': {'auto_activation_processed': True, 'auto_activation_processed_at': datetime.utcnow()}}
                    )
                    continue

                # Create offer grants for this user
                offer_ids = [o.get('offer_id') for o in unique_offers]
                self.offer_grant.grant_offers_to_user(
                    user_id=user_id,
                    offer_ids=offer_ids,
                    source='search_auto_activation',
                    granted_by='system'
                )

                # Record the activation in our tracking collection
                activation_doc = {
                    'user_id': user_id,
                    'username': username,
                    'keywords': keywords,
                    'offer_ids': offer_ids,
                    'offers': [{
                        'offer_id': o.get('offer_id'),
                        'name': o.get('name', ''),
                        'category': o.get('category', ''),
                        'vertical': o.get('vertical', ''),
                        'payout': o.get('payout', 0),
                        'network': o.get('network', ''),
                    } for o in unique_offers],
                    'trigger': 'search_auto_activation',
                    'trigger_reason': f"Searched for: {', '.join(keywords[:5])}",
                    'search_count': group.get('search_count', 0),
                    'delay_hours': delay_hours,
                    'grant_duration_days': grant_duration_days,
                    'status': 'active',
                    'activated_at': datetime.utcnow(),
                    'expires_at': datetime.utcnow() + timedelta(days=grant_duration_days),
                    'clicks': 0,
                    'last_click_at': None,
                    'deactivated_at': None,
                    'deactivation_reason': None,
                    'email_sent': True,
                }
                self.activations_col.insert_one(activation_doc)

                # Send email notification to the publisher
                self._send_activation_email(user_id, username, keywords, unique_offers)

                # Mark search logs as processed
                self.search_logs_col.update_many(
                    {'_id': {'$in': search_ids}},
                    {'$set': {
                        'auto_activation_processed': True,
                        'auto_activation_processed_at': datetime.utcnow(),
                        'auto_activation_offers_sent': len(offer_ids)
                    }}
                )

                total_activated += len(offer_ids)
                logger.info(
                    f"🎯 Auto-activated {len(offer_ids)} offers for user {username} "
                    f"(keywords: {', '.join(keywords[:3])})"
                )

            if total_activated > 0:
                logger.info(f"📊 Search auto-activation: activated {total_activated} offers for {len(user_groups)} users")

            return total_activated

        except Exception as e:
            logger.error(f"❌ Error in search auto-activation processing: {e}", exc_info=True)
            return 0

    def check_expiry_and_clicks(self):
        """
        Check all active auto-activations:
        - If clicked within last 30 days → extend expiry by 30 more days
        - If no click in 30 days → deactivate the grant
        """
        if self.activations_col is None:
            return

        settings = self._get_settings()
        grant_duration_days = settings.get('grant_duration_days', GRANT_DURATION_DAYS)

        try:
            now = datetime.utcnow()
            active_activations = list(self.activations_col.find({'status': 'active'}))

            for activation in active_activations:
                user_id = activation.get('user_id')
                offer_ids = activation.get('offer_ids', [])
                expires_at = activation.get('expires_at')

                if not user_id or not offer_ids:
                    continue

                # Check if any of the granted offers got clicked
                has_recent_click = False
                total_clicks = 0

                if self.clicks_col is not None:
                    for oid in offer_ids:
                        click_count = self.clicks_col.count_documents({
                            'user_id': user_id,
                            'offer_id': oid,
                            'timestamp': {'$gt': now - timedelta(days=grant_duration_days)}
                        })
                        if click_count > 0:
                            has_recent_click = True
                            total_clicks += click_count

                if has_recent_click:
                    # Extend expiry
                    new_expiry = now + timedelta(days=grant_duration_days)
                    self.activations_col.update_one(
                        {'_id': activation['_id']},
                        {'$set': {
                            'expires_at': new_expiry,
                            'clicks': total_clicks,
                            'last_click_at': now,
                            'last_extended_at': now,
                        }}
                    )
                elif expires_at and now > expires_at:
                    # Expired — deactivate
                    self.activations_col.update_one(
                        {'_id': activation['_id']},
                        {'$set': {
                            'status': 'expired',
                            'deactivated_at': now,
                            'deactivation_reason': f'No clicks in {grant_duration_days} days',
                        }}
                    )
                    # Also deactivate the offer grants
                    grant_col = db_instance.get_collection('offer_grants')
                    if grant_col is not None:
                        grant_col.update_many(
                            {
                                'user_id': user_id,
                                'offer_id': {'$in': offer_ids},
                                'source': 'search_auto_activation',
                                'is_active': True,
                            },
                            {'$set': {'is_active': False, 'expired_at': now}}
                        )
                    logger.info(f"⏸️ Auto-deactivated grants for user {user_id} (no clicks in {grant_duration_days} days)")

        except Exception as e:
            logger.error(f"❌ Error checking auto-activation expiry: {e}", exc_info=True)

    def start_service(self):
        """Start the background processing loop."""
        if self.running:
            logger.warning("Search auto-activation service already running")
            return

        self.running = True

        def _loop():
            while self.running:
                try:
                    settings = self._get_settings()
                    if settings['enabled']:
                        self.process_pending_searches()
                        self.check_expiry_and_clicks()
                    else:
                        logger.debug("Search auto-activation service is paused")
                except Exception as e:
                    logger.error(f"Error in search auto-activation loop: {e}")

                time.sleep(CHECK_INTERVAL_SECONDS)

        self._thread = Thread(target=_loop, daemon=True)
        self._thread.start()
        logger.info("✅ Search auto-activation service started (checks every 30 min)")

    def stop_service(self):
        """Stop the background service."""
        self.running = False
        logger.info("Search auto-activation service stopped")

    def get_stats(self):
        """Get service statistics for admin dashboard."""
        if self.activations_col is None:
            return {'total': 0, 'active': 0, 'expired': 0, 'total_offers_sent': 0}

        try:
            total = self.activations_col.count_documents({})
            active = self.activations_col.count_documents({'status': 'active'})
            expired = self.activations_col.count_documents({'status': 'expired'})

            # Total offers sent
            pipeline = [
                {'$group': {'_id': None, 'total_offers': {'$sum': {'$size': '$offer_ids'}}}}
            ]
            agg = list(self.activations_col.aggregate(pipeline))
            total_offers = agg[0]['total_offers'] if agg else 0

            # Users affected
            unique_users = len(self.activations_col.distinct('user_id'))

            # Clicks on auto-activated offers
            total_clicks = 0
            pipeline_clicks = [
                {'$match': {'status': 'active'}},
                {'$group': {'_id': None, 'total_clicks': {'$sum': '$clicks'}}}
            ]
            agg_clicks = list(self.activations_col.aggregate(pipeline_clicks))
            if agg_clicks:
                total_clicks = agg_clicks[0].get('total_clicks', 0)

            return {
                'total_activations': total,
                'active': active,
                'expired': expired,
                'total_offers_sent': total_offers,
                'unique_users': unique_users,
                'total_clicks': total_clicks,
                'settings': self._get_settings(),
            }
        except Exception as e:
            logger.error(f"Error getting auto-activation stats: {e}")
            return {'total_activations': 0, 'active': 0, 'expired': 0, 'total_offers_sent': 0}


# Singleton
_search_auto_activation_service = None


def get_search_auto_activation_service():
    global _search_auto_activation_service
    if _search_auto_activation_service is None:
        _search_auto_activation_service = SearchAutoActivationService()
    return _search_auto_activation_service
