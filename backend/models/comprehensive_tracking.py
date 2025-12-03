"""
Comprehensive Offerwall Tracking Model
Tracks every single detail about offerwall interactions
"""
import uuid
import datetime
import hashlib
import json
from typing import Dict, List, Optional, Tuple
from bson import ObjectId
import logging

logger = logging.getLogger(__name__)


class ComprehensiveOfferwallTracker:
    """
    Complete tracking system for offerwall with all details:
    - User/Publisher/Offer identifiers
    - Device fingerprinting
    - IP/ASN/VPN detection
    - Geo-location
    - Complete event tracking (impression → click → conversion)
    - Fraud detection
    - Payout tracking
    - Revenue calculations
    """
    
    def __init__(self, db_instance):
        self.db = db_instance
        self.sessions_col = db_instance.get_collection('offerwall_sessions_detailed')
        self.impressions_col = db_instance.get_collection('offerwall_impressions_detailed')
        self.clicks_col = db_instance.get_collection('offerwall_clicks_detailed')
        self.conversions_col = db_instance.get_collection('offerwall_conversions_detailed')
        self.fraud_signals_col = db_instance.get_collection('offerwall_fraud_signals')
        self.user_points_col = db_instance.get_collection('user_points')
        self.publisher_earnings_col = db_instance.get_collection('publisher_earnings')
        self.network_payouts_col = db_instance.get_collection('network_payouts')
        self.analytics_cache_col = db_instance.get_collection('offerwall_analytics_cache')
        
    # ============================================================================
    # SESSION TRACKING
    # ============================================================================
    
    def create_session(self, session_data: Dict) -> Tuple[str, Optional[str]]:
        """Create comprehensive session record"""
        try:
            session_id = str(uuid.uuid4())
            
            session_doc = {
                'session_id': session_id,
                'timestamp': datetime.datetime.utcnow(),
                
                # IDENTIFIERS
                'user_id': session_data.get('user_id'),
                'placement_id': session_data.get('placement_id'),
                'publisher_id': session_data.get('publisher_id'),
                'sub_id': session_data.get('sub_id'),
                
                # DEVICE INFO
                'device': {
                    'type': session_data.get('device_type'),  # mobile, desktop, tablet
                    'model': session_data.get('device_model'),
                    'os': session_data.get('os'),
                    'os_version': session_data.get('os_version'),
                    'browser': session_data.get('browser'),
                    'browser_version': session_data.get('browser_version'),
                    'screen_resolution': session_data.get('screen_resolution'),
                    'screen_dpi': session_data.get('screen_dpi'),
                    'timezone': session_data.get('timezone'),
                    'language': session_data.get('language'),
                },
                
                # DEVICE FINGERPRINT
                'fingerprint': {
                    'user_agent': session_data.get('user_agent'),
                    'user_agent_hash': hashlib.sha256(
                        (session_data.get('user_agent') or '').encode()
                    ).hexdigest(),
                    'canvas_fingerprint': session_data.get('canvas_fingerprint'),
                    'webgl_fingerprint': session_data.get('webgl_fingerprint'),
                    'fonts_fingerprint': session_data.get('fonts_fingerprint'),
                    'plugins_fingerprint': session_data.get('plugins_fingerprint'),
                },
                
                # NETWORK INFO
                'network': {
                    'ip_address': session_data.get('ip_address'),
                    'ip_version': session_data.get('ip_version'),  # IPv4 or IPv6
                    'asn': session_data.get('asn'),
                    'isp': session_data.get('isp'),
                    'organization': session_data.get('organization'),
                    'proxy_detected': session_data.get('proxy_detected', False),
                    'vpn_detected': session_data.get('vpn_detected', False),
                    'tor_detected': session_data.get('tor_detected', False),
                    'datacenter_detected': session_data.get('datacenter_detected', False),
                    'connection_type': session_data.get('connection_type'),  # wifi, mobile, fixed
                },
                
                # GEO INFO
                'geo': {
                    'country': session_data.get('country'),
                    'country_code': session_data.get('country_code'),
                    'region': session_data.get('region'),
                    'city': session_data.get('city'),
                    'postal_code': session_data.get('postal_code'),
                    'latitude': session_data.get('latitude'),
                    'longitude': session_data.get('longitude'),
                    'timezone': session_data.get('timezone'),
                    'is_vpn_country': session_data.get('is_vpn_country', False),
                },
                
                # SESSION METRICS
                'metrics': {
                    'impressions': 0,
                    'clicks': 0,
                    'conversions': 0,
                    'total_time_spent': 0,  # seconds
                    'pages_viewed': 0,
                },
                
                # REFERRER INFO
                'referrer': {
                    'url': session_data.get('referrer_url'),
                    'domain': session_data.get('referrer_domain'),
                    'type': session_data.get('referrer_type'),  # direct, organic, referral, paid
                },
                
                # STATUS
                'status': 'active',
                'ended_at': None,
            }
            
            self.sessions_col.insert_one(session_doc)
            logger.info(f"✅ Session created: {session_id}")
            return session_id, None
            
        except Exception as e:
            logger.error(f"❌ Error creating session: {e}")
            return None, str(e)
    
    # ============================================================================
    # IMPRESSION TRACKING
    # ============================================================================
    
    def track_impression(self, impression_data: Dict) -> Tuple[str, Optional[str]]:
        """Track offer impression with all details"""
        try:
            impression_id = str(uuid.uuid4())
            
            impression_doc = {
                'impression_id': impression_id,
                'timestamp': datetime.datetime.utcnow(),
                
                # IDENTIFIERS
                'session_id': impression_data.get('session_id'),
                'user_id': impression_data.get('user_id'),
                'offer_id': impression_data.get('offer_id'),
                'offer_name': impression_data.get('offer_name'),
                'placement_id': impression_data.get('placement_id'),
                'publisher_id': impression_data.get('publisher_id'),
                
                # OFFER DETAILS
                'offer': {
                    'category': impression_data.get('offer_category'),
                    'payout': impression_data.get('offer_payout'),
                    'network': impression_data.get('offer_network'),
                    'advertiser_id': impression_data.get('advertiser_id'),
                },
                
                # DEVICE/GEO (from session)
                'device_type': impression_data.get('device_type'),
                'country': impression_data.get('country'),
                'ip_address': impression_data.get('ip_address'),
                
                # IMPRESSION CONTEXT
                'position': impression_data.get('position'),  # position in list
                'view_duration': impression_data.get('view_duration'),  # ms
                'visible': impression_data.get('visible', True),  # was it visible?
                'viewable': impression_data.get('viewable', True),  # meets IAB standards?
                
                # STATUS
                'status': 'recorded',
            }
            
            self.impressions_col.insert_one(impression_doc)
            
            # Update session metrics
            self.sessions_col.update_one(
                {'session_id': impression_data.get('session_id')},
                {'$inc': {'metrics.impressions': 1}}
            )
            
            logger.info(f"✅ Impression tracked: {impression_id}")
            return impression_id, None
            
        except Exception as e:
            logger.error(f"❌ Error tracking impression: {e}")
            return None, str(e)
    
    # ============================================================================
    # CLICK TRACKING
    # ============================================================================
    
    def track_click(self, click_data: Dict) -> Tuple[str, Optional[str]]:
        """Track offer click with all details"""
        try:
            click_id = str(uuid.uuid4())
            
            click_doc = {
                'click_id': click_id,
                'timestamp': datetime.datetime.utcnow(),
                'created_at': datetime.datetime.utcnow(),
                
                # IDENTIFIERS
                'session_id': click_data.get('session_id'),
                'user_id': click_data.get('user_id'),
                'offer_id': click_data.get('offer_id'),
                'offer_name': click_data.get('offer_name'),
                'placement_id': click_data.get('placement_id'),
                'publisher_id': click_data.get('publisher_id'),
                'publisher_name': click_data.get('publisher_name', 'Unknown'),
                
                # OFFER DETAILS
                'offer': {
                    'category': click_data.get('offer_category'),
                    'payout': click_data.get('offer_payout'),
                    'network': click_data.get('offer_network'),
                    'advertiser_id': click_data.get('advertiser_id'),
                    'tracking_url': click_data.get('tracking_url'),
                },
                
                # DEVICE/GEO/FINGERPRINT
                'device': {
                    'type': click_data.get('device_type'),
                    'browser': click_data.get('browser'),
                    'os': click_data.get('os'),
                },
                'geo': {
                    'country': click_data.get('country', 'Unknown'),
                    'region': click_data.get('region', 'Unknown'),
                    'city': click_data.get('city', 'Unknown'),
                    'postal_code': click_data.get('postal_code', 'Unknown'),
                    'latitude': click_data.get('latitude'),
                    'longitude': click_data.get('longitude'),
                    'ip_address': click_data.get('ip_address'),
                    'isp': click_data.get('isp', 'Unknown'),
                    'asn': click_data.get('asn', 'Unknown'),
                    'organization': click_data.get('organization', 'Unknown'),
                },
                'fingerprint': {
                    'user_agent': click_data.get('user_agent'),
                    'user_agent_hash': hashlib.sha256(
                        (click_data.get('user_agent') or '').encode()
                    ).hexdigest(),
                },
                
                # CLICK CONTEXT
                'click_context': {
                    'position': click_data.get('position'),
                    'time_to_click': click_data.get('time_to_click'),  # ms from impression
                    'mouse_movement': click_data.get('mouse_movement'),  # pixels moved
                    'click_velocity': click_data.get('click_velocity'),  # pixels/ms
                },
                
                # REDIRECT INFO
                'redirect': {
                    'url': click_data.get('redirect_url'),
                    'status_code': None,
                    'timestamp': None,
                    'redirect_chain': [],
                },
                
                # FRAUD INDICATORS
                'fraud_indicators': {
                    'duplicate_click': click_data.get('duplicate_click', False),
                    'fast_click': click_data.get('fast_click', False),
                    'bot_like': click_data.get('bot_like', False),
                    'vpn_detected': click_data.get('vpn_detected', False),
                    'proxy_detected': click_data.get('proxy_detected', False),
                    'tor_detected': click_data.get('tor_detected', False),
                    'hosting_detected': click_data.get('hosting_detected', False),
                    'fraud_score': click_data.get('fraud_score', 0),
                    'fraud_status': click_data.get('fraud_status', 'Unknown'),
                },
                
                # STATUS
                'status': 'clicked',
            }
            
            self.clicks_col.insert_one(click_doc)
            
            # Update session metrics
            self.sessions_col.update_one(
                {'session_id': click_data.get('session_id')},
                {'$inc': {'metrics.clicks': 1}}
            )
            
            logger.info(f"✅ Click tracked: {click_id}")
            return click_id, None
            
        except Exception as e:
            logger.error(f"❌ Error tracking click: {e}")
            return None, str(e)
    
    # ============================================================================
    # CONVERSION TRACKING
    # ============================================================================
    
    def track_conversion(self, conversion_data: Dict) -> Tuple[str, Optional[str]]:
        """Track offer conversion with all details and payout info"""
        try:
            conversion_id = str(uuid.uuid4())
            
            # Calculate time to convert
            click = self.clicks_col.find_one({'click_id': conversion_data.get('click_id')})
            time_to_convert = None
            if click:
                time_to_convert = (
                    datetime.datetime.utcnow() - click['timestamp']
                ).total_seconds()
            
            conversion_doc = {
                'conversion_id': conversion_id,
                'timestamp': datetime.datetime.utcnow(),
                
                # IDENTIFIERS
                'session_id': conversion_data.get('session_id'),
                'click_id': conversion_data.get('click_id'),
                'user_id': conversion_data.get('user_id'),
                'offer_id': conversion_data.get('offer_id'),
                'offer_name': conversion_data.get('offer_name'),
                'placement_id': conversion_data.get('placement_id'),
                'publisher_id': conversion_data.get('publisher_id'),
                
                # OFFER DETAILS
                'offer': {
                    'category': conversion_data.get('offer_category'),
                    'network': conversion_data.get('offer_network'),
                    'advertiser_id': conversion_data.get('advertiser_id'),
                },
                
                # DEVICE/GEO
                'device': {
                    'type': conversion_data.get('device_type'),
                    'browser': conversion_data.get('browser'),
                    'os': conversion_data.get('os'),
                },
                'geo': {
                    'country': conversion_data.get('country'),
                    'ip_address': conversion_data.get('ip_address'),
                },
                
                # CONVERSION TIMING
                'timing': {
                    'time_to_convert': time_to_convert,  # seconds from click
                    'session_duration': conversion_data.get('session_duration'),
                },
                
                # PAYOUT INFO
                'payout': {
                    'network_payout': float(conversion_data.get('network_payout', 0)),
                    'user_reward': float(conversion_data.get('user_reward', 0)),
                    'publisher_commission': float(conversion_data.get('publisher_commission', 0)),
                    'platform_revenue': float(conversion_data.get('platform_revenue', 0)),
                    'currency': conversion_data.get('currency', 'USD'),
                },
                
                # POSTBACK DATA
                'postback': {
                    'transaction_id': conversion_data.get('transaction_id'),
                    'postback_url': conversion_data.get('postback_url'),
                    'postback_data': conversion_data.get('postback_data', {}),
                    'postback_timestamp': None,
                    'postback_status': 'pending',
                },
                
                # FRAUD INDICATORS
                'fraud_indicators': {
                    'duplicate_conversion': False,
                    'fast_conversion': False,
                    'suspicious_pattern': False,
                    'vpn_detected': conversion_data.get('vpn_detected', False),
                },
                
                # STATUS
                'status': 'pending',  # pending, approved, rejected, fraud
            }
            
            self.conversions_col.insert_one(conversion_doc)
            
            # Update session metrics
            self.sessions_col.update_one(
                {'session_id': conversion_data.get('session_id')},
                {'$inc': {'metrics.conversions': 1}}
            )
            
            # Award user points
            self._award_user_points(
                user_id=conversion_data.get('user_id'),
                points=int(conversion_data.get('user_reward', 0) * 100),
                offer_id=conversion_data.get('offer_id'),
                conversion_id=conversion_id
            )
            
            # Record publisher earnings
            self._record_publisher_earnings(
                publisher_id=conversion_data.get('publisher_id'),
                placement_id=conversion_data.get('placement_id'),
                offer_id=conversion_data.get('offer_id'),
                earnings=float(conversion_data.get('publisher_commission', 0)),
                conversion_id=conversion_id
            )
            
            # Record network payout
            self._record_network_payout(
                offer_id=conversion_data.get('offer_id'),
                network=conversion_data.get('offer_network'),
                payout=float(conversion_data.get('network_payout', 0)),
                conversion_id=conversion_id
            )
            
            logger.info(f"✅ Conversion tracked: {conversion_id}")
            return conversion_id, None
            
        except Exception as e:
            logger.error(f"❌ Error tracking conversion: {e}")
            return None, str(e)
    
    # ============================================================================
    # PAYOUT TRACKING
    # ============================================================================
    
    def _award_user_points(self, user_id: str, points: int, offer_id: str, conversion_id: str):
        """Award points to user"""
        try:
            self.user_points_col.update_one(
                {'user_id': user_id},
                {
                    '$inc': {
                        'total_points': points,
                        'available_points': points,
                    },
                    '$push': {
                        'transactions': {
                            'timestamp': datetime.datetime.utcnow(),
                            'type': 'conversion_reward',
                            'offer_id': offer_id,
                            'conversion_id': conversion_id,
                            'points': points,
                            'status': 'completed',
                        }
                    }
                },
                upsert=True
            )
            logger.info(f"✅ Awarded {points} points to user {user_id}")
        except Exception as e:
            logger.error(f"❌ Error awarding points: {e}")
    
    def _record_publisher_earnings(self, publisher_id: str, placement_id: str, 
                                   offer_id: str, earnings: float, conversion_id: str):
        """Record publisher earnings"""
        try:
            self.publisher_earnings_col.insert_one({
                'timestamp': datetime.datetime.utcnow(),
                'publisher_id': publisher_id,
                'placement_id': placement_id,
                'offer_id': offer_id,
                'conversion_id': conversion_id,
                'earnings': earnings,
                'currency': 'USD',
                'status': 'pending',  # pending, approved, paid
            })
            logger.info(f"✅ Recorded ${earnings} earnings for publisher {publisher_id}")
        except Exception as e:
            logger.error(f"❌ Error recording publisher earnings: {e}")
    
    def _record_network_payout(self, offer_id: str, network: str, payout: float, conversion_id: str):
        """Record network payout"""
        try:
            self.network_payouts_col.insert_one({
                'timestamp': datetime.datetime.utcnow(),
                'offer_id': offer_id,
                'network': network,
                'conversion_id': conversion_id,
                'payout': payout,
                'currency': 'USD',
                'status': 'pending',  # pending, approved, paid
            })
            logger.info(f"✅ Recorded ${payout} payout from network {network}")
        except Exception as e:
            logger.error(f"❌ Error recording network payout: {e}")
    
    # ============================================================================
    # FRAUD DETECTION
    # ============================================================================
    
    def detect_fraud(self, event_data: Dict) -> List[Dict]:
        """Detect fraud indicators"""
        fraud_signals = []
        
        # Check for duplicate clicks
        if event_data.get('event_type') == 'click':
            existing_click = self.clicks_col.find_one({
                'user_id': event_data.get('user_id'),
                'offer_id': event_data.get('offer_id'),
                'timestamp': {
                    '$gte': datetime.datetime.utcnow() - datetime.timedelta(hours=1)
                }
            })
            if existing_click:
                fraud_signals.append({
                    'type': 'duplicate_click',
                    'severity': 'high',
                    'user_id': event_data.get('user_id'),
                    'offer_id': event_data.get('offer_id'),
                })
        
        # Check for VPN/Proxy
        if event_data.get('vpn_detected') or event_data.get('proxy_detected'):
            fraud_signals.append({
                'type': 'vpn_proxy_detected',
                'severity': 'medium',
                'user_id': event_data.get('user_id'),
                'ip_address': event_data.get('ip_address'),
            })
        
        # Check for bot-like behavior
        if event_data.get('time_to_click', 0) < 500:  # Less than 500ms
            fraud_signals.append({
                'type': 'fast_click',
                'severity': 'high',
                'user_id': event_data.get('user_id'),
                'time_to_click': event_data.get('time_to_click'),
            })
        
        # Record fraud signals
        for signal in fraud_signals:
            signal['timestamp'] = datetime.datetime.utcnow()
            self.fraud_signals_col.insert_one(signal)
        
        return fraud_signals
    
    # ============================================================================
    # ANALYTICS AGGREGATION
    # ============================================================================
    
    def get_comprehensive_analytics(self, filters: Dict = None) -> Dict:
        """Get comprehensive analytics with all details"""
        try:
            filters = filters or {}
            
            # Build match stage
            match_stage = {}
            if filters.get('placement_id'):
                match_stage['placement_id'] = filters['placement_id']
            if filters.get('publisher_id'):
                match_stage['publisher_id'] = filters['publisher_id']
            if filters.get('user_id'):
                match_stage['user_id'] = filters['user_id']
            if filters.get('offer_id'):
                match_stage['offer_id'] = filters['offer_id']
            
            # Get impressions
            impressions = self.impressions_col.count_documents(match_stage)
            
            # Get clicks
            clicks = self.clicks_col.count_documents(match_stage)
            
            # Get conversions
            conversions = self.conversions_col.count_documents(match_stage)
            
            # Get payout totals
            payout_pipeline = [
                {'$match': match_stage},
                {'$group': {
                    '_id': None,
                    'total_network_payout': {'$sum': '$payout.network_payout'},
                    'total_user_reward': {'$sum': '$payout.user_reward'},
                    'total_publisher_commission': {'$sum': '$payout.publisher_commission'},
                    'total_platform_revenue': {'$sum': '$payout.platform_revenue'},
                }}
            ]
            payout_data = list(self.conversions_col.aggregate(payout_pipeline))
            payout_totals = payout_data[0] if payout_data else {}
            
            # Calculate metrics
            ctr = (clicks / impressions * 100) if impressions > 0 else 0
            cvr = (conversions / clicks * 100) if clicks > 0 else 0
            epc = (payout_totals.get('total_network_payout', 0) / clicks) if clicks > 0 else 0
            
            # Get fraud signals
            fraud_signals = self.fraud_signals_col.count_documents(match_stage)
            
            analytics = {
                'impressions': impressions,
                'clicks': clicks,
                'conversions': conversions,
                'ctr': round(ctr, 2),
                'cvr': round(cvr, 2),
                'epc': round(epc, 2),
                'fraud_signals': fraud_signals,
                'payouts': {
                    'network_payout': round(payout_totals.get('total_network_payout', 0), 2),
                    'user_reward': round(payout_totals.get('total_user_reward', 0), 2),
                    'publisher_commission': round(payout_totals.get('total_publisher_commission', 0), 2),
                    'platform_revenue': round(payout_totals.get('total_platform_revenue', 0), 2),
                },
            }
            
            return analytics
            
        except Exception as e:
            logger.error(f"❌ Error getting analytics: {e}")
            return {}
    
    def get_detailed_report(self, report_type: str, filters: Dict = None) -> List[Dict]:
        """Get detailed reports by type"""
        try:
            filters = filters or {}
            
            if report_type == 'by_user':
                return self._report_by_user(filters)
            elif report_type == 'by_publisher':
                return self._report_by_publisher(filters)
            elif report_type == 'by_offer':
                return self._report_by_offer(filters)
            elif report_type == 'by_country':
                return self._report_by_country(filters)
            elif report_type == 'by_device':
                return self._report_by_device(filters)
            elif report_type == 'fraud':
                return self._report_fraud(filters)
            else:
                return []
                
        except Exception as e:
            logger.error(f"❌ Error generating report: {e}")
            return []
    
    def _report_by_user(self, filters: Dict) -> List[Dict]:
        """Report grouped by user"""
        pipeline = [
            {'$group': {
                '_id': '$user_id',
                'impressions': {'$sum': 1},
                'clicks': {'$sum': 1},
                'conversions': {'$sum': 1},
                'total_reward': {'$sum': '$payout.user_reward'},
                'countries': {'$addToSet': '$geo.country'},
                'devices': {'$addToSet': '$device.type'},
            }},
            {'$sort': {'total_reward': -1}},
            {'$limit': 100}
        ]
        return list(self.conversions_col.aggregate(pipeline))
    
    def _report_by_publisher(self, filters: Dict) -> List[Dict]:
        """Report grouped by publisher"""
        pipeline = [
            {'$group': {
                '_id': '$publisher_id',
                'placements': {'$addToSet': '$placement_id'},
                'impressions': {'$sum': 1},
                'clicks': {'$sum': 1},
                'conversions': {'$sum': 1},
                'total_commission': {'$sum': '$payout.publisher_commission'},
                'total_revenue': {'$sum': '$payout.platform_revenue'},
            }},
            {'$sort': {'total_commission': -1}},
            {'$limit': 100}
        ]
        return list(self.conversions_col.aggregate(pipeline))
    
    def _report_by_offer(self, filters: Dict) -> List[Dict]:
        """Report grouped by offer"""
        pipeline = [
            {'$group': {
                '_id': '$offer_id',
                'offer_name': {'$first': '$offer_name'},
                'network': {'$first': '$offer.network'},
                'impressions': {'$sum': 1},
                'clicks': {'$sum': 1},
                'conversions': {'$sum': 1},
                'total_payout': {'$sum': '$payout.network_payout'},
                'avg_payout': {'$avg': '$payout.network_payout'},
            }},
            {'$sort': {'conversions': -1}},
            {'$limit': 100}
        ]
        return list(self.conversions_col.aggregate(pipeline))
    
    def _report_by_country(self, filters: Dict) -> List[Dict]:
        """Report grouped by country"""
        pipeline = [
            {'$group': {
                '_id': '$geo.country',
                'impressions': {'$sum': 1},
                'clicks': {'$sum': 1},
                'conversions': {'$sum': 1},
                'total_revenue': {'$sum': '$payout.platform_revenue'},
            }},
            {'$sort': {'conversions': -1}},
            {'$limit': 50}
        ]
        return list(self.conversions_col.aggregate(pipeline))
    
    def _report_by_device(self, filters: Dict) -> List[Dict]:
        """Report grouped by device"""
        pipeline = [
            {'$group': {
                '_id': '$device.type',
                'impressions': {'$sum': 1},
                'clicks': {'$sum': 1},
                'conversions': {'$sum': 1},
                'ctr': {'$avg': {'$cond': [{'$gt': ['$clicks', 0]}, 1, 0]}},
                'cvr': {'$avg': {'$cond': [{'$gt': ['$conversions', 0]}, 1, 0]}},
            }},
            {'$sort': {'conversions': -1}}
        ]
        return list(self.conversions_col.aggregate(pipeline))
    
    def _report_fraud(self, filters: Dict) -> List[Dict]:
        """Report fraud signals"""
        pipeline = [
            {'$group': {
                '_id': '$type',
                'count': {'$sum': 1},
                'users_affected': {'$addToSet': '$user_id'},
                'severity': {'$first': '$severity'},
            }},
            {'$sort': {'count': -1}}
        ]
        return list(self.fraud_signals_col.aggregate(pipeline))
