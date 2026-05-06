"""
Smart Offer Matcher Service
Picks unique, relevant, unsent offers for each user based on their profile and request history.
Implements: freshness scoring, diversity, never-repeat, tab-context matching.
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
        Ensures different offers across users in the same campaign.
        
        Args:
            user_ids: List of user IDs to match offers for
            config: {
                'total_offers_per_user': int,
                'offers_per_email': int,
                'source_tab': str (all/most_requested/approved/rejected/etc.),
                'price_percentage': float,
            }
        
        Returns:
            {
                user_id: {
                    'emails': [
                        {'email_number': 1, 'offers': [offer1, offer2, ...]},
                        {'email_number': 2, 'offers': [offer3, offer4, ...]},
                    ],
                    'total_offers': int,
                }
            }
        """
        total_per_user = config.get('total_offers_per_user', 3)
        per_email = config.get('offers_per_email', 1)
        source_tab = config.get('source_tab', 'all')
        
        result = {}
        # Track offers assigned across all users in this campaign to maximize diversity
        campaign_assigned_offers = set()
        
        for user_id in user_ids:
            try:
                user_offers = self._match_for_user(
                    user_id, total_per_user, per_email, source_tab,
                    exclude_campaign_offers=campaign_assigned_offers
                )
                result[user_id] = user_offers
                # Add assigned offers to campaign-level exclusion set
                for email_batch in user_offers.get('emails', []):
                    for offer in email_batch.get('offers', []):
                        campaign_assigned_offers.add(offer.get('offer_id', ''))
            except Exception as e:
                logger.error(f"Error matching offers for user {user_id}: {e}")
                result[user_id] = {'emails': [], 'total_offers': 0}
        
        return result
    
    def _match_for_user(self, user_id: str, total_offers: int, per_email: int, source_tab: str, exclude_campaign_offers: set = None) -> dict:
        """Match offers for a single user, excluding offers already assigned to other users in this campaign"""
        
        if exclude_campaign_offers is None:
            exclude_campaign_offers = set()
        
        # 1. Get user's request history (what they've asked for)
        user_requests = list(self.requests_collection.find(
            {'$or': [{'user_id': user_id}, {'user_id': {'$regex': f'^{re.escape(user_id)}$'}}]},
            {'offer_id': 1, 'offer_name': 1, 'status': 1}
        ))
        
        requested_offer_ids = {r.get('offer_id') for r in user_requests if r.get('offer_id')}
        requested_offer_names = [r.get('offer_name', '') for r in user_requests if r.get('offer_name')]
        
        # 2. Get already-sent offers (never repeat)
        sent_offer_ids = EmailCampaign.get_sent_offer_ids(user_id)
        
        # Also check offer_grants for backward compatibility
        try:
            from models.offer_grant import OfferGrant
            grant_model = OfferGrant()
            if grant_model.collection is not None:
                grants = grant_model.collection.find({'user_id': user_id}, {'offer_id': 1})
                for g in grants:
                    sent_offer_ids.add(g.get('offer_id', ''))
        except:
            pass
        
        # 3. Build candidate pool based on source_tab context
        candidates = self._get_candidate_pool(source_tab, requested_offer_names, requested_offer_ids)
        
        # 4. Exclude already-sent and already-requested offers AND offers assigned to other users in this campaign
        exclude_ids = sent_offer_ids | requested_offer_ids | exclude_campaign_offers
        candidates = [c for c in candidates if c.get('offer_id') not in exclude_ids]
        
        # 5. Score and rank candidates
        scored = self._score_offers(candidates, requested_offer_names, user_id)
        
        # 6. Select top N with diversity
        selected = self._select_with_diversity(scored, total_offers)
        
        # 7. Split into emails
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
    
    def _get_candidate_pool(self, source_tab: str, requested_names: list, requested_ids: set) -> list:
        """Get candidate offers based on source tab context"""
        
        if source_tab == 'most_requested':
            # Get most requested offers
            pipeline = [
                {'$group': {'_id': '$offer_id', 'count': {'$sum': 1}}},
                {'$sort': {'count': -1}},
                {'$limit': 100}
            ]
            top_requested = list(self.requests_collection.aggregate(pipeline))
            top_ids = [r['_id'] for r in top_requested if r['_id']]
            
            if top_ids:
                return list(self.offers_collection.find(
                    {'offer_id': {'$in': top_ids}, 'status': {'$in': ['active', 'running']}},
                    self._offer_projection()
                ))
        
        elif source_tab in ('approved', 'rejected', 'review'):
            # Find offers similar to what user requested
            pass
        
        # Default: keyword-based matching from user's request history
        keywords = self._extract_keywords(requested_names)
        
        if keywords:
            safe_keywords = [re.escape(kw) for kw in keywords[:10]]
            regex_patterns = [{'name': {'$regex': kw, '$options': 'i'}} for kw in safe_keywords]
            
            candidates = list(self.offers_collection.find(
                {
                    '$or': regex_patterns,
                    'status': {'$in': ['active', 'running']},
                },
                self._offer_projection()
            ).limit(200))
            
            if candidates:
                return candidates
        
        # Fallback: get recent active offers
        return list(self.offers_collection.find(
            {'status': {'$in': ['active', 'running']}},
            self._offer_projection()
        ).sort('created_at', -1).limit(100))
    
    def _score_offers(self, candidates: list, requested_names: list, user_id: str) -> list:
        """Score offers based on freshness, relevance, and conversion rate"""
        
        keywords = self._extract_keywords(requested_names)
        now = datetime.utcnow()
        
        scored = []
        for offer in candidates:
            score = 0.0
            
            # Freshness score (newer = better, max 30 points)
            created = offer.get('created_at', now - timedelta(days=365))
            if isinstance(created, datetime):
                age_days = (now - created).days
                freshness = max(0, 30 - (age_days * 0.5))
                score += freshness
            
            # Relevance score (keyword match, max 40 points)
            name_lower = offer.get('name', '').lower()
            match_count = sum(1 for kw in keywords if kw in name_lower)
            relevance = min(40, match_count * 10)
            score += relevance
            
            # Payout score (higher payout = more attractive, max 15 points)
            payout = float(offer.get('payout', 0) or 0)
            payout_score = min(15, payout * 0.5)
            score += payout_score
            
            # Conversion rate bonus (max 15 points)
            # Use offer-level stats if available
            conv_rate = float(offer.get('conversion_rate', 0) or 0)
            score += min(15, conv_rate * 5)
            
            offer['_score'] = score
            scored.append(offer)
        
        # Sort by score descending
        scored.sort(key=lambda x: x.get('_score', 0), reverse=True)
        return scored
    
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
            
            # Penalize if too many from same category/network
            cat_count = used_categories.get(category, 0)
            net_count = used_networks.get(network, 0)
            
            # Allow max 2 from same category, max 3 from same network
            if cat_count >= 2 and len(scored_offers) > count * 2:
                continue
            if net_count >= 3 and len(scored_offers) > count * 2:
                continue
            
            selected.append(offer)
            used_categories[category] = cat_count + 1
            used_networks[network] = net_count + 1
        
        # If diversity filtering was too strict, fill remaining from top scores
        if len(selected) < count:
            remaining = [o for o in scored_offers if o not in selected]
            selected.extend(remaining[:count - len(selected)])
        
        return selected[:count]
    
    def _extract_keywords(self, names: list) -> list:
        """Extract meaningful keywords from offer names"""
        stop_words = {
            'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
            'of', 'with', 'by', '&', '-', '+', 'all', 'geos', 'global', 'incent',
            'allowed', 'offer', 'new', 'hot', 'best', 'top', 'free', 'get',
        }
        
        keywords = set()
        for name in names:
            if not name:
                continue
            words = re.split(r'[\s\-_/|,]+', name.lower())
            for w in words:
                w = re.sub(r'[^a-z0-9]', '', w)
                if w and len(w) > 2 and w not in stop_words:
                    keywords.add(w)
        
        return list(keywords)[:20]
    
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
            'created_at': 1,
            'conversion_rate': 1,
            'description': 1,
        }
    
    def preview_campaign(self, user_ids: list, config: dict) -> dict:
        """
        Generate a preview of what offers would be sent to each user.
        Used by admin to review before confirming.
        """
        matches = self.get_offers_for_users(user_ids, config)
        
        # Enrich with user info
        users_col = db_instance.get_collection('users')
        preview = []
        
        for user_id in user_ids:
            user_data = matches.get(user_id, {'emails': [], 'total_offers': 0})
            
            # Get user info
            user_info = {'username': 'Unknown', 'email': ''}
            try:
                from bson import ObjectId
                user = users_col.find_one({'_id': ObjectId(user_id)}, {'username': 1, 'email': 1})
                if user:
                    user_info = {'username': user.get('username', ''), 'email': user.get('email', '')}
            except:
                pass
            
            preview.append({
                'user_id': user_id,
                'username': user_info['username'],
                'email': user_info['email'],
                'total_offers': user_data['total_offers'],
                'emails': user_data['emails'],
            })
        
        return {'preview': preview, 'total_users': len(user_ids)}
