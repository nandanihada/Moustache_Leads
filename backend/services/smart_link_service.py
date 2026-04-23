import random
from datetime import datetime, time
from typing import List, Dict, Optional
from database import db_instance
from models.smart_link import ClickLog, SmartLink

class SmartLinkService:
    """Service for smart link offer selection and redirection logic"""

    def __init__(self):
        self.offers_collection = db_instance.get_collection('offers')
        self.click_log = ClickLog()
        self.smart_link_model = SmartLink()

    def select_offer(self, smart_link: Dict, country: str = None, 
                     device_type: str = None, traffic_source: str = None,
                     publisher_id: str = None) -> Optional[Dict]:
        """
        Main entry point for offer selection.
        Implemented as a 3-layer logic:
        1. Filtering: Country, Device, Traffic Type, Adult filter.
        2. Optimization: Rank by EPC (Earnings Per Click) and Conversion Rate.
        3. Rotation: Fallback to Round Robin if no performance data.
        """
        try:
            if not smart_link:
                return None

            # Phase 1: Filter by Eligibility (Geo, Device, etc)
            eligible_offers = self._get_eligible_offers(
                smart_link=smart_link,
                country=country,
                device_type=device_type,
                traffic_source=traffic_source,
                publisher_id=publisher_id
            )

            # 2. INTELLIGENT FALLBACK: If vertical-targetting returned nothing, try BROAD mainstream fallback
            if not eligible_offers and smart_link.get('traffic_type') != 'mainstream':
                print(f"⚠️ Geo-Matching Notice: No {smart_link.get('traffic_type')} offers for {country}. Attempting Mainstream fallback...")
                temp_link = smart_link.copy()
                temp_link['traffic_type'] = 'mainstream'
                eligible_offers = self._get_eligible_offers(
                    smart_link=temp_link,
                    country=country,
                    device_type=device_type,
                    traffic_source=traffic_source,
                    publisher_id=publisher_id
                )

            # 3. ABSOLUTE FALLBACK: Any active public offer for this country
            if not eligible_offers:
                print(f"⚠️ Geo-Matching Notice: No mainstream fallback for {country}. Attempting Absolute Geo fallback...")
                eligible_offers = self._get_eligible_offers(
                    country=country,
                    device_type=device_type,
                    publisher_id=publisher_id
                )

            # 4. WORLDWIDE FALLBACK: Any active public offer targeting WW/ALL
            if not eligible_offers:
                print(f"[WARN] Geo-Matching Notice: No geo-matched fallback for {country}. Attempting Worldwide fallback...")
                eligible_offers = self._get_eligible_offers(
                    country='WW',
                    device_type=device_type,
                    publisher_id=publisher_id
                )

            if not eligible_offers:
                return None

            # Layer 2 & 3: Optimization & Rotation
            effective_strategy = smart_link.get('rotation_strategy') or 'performance'
            smart_link_type = str(smart_link.get('traffic_type', 'mainstream')).lower()

            # For category-specific links or mainstream, default repeated visits to different offers for variety
            if smart_link_type in ['insurance', 'dating', 'free_trial', 'mainstream'] and effective_strategy == 'performance' and len(eligible_offers) > 1:
                print(f"[SMART-LINK] Using round robin for category '{smart_link_type}' to ensure different offers on repeated clicks")
                effective_strategy = 'round_robin'

            if effective_strategy == 'optimization':
                return self._select_optimization_based(eligible_offers, str(smart_link.get('_id')), country)
            elif effective_strategy == 'round_robin':
                return self._select_round_robin(eligible_offers, str(smart_link.get('_id')), country)
            elif effective_strategy == 'weighted':
                return self._select_weighted_random(eligible_offers)
            elif effective_strategy == 'priority':
                return self._select_priority_based(eligible_offers)
            elif effective_strategy == 'random':
                return random.choice(eligible_offers)
            elif effective_strategy == 'performance':
                return self._select_optimization_based(eligible_offers, str(smart_link.get('_id')), country)
            else:
                # Default fallback: try optimization, then round robin
                best = self._select_optimization_based(eligible_offers, str(smart_link.get('_id')), country)
                return best if best else random.choice(eligible_offers)

        except Exception as e:
            print(f"Error selecting offer: {str(e)}")
            return None

    def _get_eligible_offers(self, country: str, device_type: str = None,
                           traffic_source: str = None, smart_link: dict = None,
                           publisher_id: str = None) -> List[Dict]:
        """
        Get offers that match the targeting criteria
        """
        try:
            now = datetime.utcnow()
            
            # 1. Base query: Public offers or Private offers where publisher is authorized
            approved_offer_ids = []
            if publisher_id:
                try:
                    requests_col = db_instance.get_collection('affiliate_requests')
                    # Find all offers where this publisher is explicitly approved
                    approved_docs = list(requests_col.find({'pub_id': publisher_id, 'status': 'approved'}))
                    approved_offer_ids = [doc.get('offer_id') for doc in approved_docs if doc.get('offer_id')]
                except Exception as e:
                    print(f"Error fetching approved offers: {e}")

            query = {
                'status': 'active',
                'is_active': True,
                '$and': [
                    {'$or': [
                        {'approval_status': 'approved'},
                        {'approval_status': 'active'},
                        {'approval_status': {'$exists': False}},
                        {'approval_status': None}
                    ]},
                    {'$or': [
                        {'is_public': True},
                        {'access_type': 'public'},
                        {'offer_id': {'$in': approved_offer_ids}}
                    ]},
                    {'$or': [{'deleted': {'$exists': False}}, {'deleted': False}]}
                ]
            }

            if smart_link and smart_link.get('offer_ids'):
                query['$and'].append({'offer_id': {'$in': smart_link['offer_ids']}})

            # Exclude globally excluded offers from smart links
            query['$and'].append({
                '$or': [{'exclude_from_smart_link': {'$exists': False}}, {'exclude_from_smart_link': False}]
            })

            # Exclude user-specifically excluded offers from smart links
            if publisher_id:
                try:
                    from bson import ObjectId
                    user_doc = db_instance.get_collection('users').find_one({'_id': ObjectId(publisher_id)})
                    if user_doc and user_doc.get('excluded_smart_link_offers'):
                        query['$and'].append({
                            'offer_id': {'$nin': user_doc['excluded_smart_link_offers']}
                        })
                except Exception as e:
                    print(f"Error fetching publisher exclusions: {e}")

            # Country targeting
            if country:
                query['$and'].append(
                    {'$or': [
                        {'countries': country},
                        {'countries': country.lower()},
                        {'allowed_countries': country},
                        {'allowed_countries': country.lower()},
                        {'countries': 'WW'},
                        {'countries': 'ALL'},
                        {'countries': {'$exists': False}},  # Global offers
                        {'countries': []},
                        {'countries': None}
                    ]}
                )

            # Debug log for query - VERY HELPFUL FOR TRACKING FAILURES
            print(f"[SERVICE] [SMART-FILTER] Final Query: {query}")

            # Device targeting
            if device_type:
                query['$and'].append({
                    '$or': [
                        {'device_targeting': {'$exists': False}},
                        {'device_targeting': 'all'},
                        {'device_targeting': None},
                        {'device_targeting': device_type}
                    ]
                })

            # Traffic Type & Adult Filtering
            if smart_link:
                smart_link_type = str(smart_link.get('traffic_type', 'mainstream')).lower()
                allow_adult = smart_link.get('allow_adult', False)
                
                # Global Adult Block (unless explicitly allowed AND vertical is adult)
                if not allow_adult:
                    query['$and'].append({
                        '$or': [
                            {'is_adult': {'$ne': True}},
                            {'vertical': {'$nin': ['ADULT', 'PORN', 'GAMBLING', 'CASINO']}},
                            {'category': {'$nin': ['ADULT', 'PORN', 'GAMBLING', 'CASINO']}},
                            {'tags': {'$nin': ['adult', '18+', 'nsfw', 'porn']}}
                        ]
                    })
                
                # Define mapping for traffic types to potential vertical/category values
                # We use a broad list to ensure maximum offer discovery
                type_config = {
                    'insurance': ['INSURANCE', 'FINANCE', 'LOANS', 'FINANCIAL', 'FINANCE', 'INSURANCE', 'LOAN'],
                    'free_trial': ['FREE_TRIAL', 'TRIAL', 'ECOMMERCE', 'SURVEY', 'SWEEPSTAKES', 'SAMPLES', 'COUPONS'],
                    'dating': ['DATING', 'SOCIAL', 'COMMUNITY', 'CASUAL', 'RELATIONSHIP'],
                    'adult': ['ADULT', 'PORN', 'NSFW', 'CASINO', 'GAMBLING', 'Erotis']
                }

                if smart_link_type == 'mainstream':
                    # Mainstream traffic: exclude restricted/high-risk content
                    exclude_list = ['ADULT', 'PORN', 'GAMBLING', 'CASINO', 'DATING']
                    query['$and'].append({
                        '$and': [
                            {'vertical': {'$nin': exclude_list}},
                            {'category': {'$nin': exclude_list}},
                            {'categories': {'$nin': exclude_list}}
                        ]
                    })
                elif smart_link_type in type_config:
                    # Specific vertical routing: match any related tag
                    match_tags = type_config[smart_link_type]
                    query['$and'].append({
                        '$or': [
                            {'vertical': {'$in': match_tags}},
                            {'category': {'$in': match_tags}},
                            {'categories': {'$in': match_tags}},
                            # Also check for case-insensitive versions if field is vertical
                            {'vertical': {'$regex': f"^{'|'.join(match_tags)}$", '$options': 'i'}},
                            {'category': {'$regex': f"^{'|'.join(match_tags)}$", '$options': 'i'}}
                        ]
                    })

            projection = {
                '_id': 0,
                'offer_id': 1,
                'name': 1,
                'target_url': 1,
                'payout': 1,
                'currency': 1,
                'category': 1,
                'countries': 1,
                'device_targeting': 1,
                'performance_score': 1,
                'rotation_weight': 1,
                'priority': 1,
                'schedule': 1,
                'status': 1,
                'created_at': 1
            }

            # Sort by offer_id to ensure the rotation pointer hits a consistent sequence
            offers = list(self.offers_collection.find(query, projection).sort('offer_id', 1))
            
            # Manual time-based filtering to be more robust
            eligible = []
            for offer in offers:
                schedule = offer.get('schedule', {})
                if schedule:
                    start_at = schedule.get('startAt')
                    end_at = schedule.get('endAt')
                    
                    if start_at:
                        if isinstance(start_at, str):
                            try:
                                start_dt = datetime.fromisoformat(start_at.replace('Z', '+00:00')).replace(tzinfo=None)
                                if now < start_dt: continue
                            except: pass
                        elif isinstance(start_at, datetime):
                            if now < start_at.replace(tzinfo=None): continue
                            
                    if end_at:
                        if isinstance(end_at, str):
                            try:
                                end_dt = datetime.fromisoformat(end_at.replace('Z', '+00:00')).replace(tzinfo=None)
                                if now > end_dt: continue
                            except: pass
                        elif isinstance(end_at, datetime):
                            if now > end_at.replace(tzinfo=None): continue
                
                eligible.append(offer)
                
            return eligible

        except Exception as e:
            print(f"Error getting eligible offers: {str(e)}")
            return []

    def _select_round_robin(self, offers: List[Dict], smart_link_id: str, country: str) -> Optional[Dict]:
        """
        Select offer using stateful round-robin rotation per country (queue-based)
        """
        if not offers:
            return None

        # Sort to ensure consistent order
        sorted_offers = sorted(offers, key=lambda x: x.get('offer_id', ''))
        
        # Get the next pointer for this specific country
        pointer = self.smart_link_model.get_and_increment_pointer(smart_link_id, country or 'global')
        
        # Use modulo to wrap around (the flowchart's pointer)
        index = pointer % len(sorted_offers)
        
        return sorted_offers[index]

    def _select_optimization_based(self, offers: List[Dict], smart_link_id: str, country: str = None) -> Optional[Dict]:
        """
        Rank offers by EPC (Earnings Per Click) and CR (Conversion Rate).
        EPC = total_revenue / total_clicks
        """
        if not offers:
            return None

        offer_ids = [o['offer_id'] for o in offers]
        
        # Calculate performance for each offer
        performance_data = {} # offer_id -> {'epc': float, 'cr': float}
        
        try:
            # Query clicks and conversions to calculate EPC
            # For real-world performance, this should be cached or pre-calculated
            clicks_col = db_instance.get_collection('smart_link_clicks')
            conversions_col = db_instance.get_collection('forwarded_postbacks')
            
            for offer_id in offer_ids:
                click_count = clicks_col.count_documents({'offer_id': offer_id})
                if click_count == 0:
                    performance_data[offer_id] = {'epc': 0, 'cr': 0}
                    continue
                
                # Fetch conversions (revenue)
                conversions = list(conversions_col.find({'offer_id': offer_id}))
                revenue = sum(float(c.get('revenue', 0) or 0) for c in conversions)
                conv_count = len(conversions)
                
                epc = revenue / click_count
                cr = conv_count / click_count
                performance_data[offer_id] = {'epc': epc, 'cr': cr}
        except Exception as e:
            print(f"Error calculating optimization data: {e}")

        # Rank offers by EPC (primary) then CR (secondary)
        # For ties (e.g. all 0), we use a round-robin pointer to ensure variety
        
        # 1. Group by performance tiers
        def get_score(o):
            perf = performance_data.get(o['offer_id'], {})
            return (perf.get('epc', 0), perf.get('cr', 0))
            
        # 2. Get the top tier (highest EPC/CR)
        max_score = (0, 0)
        top_candidates = []
        
        # Sort offers by score descending
        sorted_by_perf = sorted(offers, key=get_score, reverse=True)
        if sorted_by_perf:
            max_score = get_score(sorted_by_perf[0])
            top_candidates = [o for o in offers if get_score(o) == max_score]
            
        # 3. Variety injection: We don't just pick the #1 best, we rotate among the top 10
        # to ensure the link doesn't look "stuck" and to give all top offers a chance.
        top_N = sorted_by_perf[:10]
        if len(top_N) > 1:
            # We use the rotation pointer on the top tier to ensure variety on every click
            return self._select_round_robin(top_N, smart_link_id, country)
            
        # 4. Otherwise returning the single best (if only 1 offer total exists)
        return sorted_by_perf[0] if sorted_by_perf else None

    def log_click(self, smart_link_id: str, offer_id: str = None, 
                 country: str = None, ip: str = None, user_agent: str = None,
                 publisher_id: str = None, offer_name: str = None, 
                 offer_status: str = None, session_id: str = None,
                 device: str = None) -> Optional[str]:
        """
        Log a click for analytics and return click_id
        """
        try:
            click_data, error = self.click_log.log_click(
                smart_link_id=smart_link_id,
                offer_id=offer_id,
                country=country,
                ip=ip,
                user_agent=user_agent,
                publisher_id=publisher_id,
                device=device,
                offer_name=offer_name,
                offer_status=offer_status,
                session_id=session_id,
                timestamp=datetime.utcnow()
            )
            return click_data.get('click_id') if click_data else None
        except Exception as e:
            print(f"Error logging click: {str(e)}")
            return False

    def get_analytics(self, smart_link_id: str = None, start_date: datetime = None,
                     end_date: datetime = None, country: str = None) -> Dict:
        """
        Get comprehensive analytics for smart links
        """
        try:
            clicks_data = self.click_log.get_clicks_analytics(
                smart_link_id=smart_link_id,
                start_date=start_date,
                end_date=end_date,
                country=country
            )

            offer_distribution = self.click_log.get_offer_distribution(
                smart_link_id=smart_link_id,
                start_date=start_date,
                end_date=end_date
            )

            # Country distribution for charts
            country_distribution = self.click_log.get_country_distribution(
                smart_link_id=smart_link_id,
                start_date=start_date,
                end_date=end_date
            )

            # Revenue calculation
            conversions_col = db_instance.get_collection('forwarded_postbacks')
            query = {}
            if smart_link_id:
                query['smart_link_id'] = smart_link_id
            if country:
                query['country'] = country
            if start_date or end_date:
                query['timestamp'] = {}
                if start_date: query['timestamp']['$gte'] = start_date
                if end_date: query['timestamp']['$lte'] = end_date
                
            conversions = list(conversions_col.find(query))
            total_revenue = sum(float(c.get('revenue', 0)) for c in conversions)
            total_clicks = sum(item.get('clicks', 0) for item in clicks_data)

            return {
                'clicks_analytics': clicks_data,
                'offer_distribution': offer_distribution,
                'country_distribution': country_distribution,
                'total_clicks': total_clicks,
                'unique_visitors': sum(item.get('unique_visitors', 0) for item in clicks_data),
                'total_revenue': total_revenue,
                'epc': total_revenue / total_clicks if total_clicks > 0 else 0
            }

        except Exception as e:
            print(f"Error getting analytics: {str(e)}")
            return {
                'clicks_analytics': [],
                'offer_distribution': [],
                'country_distribution': [],
                'total_clicks': 0,
                'unique_visitors': 0
            }
