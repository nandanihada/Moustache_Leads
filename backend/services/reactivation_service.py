"""
Reactivation Service
Identifies inactive users, computes reactivation scores, builds behavior profiles,
and handles outreach + support ticket creation for user reactivation campaigns.
"""

from datetime import datetime, timedelta
from bson import ObjectId
from database import db_instance
import logging
import math

logger = logging.getLogger(__name__)


class ReactivationService:
    """Service for inactive user reactivation engine"""

    def __init__(self):
        self.users_col = db_instance.get_collection('users')
        self.login_logs_col = db_instance.get_collection('login_logs')
        self.search_logs_col = db_instance.get_collection('search_logs')
        self.clicks_col = db_instance.get_collection('offerwall_clicks_detailed')
        self.conversions_col = db_instance.get_collection('offerwall_conversions_detailed')
        self.offers_col = db_instance.get_collection('offers')
        self.support_col = db_instance.get_collection('support_messages')
        self.outreach_col = db_instance.get_collection('reactivation_outreach')
        self.placements_col = db_instance.get_collection('placements')

    # ── Reactivation Score ──────────────────────────────────────────────

    def _compute_reactivation_score(self, user_data):
        """
        Compute reactivation score (0-100) for a user.
        Higher = more worth reactivating.

        Factors:
        - Recency (25%): How recently they were active (more recent = higher)
        - Earnings (25%): Past earnings indicate value
        - Conversion history (20%): Users who converted are more likely to again
        - Engagement depth (20%): Searched + clicked + converted > just viewed
        - Account completeness (10%): Verified email, approved placement
        """
        score = 0.0

        # 1. Recency score (25 pts max)
        days_inactive = user_data.get('days_inactive', 999)
        if days_inactive <= 7:
            score += 25
        elif days_inactive <= 30:
            score += 20
        elif days_inactive <= 90:
            score += 14
        elif days_inactive <= 180:
            score += 8
        else:
            score += max(2, 5 - (days_inactive - 180) / 100)

        # 2. Earnings score (25 pts max)
        earnings = user_data.get('total_earnings', 0)
        if earnings > 500:
            score += 25
        elif earnings > 100:
            score += 20
        elif earnings > 50:
            score += 15
        elif earnings > 10:
            score += 10
        elif earnings > 0:
            score += 5

        # 3. Conversion history (20 pts max)
        conversions = user_data.get('total_conversions', 0)
        if conversions >= 20:
            score += 20
        elif conversions >= 10:
            score += 16
        elif conversions >= 5:
            score += 12
        elif conversions >= 1:
            score += 7
        else:
            score += 0

        # 4. Engagement depth (20 pts max)
        clicks = user_data.get('total_clicks', 0)
        searches = user_data.get('total_searches', 0)
        if conversions > 0 and clicks > 5 and searches > 0:
            score += 20
        elif clicks > 10 and searches > 0:
            score += 15
        elif clicks > 5:
            score += 10
        elif clicks > 0 or searches > 0:
            score += 5

        # 5. Account completeness (10 pts max)
        if user_data.get('email_verified'):
            score += 4
        if user_data.get('has_approved_placement'):
            score += 3
        if user_data.get('account_status') == 'approved':
            score += 3

        return min(100, max(0, round(score)))

    # ── Risk Level ──────────────────────────────────────────────────────

    def _compute_risk_level(self, user_data):
        """Compute risk level based on fraud indicators"""
        fraud_score = user_data.get('fraud_score', 0)
        if fraud_score >= 50:
            return 'suspicious'
        elif fraud_score >= 15:
            return 'medium'
        return 'safe'

    # ── Activity Level ──────────────────────────────────────────────────

    def _get_activity_level(self, user_data):
        """Categorize user activity level"""
        conversions = user_data.get('total_conversions', 0)
        clicks = user_data.get('total_clicks', 0)

        if conversions > 0:
            return 'converted_before'
        elif clicks > 0 and conversions == 0:
            return 'clicked_no_conv'
        elif user_data.get('total_searches', 0) > 0 or user_data.get('viewed_offers', 0) > 0:
            return 'viewed_offers'
        return 'never_clicked'

    # ── Intent Categories ───────────────────────────────────────────────

    KEYWORD_CATEGORY_MAP = {
        'gaming': '🎮 Gaming', 'game': '🎮 Gaming', 'play': '🎮 Gaming',
        'casino': '🎮 Gaming', 'cpa': '🎮 Gaming',
        'survey': '📋 Survey', 'surveys': '📋 Survey', 'quiz': '📋 Survey',
        'payout': '💰 High Payout', 'high pay': '💰 High Payout',
        'earn': '💰 High Payout', 'money': '💰 High Payout',
        'sweepstake': '🎁 Sweepstakes', 'sweepstakes': '🎁 Sweepstakes',
        'win': '🎁 Sweepstakes', 'prize': '🎁 Sweepstakes', 'giveaway': '🎁 Sweepstakes',
        'install': '📱 App Install', 'app': '📱 App Install', 'download': '📱 App Install',
        'signup': '📝 Sign Up', 'register': '📝 Sign Up', 'sign up': '📝 Sign Up',
        'crypto': '🪙 Crypto', 'bitcoin': '🪙 Crypto', 'trading': '🪙 Crypto',
        'finance': '💳 Finance', 'loan': '💳 Finance', 'credit': '💳 Finance',
        'insurance': '💳 Finance',
    }

    def _derive_intent_tags(self, search_keywords, clicked_offer_categories=None):
        """Derive intent tags from search keywords and offer categories"""
        tags = set()
        for kw in (search_keywords or []):
            kw_lower = kw.lower()
            for pattern, tag in self.KEYWORD_CATEGORY_MAP.items():
                if pattern in kw_lower:
                    tags.add(tag)
        for cat in (clicked_offer_categories or []):
            cat_lower = (cat or '').lower()
            for pattern, tag in self.KEYWORD_CATEGORY_MAP.items():
                if pattern in cat_lower:
                    tags.add(tag)
        return list(tags)[:6]  # Max 6 tags


    # ── Get Inactive Users (main list endpoint) ────────────────────────

    def get_inactive_users(self, filters=None, page=1, per_page=25,
                           sort_by='longest_inactive', sort_order=-1):
        """
        Get paginated list of inactive users with computed scores and behavior data.
        """
        filters = filters or {}
        now = datetime.utcnow()

        try:
            # Step 1: Build base user query
            user_query = {'role': {'$in': ['user', 'partner']}, 'is_active': True}

            if filters.get('email_verified') is not None:
                user_query['email_verified'] = filters['email_verified']
            if filters.get('account_status'):
                user_query['account_status'] = filters['account_status']
            if filters.get('search'):
                search_term = filters['search']
                user_query['$or'] = [
                    {'username': {'$regex': search_term, '$options': 'i'}},
                    {'email': {'$regex': search_term, '$options': 'i'}},
                    {'first_name': {'$regex': search_term, '$options': 'i'}},
                    {'last_name': {'$regex': search_term, '$options': 'i'}},
                ]

            # Get all matching users
            users = list(self.users_col.find(
                user_query,
                {'password': 0}
            ))

            if not users:
                return {'users': [], 'total': 0, 'page': page, 'per_page': per_page, 'pages': 0}

            user_ids = [u['_id'] for u in users]
            user_id_strs = [str(uid) for uid in user_ids]
            # Match both ObjectId and string user_id formats in login_logs
            user_id_match = {'$in': user_id_strs + user_ids}

            # Step 2: Batch fetch last login for all users
            login_pipeline = [
                {'$match': {'user_id': user_id_match, 'status': 'success'}},
                {'$group': {
                    '_id': '$user_id',
                    'last_login': {'$max': '$login_time'},
                    'login_count': {'$sum': 1},
                    'last_ip': {'$last': '$ip_address'},
                    'last_device': {'$last': '$device_info'},
                    'last_country': {'$last': {'$ifNull': ['$location.country', '$geo_data.country']}},
                    'last_country_code': {'$last': {'$ifNull': ['$location.country_code', '$geo_data.country_code']}},
                    'last_city': {'$last': {'$ifNull': ['$location.city', '$geo_data.city']}},
                    'latitude': {'$last': {'$ifNull': ['$location.latitude', '$geo_data.latitude']}},
                    'longitude': {'$last': {'$ifNull': ['$location.longitude', '$geo_data.longitude']}},
                }}
            ]
            login_data = {str(d['_id']): d for d in self.login_logs_col.aggregate(login_pipeline)}

            # Step 3: Batch fetch click stats
            click_pipeline = [
                {'$match': {'user_id': user_id_match}},
                {'$group': {
                    '_id': '$user_id',
                    'total_clicks': {'$sum': 1},
                    'last_click': {'$max': '$timestamp'},
                    'offer_categories': {'$addToSet': '$offer_category'},
                }}
            ]
            click_data = {}
            if self.clicks_col is not None:
                try:
                    click_data = {str(d['_id']): d for d in self.clicks_col.aggregate(click_pipeline)}
                except Exception:
                    pass

            # Step 4: Batch fetch conversion stats
            conv_pipeline = [
                {'$match': {'user_id': user_id_match}},
                {'$group': {
                    '_id': '$user_id',
                    'total_conversions': {'$sum': 1},
                    'total_earnings': {'$sum': {'$ifNull': ['$payout', 0]}},
                }}
            ]
            conv_data = {}
            if self.conversions_col is not None:
                try:
                    conv_data = {str(d['_id']): d for d in self.conversions_col.aggregate(conv_pipeline)}
                except Exception:
                    pass

            # Step 5: Batch fetch search stats
            search_pipeline = [
                {'$match': {'user_id': user_id_match}},
                {'$group': {
                    '_id': '$user_id',
                    'total_searches': {'$sum': 1},
                    'last_search': {'$max': '$timestamp'},
                    'search_keywords': {'$addToSet': '$keyword'},
                }}
            ]
            search_data = {}
            if self.search_logs_col is not None:
                try:
                    search_data = {str(d['_id']): d for d in self.search_logs_col.aggregate(search_pipeline)}
                except Exception:
                    pass

            # Step 6: Batch fetch placement approval status
            placement_pipeline = [
                {'$match': {'publisher_id': user_id_match, 'status': 'approved'}},
                {'$group': {'_id': '$publisher_id', 'count': {'$sum': 1}}}
            ]
            placement_data = {}
            if self.placements_col is not None:
                try:
                    placement_data = {str(d['_id']): d for d in self.placements_col.aggregate(placement_pipeline)}
                except Exception:
                    pass

            # Step 7: Batch fetch outreach history
            outreach_pipeline = [
                {'$match': {'user_id': user_id_match}},
                {'$group': {
                    '_id': '$user_id',
                    'outreach_count': {'$sum': 1},
                    'last_outreach': {'$max': '$created_at'},
                }}
            ]
            outreach_data = {}
            if self.outreach_col is not None:
                try:
                    outreach_data = {str(d['_id']): d for d in self.outreach_col.aggregate(outreach_pipeline)}
                except Exception:
                    pass

            # Step 8: Enrich each user
            enriched_users = []
            for user in users:
                uid_str = str(user['_id'])
                login = login_data.get(uid_str, {})
                clicks = click_data.get(uid_str, {})
                convs = conv_data.get(uid_str, {})
                searches = search_data.get(uid_str, {})
                placements = placement_data.get(uid_str, {})
                outreach = outreach_data.get(uid_str, {})

                last_login = login.get('last_login')
                days_inactive = (now - last_login).days if last_login else 9999

                enriched = {
                    '_id': uid_str,
                    'username': user.get('username', ''),
                    'email': user.get('email', ''),
                    'first_name': user.get('first_name', ''),
                    'last_name': user.get('last_name', ''),
                    'email_verified': user.get('email_verified', False),
                    'account_status': user.get('account_status', 'pending_approval'),
                    'created_at': user.get('created_at'),
                    'days_inactive': days_inactive,
                    'last_login': last_login,
                    'login_count': login.get('login_count', 0),
                    'country': login.get('last_country', 'Unknown'),
                    'country_code': login.get('last_country_code', 'XX'),
                    'city': login.get('last_city', 'Unknown'),
                    'latitude': login.get('latitude'),
                    'longitude': login.get('longitude'),
                    'last_device': login.get('last_device'),
                    'total_clicks': clicks.get('total_clicks', 0),
                    'last_click': clicks.get('last_click'),
                    'total_conversions': convs.get('total_conversions', 0),
                    'total_earnings': convs.get('total_earnings', 0),
                    'total_searches': searches.get('total_searches', 0),
                    'last_search': searches.get('last_search'),
                    'search_keywords': searches.get('search_keywords', []),
                    'has_approved_placement': placements.get('count', 0) > 0,
                    'approved_placements': placements.get('count', 0),
                    'outreach_count': outreach.get('outreach_count', 0),
                    'last_outreach': outreach.get('last_outreach'),
                    'fraud_score': 0,  # Will be enriched if fraud data exists
                }

                # Compute derived fields
                enriched['reactivation_score'] = self._compute_reactivation_score(enriched)
                enriched['risk_level'] = self._compute_risk_level(enriched)
                enriched['activity_level'] = self._get_activity_level(enriched)
                enriched['intent_tags'] = self._derive_intent_tags(
                    searches.get('search_keywords', []),
                    clicks.get('offer_categories', [])
                )

                enriched_users.append(enriched)

            # Step 9: Apply post-enrichment filters
            if filters.get('inactivity_period'):
                period = filters['inactivity_period']
                if period == '7d':
                    enriched_users = [u for u in enriched_users if u['days_inactive'] >= 7]
                elif period == '30d':
                    enriched_users = [u for u in enriched_users if 7 <= u['days_inactive'] < 30]
                elif period == '7_30d':
                    enriched_users = [u for u in enriched_users if 7 <= u['days_inactive'] <= 30]
                elif period == '30_90d':
                    enriched_users = [u for u in enriched_users if 30 <= u['days_inactive'] <= 90]
                elif period == '90d':
                    enriched_users = [u for u in enriched_users if u['days_inactive'] >= 90]
                elif period == '180d':
                    enriched_users = [u for u in enriched_users if u['days_inactive'] >= 180]
                elif period == '90_plus':
                    enriched_users = [u for u in enriched_users if u['days_inactive'] >= 90]
                elif period == 'never':
                    enriched_users = [u for u in enriched_users if u['days_inactive'] >= 9999]

            if filters.get('activity_level'):
                enriched_users = [u for u in enriched_users if u['activity_level'] == filters['activity_level']]

            if filters.get('risk_level'):
                enriched_users = [u for u in enriched_users if u['risk_level'] == filters['risk_level']]

            if filters.get('country'):
                enriched_users = [u for u in enriched_users if u['country_code'] == filters['country']]

            if filters.get('has_earnings'):
                enriched_users = [u for u in enriched_users if u['total_earnings'] > 0]

            if filters.get('has_placement'):
                enriched_users = [u for u in enriched_users if u['has_approved_placement']]

            # Step 10: Sort
            sort_key_map = {
                'longest_inactive': ('days_inactive', True),
                'reactivation_score': ('reactivation_score', True),
                'highest_earnings': ('total_earnings', True),
                'most_conversions': ('total_conversions', True),
                'newest_first': ('created_at', True),
            }
            sort_field, reverse = sort_key_map.get(sort_by, ('days_inactive', True))
            enriched_users.sort(
                key=lambda u: u.get(sort_field) or 0,
                reverse=reverse
            )

            # Step 11: Paginate
            total = len(enriched_users)
            start = (page - 1) * per_page
            end = start + per_page
            paginated = enriched_users[start:end]

            return {
                'users': paginated,
                'total': total,
                'page': page,
                'per_page': per_page,
                'pages': math.ceil(total / per_page) if total > 0 else 0,
            }

        except Exception as e:
            logger.error(f"Error getting inactive users: {e}")
            return {'users': [], 'total': 0, 'page': page, 'per_page': per_page, 'pages': 0, 'error': str(e)}


    # ── Stats (top cards + map data) ────────────────────────────────────

    def get_stats(self):
        """Get overview stats for the reactivation dashboard"""
        now = datetime.utcnow()
        try:
            user_query = {'role': {'$in': ['user', 'partner']}, 'is_active': True}
            all_users = list(self.users_col.find(user_query, {'_id': 1}))
            all_users_full = list(self.users_col.find(user_query, {'_id': 1, 'username': 1, 'first_name': 1}))
            user_id_strs = [str(u['_id']) for u in all_users]
            user_ids_obj = [u['_id'] for u in all_users]
            user_id_match_stats = {'$in': user_id_strs + user_ids_obj}

            # Get last login per user
            login_pipeline = [
                {'$match': {'user_id': user_id_match_stats, 'status': 'success'}},
                {'$group': {
                    '_id': '$user_id',
                    'last_login': {'$max': '$login_time'},
                    'country': {'$last': {'$ifNull': ['$location.country', '$geo_data.country']}},
                    'country_code': {'$last': {'$ifNull': ['$location.country_code', '$geo_data.country_code']}},
                    'latitude': {'$last': {'$ifNull': ['$location.latitude', '$geo_data.latitude']}},
                    'longitude': {'$last': {'$ifNull': ['$location.longitude', '$geo_data.longitude']}},
                }}
            ]
            login_data = list(self.login_logs_col.aggregate(login_pipeline))
            login_map = {str(d['_id']): d for d in login_data}

            # Categorize by inactivity
            buckets = {'7d': 0, '30d': 0, '90d': 0, '180d': 0, '180_plus': 0, 'never': 0}
            total_inactive = 0
            country_stats = {}
            map_points = []

            # Build username lookup
            user_name_map = {}
            for u in all_users_full:
                user_name_map[str(u['_id'])] = u.get('username', '') or u.get('first_name', '') or 'Unknown'

            for uid_str in user_id_strs:
                login = login_map.get(uid_str)
                if not login or not login.get('last_login'):
                    buckets['never'] += 1
                    total_inactive += 1
                    continue

                days = (now - login['last_login']).days
                if days < 7:
                    continue  # Active user, skip

                total_inactive += 1
                if days <= 30:
                    buckets['7d'] += 1
                elif days <= 90:
                    buckets['30d'] += 1
                elif days <= 180:
                    buckets['90d'] += 1
                else:
                    buckets['180_plus'] += 1

                # Country aggregation
                cc = login.get('country_code', 'XX')
                country_name = login.get('country', 'Unknown')
                if cc not in country_stats:
                    country_stats[cc] = {'country': country_name, 'code': cc, 'count': 0, 'avg_days': 0, 'total_days': 0}
                country_stats[cc]['count'] += 1
                country_stats[cc]['total_days'] += days

            # Map points — use login geo, or fallback to user's last known IP geo
            for uid_str in user_id_strs:
                login = login_map.get(uid_str)
                lat = None
                lng = None
                country_name = 'Unknown'
                cc = 'XX'

                if login:
                    lat = login.get('latitude')
                    lng = login.get('longitude')
                    country_name = login.get('country', 'Unknown')
                    cc = login.get('country_code', 'XX')

                if lat and lng:
                    map_points.append({
                        'user_id': uid_str,
                        'username': user_name_map.get(uid_str, 'Unknown'),
                        'lat': lat,
                        'lng': lng,
                        'country': country_name,
                        'country_code': cc,
                        'days_inactive': (now - login['last_login']).days if login and login.get('last_login') else 9999,
                    })

            # Compute avg days per country
            for cc in country_stats:
                c = country_stats[cc]
                c['avg_days'] = round(c['total_days'] / c['count']) if c['count'] > 0 else 0
                del c['total_days']

            # Outreach stats
            outreach_this_week = 0
            if self.outreach_col is not None:
                try:
                    week_ago = now - timedelta(days=7)
                    outreach_this_week = self.outreach_col.count_documents({
                        'created_at': {'$gte': week_ago}
                    })
                except Exception:
                    pass

            return {
                'total_inactive': total_inactive,
                'total_users': len(all_users),
                'buckets': buckets,
                'country_stats': sorted(country_stats.values(), key=lambda x: x['count'], reverse=True),
                'map_points': map_points[:500],  # Cap at 500 for performance
                'outreach_this_week': outreach_this_week,
            }

        except Exception as e:
            logger.error(f"Error getting reactivation stats: {e}")
            return {'total_inactive': 0, 'total_users': 0, 'buckets': {}, 'country_stats': [], 'map_points': [], 'outreach_this_week': 0}

    # ── User Behavior Profile ───────────────────────────────────────────

    def get_user_profile(self, user_id):
        """Get detailed behavior profile for a single user"""
        try:
            uid_str = str(user_id)

            # Last searched
            last_search = None
            if self.search_logs_col is not None:
                last_search = self.search_logs_col.find_one(
                    {'user_id': uid_str},
                    sort=[('timestamp', -1)]
                )

            # All search keywords
            search_keywords = []
            if self.search_logs_col is not None:
                keywords_cursor = self.search_logs_col.find(
                    {'user_id': uid_str},
                    {'keyword': 1, 'timestamp': 1}
                ).sort('timestamp', -1).limit(50)
                search_keywords = [s.get('keyword', '') for s in keywords_cursor if s.get('keyword')]

            # Click data - most clicked, last clicked
            click_stats = []
            if self.clicks_col is not None:
                click_pipeline = [
                    {'$match': {'user_id': uid_str}},
                    {'$group': {
                        '_id': '$offer_id',
                        'offer_name': {'$first': '$offer_name'},
                        'click_count': {'$sum': 1},
                        'last_click': {'$max': '$timestamp'},
                        'category': {'$first': '$offer_category'},
                    }},
                    {'$sort': {'click_count': -1}},
                    {'$limit': 10}
                ]
                try:
                    click_stats = list(self.clicks_col.aggregate(click_pipeline))
                except Exception:
                    pass

            # Conversion data - highest converting
            conv_stats = []
            if self.conversions_col is not None:
                conv_pipeline = [
                    {'$match': {'user_id': uid_str}},
                    {'$group': {
                        '_id': '$offer_id',
                        'offer_name': {'$first': '$offer_name'},
                        'conv_count': {'$sum': 1},
                        'total_payout': {'$sum': {'$ifNull': ['$payout', 0]}},
                    }},
                    {'$sort': {'conv_count': -1}},
                    {'$limit': 10}
                ]
                try:
                    conv_stats = list(self.conversions_col.aggregate(conv_pipeline))
                except Exception:
                    pass

            # Device history from login logs
            device_history = []
            if self.login_logs_col is not None:
                device_pipeline = [
                    {'$match': {'user_id': uid_str, 'status': 'success'}},
                    {'$group': {
                        '_id': '$device_info.device_fingerprint',
                        'device_type': {'$last': '$device_info.device_type'},
                        'browser': {'$last': '$device_info.browser'},
                        'os': {'$last': '$device_info.os'},
                        'last_seen': {'$max': '$login_time'},
                        'count': {'$sum': 1},
                    }},
                    {'$sort': {'last_seen': -1}},
                    {'$limit': 5}
                ]
                try:
                    device_history = list(self.login_logs_col.aggregate(device_pipeline))
                except Exception:
                    pass

            # IP usage
            ip_stats = {}
            if self.login_logs_col is not None:
                ip_pipeline = [
                    {'$match': {'user_id': uid_str, 'status': 'success'}},
                    {'$group': {'_id': '$ip_address'}},
                ]
                try:
                    ips = list(self.login_logs_col.aggregate(ip_pipeline))
                    ip_stats['unique_ips'] = len(ips)
                except Exception:
                    ip_stats['unique_ips'] = 0

            # Offer memory (outreach history)
            offer_memory = []
            if self.outreach_col is not None:
                try:
                    outreach_docs = list(self.outreach_col.find(
                        {'user_id': uid_str},
                        {'offer_id': 1, 'offer_name': 1, 'created_at': 1, 'channel': 1, 'status': 1}
                    ).sort('created_at', -1).limit(20))

                    # Group by offer
                    offer_mem_map = {}
                    for doc in outreach_docs:
                        oid = doc.get('offer_id', 'unknown')
                        if oid not in offer_mem_map:
                            offer_mem_map[oid] = {
                                'offer_id': oid,
                                'offer_name': doc.get('offer_name', 'Unknown'),
                                'send_count': 0,
                                'last_sent': doc.get('created_at'),
                            }
                        offer_mem_map[oid]['send_count'] += 1
                    offer_memory = list(offer_mem_map.values())
                except Exception:
                    pass

            # Outreach history (full list for S+S tab)
            outreach_history = []
            if self.outreach_col is not None:
                try:
                    outreach_history = list(self.outreach_col.find(
                        {'user_id': uid_str},
                        {'_id': 0, 'offer_id': 1, 'offer_name': 1, 'channel': 1, 'subject': 1,
                         'message': 1, 'status': 1, 'send_time': 1, 'created_at': 1, 'sent_at': 1}
                    ).sort('created_at', -1).limit(50))
                except Exception:
                    pass

            # Support ticket history
            support_history = []
            if self.support_col is not None:
                try:
                    support_docs = list(self.support_col.find(
                        {'user_id': ObjectId(uid_str), 'source': 'reactivation'},
                        {'_id': 1, 'subject': 1, 'body': 1, 'status': 1, 'issue_type': 1,
                         'priority': 1, 'assigned_to': 1, 'created_at': 1}
                    ).sort('created_at', -1).limit(20))
                    for doc in support_docs:
                        doc['_id'] = str(doc['_id'])
                    support_history = support_docs
                except Exception:
                    pass

            # Build profile
            most_clicked = click_stats[0] if click_stats else None
            highest_converting = conv_stats[0] if conv_stats else None
            last_clicked = None
            if click_stats:
                by_date = sorted(click_stats, key=lambda x: x.get('last_click') or datetime.min, reverse=True)
                last_clicked = by_date[0] if by_date else None

            intent_tags = self._derive_intent_tags(
                search_keywords,
                [c.get('category') for c in click_stats]
            )

            return {
                'last_searched': {
                    'keyword': last_search.get('keyword') if last_search else None,
                    'date': last_search.get('timestamp') if last_search else None,
                } if last_search else None,
                'last_picked': {
                    'offer_name': last_clicked.get('offer_name') if last_clicked else None,
                    'date': last_clicked.get('last_click') if last_clicked else None,
                } if last_clicked else None,
                'highest_converting': {
                    'offer_name': highest_converting.get('offer_name') if highest_converting else None,
                    'conversions': highest_converting.get('conv_count', 0) if highest_converting else 0,
                    'earnings': highest_converting.get('total_payout', 0) if highest_converting else 0,
                } if highest_converting else None,
                'most_clicked': {
                    'offer_name': most_clicked.get('offer_name') if most_clicked else None,
                    'clicks': most_clicked.get('click_count', 0) if most_clicked else 0,
                } if most_clicked else None,
                'intent_tags': intent_tags,
                'search_keywords': search_keywords[:10],
                'device_history': device_history,
                'ip_stats': ip_stats,
                'offer_memory': offer_memory,
                'outreach_history': outreach_history,
                'support_history': support_history,
                'click_stats': click_stats,
                'conv_stats': conv_stats,
            }

        except Exception as e:
            logger.error(f"Error getting user profile: {e}")
            return {}


    # ── Outreach Actions ────────────────────────────────────────────────

    def send_outreach(self, user_ids, offer_id, offer_name, channel, message,
                      subject='', send_time='now', scheduled_at=None,
                      admin_id=None):
        """
        Send or schedule outreach to one or more users.
        Returns list of outreach records created.
        """
        from services.email_service import get_email_service
        email_svc = get_email_service()
        results = []

        for uid_str in user_ids:
            try:
                user = self.users_col.find_one({'_id': ObjectId(uid_str)})
                if not user:
                    results.append({'user_id': uid_str, 'status': 'error', 'error': 'User not found'})
                    continue

                # Personalize message
                name = user.get('first_name') or user.get('username', 'there')
                personalized_msg = message.replace('{name}', name)
                personalized_subject = (subject or 'We have offers for you!').replace('{name}', name)

                outreach_doc = {
                    'user_id': uid_str,
                    'user_email': user.get('email'),
                    'username': user.get('username'),
                    'offer_id': offer_id or None,
                    'offer_name': offer_name or None,
                    'channel': channel,
                    'subject': personalized_subject,
                    'message': personalized_msg,
                    'send_time': send_time,
                    'status': 'pending',
                    'admin_id': admin_id,
                    'created_at': datetime.utcnow(),
                }

                if send_time == 'now' and channel == 'email':
                    # Send immediately
                    success = email_svc._send_email(
                        user.get('email'),
                        personalized_subject,
                        self._build_outreach_email_html(personalized_msg, name, offer_name)
                    )
                    outreach_doc['status'] = 'sent' if success else 'failed'
                    outreach_doc['sent_at'] = datetime.utcnow() if success else None

                elif send_time != 'now':
                    # Schedule for later
                    outreach_doc['status'] = 'scheduled'
                    outreach_doc['scheduled_at'] = scheduled_at or datetime.utcnow()

                    if channel == 'email':
                        from models.scheduled_email import ScheduledEmail
                        ScheduledEmail.create(
                            subject=personalized_subject,
                            body=self._build_outreach_email_html(personalized_msg, name, offer_name),
                            recipients=[user.get('email')],
                            scheduled_at=outreach_doc['scheduled_at'],
                            created_by=admin_id or 'system',
                            email_type='reactivation',
                        )

                elif channel == 'offer_link':
                    # Just record the outreach, admin will share the link manually
                    outreach_doc['status'] = 'link_generated'

                # Save outreach record
                if self.outreach_col is not None:
                    self.outreach_col.insert_one(outreach_doc)

                results.append({
                    'user_id': uid_str,
                    'email': user.get('email'),
                    'status': outreach_doc['status'],
                })

            except Exception as e:
                logger.error(f"Error sending outreach to {uid_str}: {e}")
                results.append({'user_id': uid_str, 'status': 'error', 'error': str(e)})

        return results

    def _build_outreach_email_html(self, message, name, offer_name=None):
        """Build HTML email for reactivation outreach"""
        offer_section = ''
        if offer_name:
            # Split multiple offers and list them nicely
            offer_names = [n.strip() for n in offer_name.split(',') if n.strip()]
            if len(offer_names) == 1:
                offer_section = f'''
                <div style="background: #1a1a2e; border-radius: 8px; padding: 16px; margin: 16px 0; border-left: 4px solid #ff6b35;">
                    <p style="color: #ff6b35; font-weight: bold; margin: 0 0 4px 0;">🎯 Recommended Offer</p>
                    <p style="color: #ffffff; margin: 0; font-size: 16px;">{offer_names[0]}</p>
                </div>
                '''
            else:
                items = ''.join(f'<li style="color: #ffffff; margin: 6px 0; font-size: 14px;">{n}</li>' for n in offer_names[:5])
                offer_section = f'''
                <div style="background: #1a1a2e; border-radius: 8px; padding: 16px; margin: 16px 0; border-left: 4px solid #ff6b35;">
                    <p style="color: #ff6b35; font-weight: bold; margin: 0 0 8px 0;">🎯 Recommended Offers ({len(offer_names)})</p>
                    <ul style="margin: 0; padding-left: 20px;">{items}</ul>
                </div>
                '''

        # Convert newlines in message to <br> for HTML
        html_message = message.replace('\n', '<br>')

        return f'''
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0f0f23; color: #ffffff; padding: 32px; border-radius: 12px;">
            <div style="text-align: center; margin-bottom: 24px;">
                <h1 style="color: #ff6b35; margin: 0;">Moustache Leads</h1>
            </div>
            <p style="font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                {html_message}
            </p>
            {offer_section}
            <div style="text-align: center; margin-top: 24px;">
                <a href="https://moustacheleads.com/publisher/signin" style="display: inline-block; background: #ff6b35; color: #ffffff; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: bold;">
                    Check Offers Now
                </a>
            </div>
            <p style="color: #888; font-size: 12px; text-align: center; margin-top: 32px;">
                Moustache Leads — Performance Marketing Platform
            </p>
        </div>
        '''

    # ── Support Ticket Creation ─────────────────────────────────────────

    def create_support_ticket(self, user_ids, issue_type, priority, note,
                              assign_to='auto', admin_id=None):
        """Create support tickets for reactivation users"""
        results = []
        for uid_str in user_ids:
            try:
                user = self.users_col.find_one({'_id': ObjectId(uid_str)})
                if not user:
                    results.append({'user_id': uid_str, 'status': 'error', 'error': 'User not found'})
                    continue

                ticket = {
                    'user_id': ObjectId(uid_str),
                    'username': user.get('username', ''),
                    'email': user.get('email', ''),
                    'subject': f'Reactivation: {issue_type} — {user.get("username", "")}',
                    'body': note if note else f'[Auto-created by Reactivation Engine]\nUser: {user.get("username", "")} ({user.get("email", "")})\nIssue: {issue_type}\nPriority: {priority}\nAssigned to: {assign_to}',
                    'status': 'open',
                    'replies': [],
                    'created_at': datetime.utcnow(),
                    'updated_at': datetime.utcnow(),
                    'read_by_admin': True,
                    'read_by_user': False,
                    # Reactivation-specific fields
                    'source': 'reactivation',
                    'issue_type': issue_type,
                    'priority': priority,
                    'assigned_to': assign_to,
                    'created_by_admin': admin_id,
                    'is_admin_initiated': True,
                }

                if self.support_col is not None:
                    result = self.support_col.insert_one(ticket)
                    results.append({
                        'user_id': uid_str,
                        'ticket_id': str(result.inserted_id),
                        'status': 'created',
                    })
                else:
                    results.append({'user_id': uid_str, 'status': 'error', 'error': 'Support collection unavailable'})

            except Exception as e:
                logger.error(f"Error creating support ticket for {uid_str}: {e}")
                results.append({'user_id': uid_str, 'status': 'error', 'error': str(e)})

        return results

    # ── S+S Combined Action ─────────────────────────────────────────────

    def execute_sands(self, user_ids, outreach_data, support_data, admin_id=None):
        """Execute Schedule + Support combined action"""
        outreach_results = []
        support_results = []

        if outreach_data:
            outreach_results = self.send_outreach(
                user_ids=user_ids,
                offer_id=outreach_data.get('offer_id'),
                offer_name=outreach_data.get('offer_name'),
                channel=outreach_data.get('channel', 'email'),
                message=outreach_data.get('message', ''),
                subject=outreach_data.get('subject', ''),
                send_time=outreach_data.get('send_time', 'now'),
                scheduled_at=outreach_data.get('scheduled_at'),
                admin_id=admin_id,
            )

        if support_data:
            support_results = self.create_support_ticket(
                user_ids=user_ids,
                issue_type=support_data.get('issue_type', 'Reactivation'),
                priority=support_data.get('priority', 'medium'),
                note=support_data.get('note', ''),
                assign_to=support_data.get('assign_to', 'auto'),
                admin_id=admin_id,
            )

        return {
            'outreach': outreach_results,
            'support': support_results,
        }

    # ── Get Active Offers for Picker ────────────────────────────────────

    def get_offers_for_picker(self, search='', limit=50):
        """Get active offers for the offer picker dropdown"""
        try:
            query = {'status': 'active'}
            if search:
                query['name'] = {'$regex': search, '$options': 'i'}

            offers = list(self.offers_col.find(
                query,
                {'name': 1, 'category': 1, 'payout': 1, 'countries': 1}
            ).limit(limit))

            return [{
                '_id': str(o['_id']),
                'name': o.get('name', ''),
                'category': o.get('category', ''),
                'payout': o.get('payout', 0),
                'countries': o.get('countries', []),
            } for o in offers]

        except Exception as e:
            logger.error(f"Error getting offers for picker: {e}")
            return []

    # ── Recommend Offers for a User ─────────────────────────────────────

    def recommend_offers(self, user_id, limit=20):
        """
        Recommend offers for a user based on their behavior:
        1. Match offers by user's searched keywords / clicked categories
        2. Exclude offers already sent via outreach
        3. Fallback to most popular/requested offers if no behavior data
        """
        try:
            uid_str = str(user_id)

            # Get user's interest signals
            search_keywords = []
            clicked_categories = []

            if self.search_logs_col is not None:
                try:
                    kw_cursor = self.search_logs_col.find(
                        {'user_id': uid_str}, {'keyword': 1}
                    ).sort('timestamp', -1).limit(20)
                    search_keywords = [s.get('keyword', '') for s in kw_cursor if s.get('keyword')]
                except Exception:
                    pass

            if self.clicks_col is not None:
                try:
                    cat_pipeline = [
                        {'$match': {'user_id': uid_str}},
                        {'$group': {'_id': '$offer_category'}},
                    ]
                    clicked_categories = [c['_id'] for c in self.clicks_col.aggregate(cat_pipeline) if c.get('_id')]
                except Exception:
                    pass

            # Get already-sent offer IDs to exclude
            sent_offer_ids = set()
            if self.outreach_col is not None:
                try:
                    sent_docs = self.outreach_col.find(
                        {'user_id': uid_str, 'offer_id': {'$ne': None}},
                        {'offer_id': 1}
                    )
                    sent_offer_ids = {d['offer_id'] for d in sent_docs if d.get('offer_id')}
                except Exception:
                    pass

            # Build offer query based on interests
            offer_query = {'status': 'active'}
            interest_conditions = []

            # Match by search keywords in offer name/description
            for kw in search_keywords[:5]:
                if kw:
                    interest_conditions.append({'name': {'$regex': kw, '$options': 'i'}})

            # Match by clicked categories
            for cat in clicked_categories[:5]:
                if cat:
                    interest_conditions.append({'category': {'$regex': cat, '$options': 'i'}})

            recommended = []

            if interest_conditions:
                # Try interest-based first
                offer_query['$or'] = interest_conditions
                offers = list(self.offers_col.find(
                    offer_query,
                    {'name': 1, 'category': 1, 'payout': 1, 'countries': 1, 'status': 1}
                ).limit(limit * 2))

                for o in offers:
                    oid = str(o['_id'])
                    if oid not in sent_offer_ids:
                        recommended.append({
                            '_id': oid,
                            'name': o.get('name', ''),
                            'category': o.get('category', ''),
                            'payout': o.get('payout', 0),
                            'countries': o.get('countries', []),
                            'match_type': 'interest',
                        })

            # Fallback: most popular active offers
            if len(recommended) < limit:
                remaining = limit - len(recommended)
                seen_ids = {r['_id'] for r in recommended} | sent_offer_ids
                fallback_offers = list(self.offers_col.find(
                    {'status': 'active'},
                    {'name': 1, 'category': 1, 'payout': 1, 'countries': 1}
                ).sort('created_at', -1).limit(remaining + 20))

                for o in fallback_offers:
                    if len(recommended) >= limit:
                        break
                    oid = str(o['_id'])
                    if oid not in seen_ids:
                        recommended.append({
                            '_id': oid,
                            'name': o.get('name', ''),
                            'category': o.get('category', ''),
                            'payout': o.get('payout', 0),
                            'countries': o.get('countries', []),
                            'match_type': 'popular',
                        })
                        seen_ids.add(oid)

            return recommended[:limit]

        except Exception as e:
            logger.error(f"Error recommending offers for {user_id}: {e}")
            return []


# Singleton
_reactivation_service = None

def get_reactivation_service():
    global _reactivation_service
    if _reactivation_service is None:
        _reactivation_service = ReactivationService()
    return _reactivation_service
