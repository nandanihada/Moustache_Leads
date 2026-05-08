"""
Smart Offer Matcher Service
Picks unique, relevant, unsent offers for each user based on their profile and request history.
Uses the SAME logic as inventory-matches to find offers from each user's related offers list.
"""

import logging
import re
from datetime import datetime, timedelta
from database import db_instance
from models.email_campaign import EmailCampaign

logger = logging.getLogger(__name__)


class SmartOfferMatcher:
    """Service for intelligently matching offers to users for campaigns"""
    
    def __init__(self):
        self.offers_collection = db_instance.get_collection('offers')
        self.requests_collection = db_instance.get_collection('affiliate_requests')
        self.clicks_collection = db_instance.get_collection('clicks')
        self.conversions_collection = db_instance.get_collection('conversions')
    
    def get_offers_for_users(self, user_ids: list, config: dict) -> dict:
        """
        Get personalized offer selections for multiple users.
        Uses each user's own related offers list (same as inventory-matches).
        """
        total_per_user = config.get('total_offers_per_user', 3)
        per_email = config.get('offers_per_email', 1)
        source_tab = config.get('source_tab', 'all')
        user_offer_names = config.get('user_offer_names', {})  # {user_id: latest_offer_name}
        
        result = {}
        campaign_assigned_offers = set()
        
        for user_id in user_ids:
            try:
                # Use the specific offer name passed from frontend (same as inventory-matches)
                offer_name = user_offer_names.get(user_id, '')
                user_offers = self._match_for_user(
                    user_id, total_per_user, per_email, source_tab,
                    exclude_campaign_offers=campaign_assigned_offers,
                    offer_name=offer_name
                )
                result[user_id] = user_offers
                for email_batch in user_offers.get('emails', []):
                    for offer in email_batch.get('offers', []):
                        campaign_assigned_offers.add(offer.get('offer_id', ''))
            except Exception as e:
                logger.error(f"Error matching offers for user {user_id}: {e}")
                result[user_id] = {'emails': [], 'total_offers': 0}
        
        return result
    
    def _match_for_user(self, user_id: str, total_offers: int, per_email: int, source_tab: str, exclude_campaign_offers: set = None, offer_name: str = '') -> dict:
        """
        Match offers for a single user using the SAME logic as inventory-matches endpoint.
        Uses the user's latest_offer_name to find related offers (exactly like the Related Offers section).
        """
        if exclude_campaign_offers is None:
            exclude_campaign_offers = set()
        
        # 1. Determine the offer name to use for keyword matching
        # Priority: offer_name passed from frontend > latest request from DB
        if not offer_name:
            # Fallback: get from user's latest request
            user_query = {'user_id': user_id}
            latest_req = self.requests_collection.find_one(
                user_query,
                {'offer_name': 1},
                sort=[('requested_at', -1)]
            )
            if latest_req:
                offer_name = latest_req.get('offer_name', '')
        
        # 2. Get already-sent offers (never repeat)
        sent_offer_ids = EmailCampaign.get_sent_offer_ids(user_id)
        try:
            from models.offer_grant import OfferGrant
            grant_model = OfferGrant()
            if grant_model.collection is not None:
                grants = grant_model.collection.find({'user_id': user_id}, {'offer_id': 1})
                for g in grants:
                    sent_offer_ids.add(g.get('offer_id', ''))
        except:
            pass
        
        # 3. Extract keywords from the offer name (SAME logic as inventory-matches endpoint)
        stop_words = {'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
                      'of', 'with', 'by', '&', '-', '+', 'all', 'geos', 'global', 'incent', 'allowed'}
        
        keywords = [w.lower() for w in offer_name.split() if w.lower() not in stop_words and len(w) > 2] if offer_name else []
        
        if not keywords:
            keywords = [offer_name.lower()] if offer_name else []
        
        # 4. Find related offers using regex (SAME as inventory-matches)
        candidates = []
        if keywords:
            safe_keywords = [re.escape(kw) for kw in keywords]
            regex_patterns = [{'name': {'$regex': kw, '$options': 'i'}} for kw in safe_keywords]
            
            candidates = list(self.offers_collection.find(
                {'$or': regex_patterns},
                self._offer_projection()
            ).limit(50))
        
        # Fallback: if no keyword matches, get recent active offers
        if not candidates:
            candidates = list(self.offers_collection.find(
                {'status': {'$in': ['active', 'running']}},
                self._offer_projection()
            ).sort('created_at', -1).limit(30))
        
        # 5. Exclude already-sent offers and offers assigned to other users
        exclude_ids = sent_offer_ids | exclude_campaign_offers
        candidates = [c for c in candidates if c.get('offer_id') not in exclude_ids]
        
        # 6. Score candidates by keyword match strength (same as inventory-matches)
        scored = []
        for offer in candidates:
            name_lower = offer.get('name', '').lower()
            match_count = sum(1 for kw in keywords if kw in name_lower)
            # Strong match = 2+ keywords, Good = 1 keyword
            score = match_count * 20
            
            # Small bonus for active status
            if offer.get('status') == 'active':
                score += 3
            
            # Small bonus for payout
            payout = float(offer.get('payout', 0) or 0)
            score += min(5, payout * 0.2)
            
            offer['_score'] = score
            scored.append(offer)
        
        # Sort by score (strongest keyword matches first, then by payout)
        scored.sort(key=lambda x: (-x.get('_score', 0), -float(x.get('payout', 0) or 0)))
        
        # 7. Select top N
        selected = scored[:total_offers]
        
        # 8. Split into emails
        emails = []
        for i in range(0, len(selected), per_email):
            batch = selected[i:i + per_email]
            if batch:
                emails.append({
                    'email_number': len(emails) + 1,
                    'offers': batch,
                })
        
        return {
            'emails': emails,
            'total_offers': len(selected),
        }
    
    def _select_with_diversity(self, scored_offers: list, count: int) -> list:
        """Select offers ensuring category/network diversity"""
        if len(scored_offers) <= count:
            return scored_offers
        
        selected = []
        used_categories = {}
        used_networks = {}
        
        for offer in scored_offers:
            if len(selected) >= count:
                break
            
            category = offer.get('category', '') or offer.get('vertical', '') or 'unknown'
            network = offer.get('network', '') or 'unknown'
            
            cat_count = used_categories.get(category, 0)
            net_count = used_networks.get(network, 0)
            
            if cat_count >= 2 and len(scored_offers) > count * 2:
                continue
            if net_count >= 3 and len(scored_offers) > count * 2:
                continue
            
            selected.append(offer)
            used_categories[category] = cat_count + 1
            used_networks[network] = net_count + 1
        
        if len(selected) < count:
            remaining = [o for o in scored_offers if o not in selected]
            selected.extend(remaining[:count - len(selected)])
        
        return selected[:count]
    
    def _offer_projection(self) -> dict:
        """Standard projection for offer queries"""
        return {
            'offer_id': 1,
            'name': 1,
            'payout': 1,
            'network': 1,
            'category': 1,
            'vertical': 1,
            'countries': 1,
            'allowed_countries': 1,
            'status': 1,
            'image_url': 1,
            'thumbnail_url': 1,
            'preview_url': 1,
            'target_url': 1,
            'tracking_url': 1,
            'created_at': 1,
            'conversion_rate': 1,
            'description': 1,
        }

    def preview_campaign(self, user_ids: list, config: dict) -> dict:
        """
        Generate a preview of what offers would be sent to each user.
        Used by admin to review before confirming.
        Includes user stats: mail sent, clicks, conversions, offers sent.
        """
        matches = self.get_offers_for_users(user_ids, config)
        
        # Enrich with user info and stats
        users_col = db_instance.get_collection('users')
        clicks_col = db_instance.get_collection('clicks')
        conversions_col = db_instance.get_collection('conversions')
        email_activity_col = db_instance.get_collection('email_activity_logs')
        offer_send_col = db_instance.get_collection('offer_send_history')
        push_mail_col = db_instance.get_collection('push_mail_history')
        
        today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        
        preview = []
        
        for user_id in user_ids:
            user_data = matches.get(user_id, {'emails': [], 'total_offers': 0})
            
            # Get user info
            user_info = {'username': 'Unknown', 'email': '', 'first_name': ''}
            try:
                from bson import ObjectId
                user = users_col.find_one({'_id': ObjectId(user_id)}, {'username': 1, 'email': 1, 'first_name': 1})
                if user:
                    user_info = {
                        'username': user.get('username', ''),
                        'email': user.get('email', ''),
                        'first_name': user.get('first_name', ''),
                    }
            except:
                pass
            
            # Get user stats
            uid_str = str(user_id)
            total_clicks = 0
            total_conversions = 0
            total_mail_sent = 0
            mail_sent_today = 0
            last_mail_sent = None
            total_offers_sent = 0
            offers_sent_today = 0
            
            try:
                if clicks_col is not None:
                    total_clicks = clicks_col.count_documents({'user_id': uid_str})
                if conversions_col is not None:
                    total_conversions = conversions_col.count_documents({'user_id': uid_str})
                
                # Mail stats from multiple collections
                user_email = user_info.get('email', '')
                def _user_mail_query():
                    conditions = [{'user_id': uid_str}, {'recipient_user_ids': uid_str}, {'recipient_ids': uid_str}]
                    if user_email:
                        conditions.append({'recipient_emails': user_email})
                    return {'$or': conditions}
                
                uq = _user_mail_query()
                
                if email_activity_col is not None:
                    total_mail_sent += email_activity_col.count_documents(uq)
                    mail_sent_today += email_activity_col.count_documents({**uq, 'created_at': {'$gte': today_start}})
                    last_doc = email_activity_col.find_one(uq, sort=[('created_at', -1)])
                    if last_doc:
                        last_mail_sent = last_doc.get('created_at')
                    for doc in email_activity_col.find(uq, {'offer_ids': 1, 'offer_count': 1, 'created_at': 1}):
                        oc = doc.get('offer_count', len(doc.get('offer_ids', [])))
                        total_offers_sent += oc
                        if doc.get('created_at') and doc['created_at'] >= today_start:
                            offers_sent_today += oc
                
                if offer_send_col is not None:
                    for doc in offer_send_col.find(uq, {'offer_ids': 1, 'offer_count': 1, 'created_at': 1}):
                        total_mail_sent += 1
                        oc = doc.get('offer_count', len(doc.get('offer_ids', [])))
                        total_offers_sent += oc
                        dt = doc.get('created_at')
                        if dt:
                            if dt >= today_start:
                                mail_sent_today += 1
                                offers_sent_today += oc
                            if last_mail_sent is None or dt > last_mail_sent:
                                last_mail_sent = dt
                
                if push_mail_col is not None:
                    for doc in push_mail_col.find(uq, {'offer_ids': 1, 'created_at': 1}):
                        total_mail_sent += 1
                        oc = len(doc.get('offer_ids', []))
                        total_offers_sent += oc
                        dt = doc.get('created_at')
                        if dt:
                            if dt >= today_start:
                                mail_sent_today += 1
                                offers_sent_today += oc
                            if last_mail_sent is None or dt > last_mail_sent:
                                last_mail_sent = dt
            except Exception as stats_err:
                logger.warning(f"Error fetching stats for user {user_id}: {stats_err}")
            
            preview.append({
                'user_id': user_id,
                'username': user_info['username'],
                'email': user_info['email'],
                'first_name': user_info.get('first_name', ''),
                'total_offers': user_data['total_offers'],
                'emails': user_data['emails'],
                'stats': {
                    'total_mail_sent': total_mail_sent,
                    'mail_sent_today': mail_sent_today,
                    'last_mail_sent': last_mail_sent,
                    'total_offers_sent': total_offers_sent,
                    'offers_sent_today': offers_sent_today,
                    'total_clicks': total_clicks,
                    'total_conversions': total_conversions,
                },
            })
        
        return {'preview': preview, 'total_users': len(user_ids)}
