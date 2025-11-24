import uuid
import hashlib
import hmac
from datetime import datetime, timedelta
from database import db_instance
import logging
import requests
from urllib.parse import urlparse, parse_qs, urlencode, urlunparse
import json
from threading import Thread
import time
from models.tracking_events import TrackingEvents
from services.bonus_calculation_service import BonusCalculationService

class TrackingService:
    """Service to handle offer tracking, clicks, and postbacks"""
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self.offers_collection = db_instance.get_collection('offers')
        self.clicks_collection = db_instance.get_collection('clicks')
        self.conversions_collection = db_instance.get_collection('conversions')
        self.postback_queue_collection = db_instance.get_collection('postback_queue')
        self.postback_logs_collection = db_instance.get_collection('postback_logs')
        self.partners_collection = db_instance.get_collection('partners')
        self.tracking_events = TrackingEvents()
        self.bonus_service = BonusCalculationService()  # Initialize bonus calculation
    
    def generate_tracking_link(self, offer_id, affiliate_id, sub_ids=None):
        """
        Generate tracking link for an offer
        
        Args:
            offer_id: Offer ID
            affiliate_id: Affiliate user ID
            sub_ids: Optional sub IDs for tracking
        
        Returns:
            dict: Tracking link information
        """
        try:
            # Get offer
            offer = self.offers_collection.find_one({
                'offer_id': offer_id, 
                'status': {'$in': ['Active', 'active']}
            })
            if not offer:
                return {'error': f'Offer {offer_id} not found or not active'}
            
            # Generate unique click ID
            click_id = str(uuid.uuid4())
            
            # Generate hash for security
            hash_data = f"{offer_id}:{affiliate_id}:{click_id}"
            if offer.get('hash_code'):
                hash_data += f":{offer['hash_code']}"
            
            tracking_hash = hashlib.md5(hash_data.encode()).hexdigest()
            
            # Create tracking URL
            base_url = "https://moustacheleads-backend.onrender.com"  # Live backend URL
            tracking_url = f"{base_url}/track/click/{click_id}"
            
            # Add parameters
            params = {
                'offer_id': offer_id,
                'aff_id': affiliate_id,
                'hash': tracking_hash
            }
            
            # Add sub IDs if provided
            if sub_ids:
                for i, sub_id in enumerate(sub_ids[:5], 1):  # Max 5 sub IDs
                    if sub_id:
                        params[f'sub{i}'] = sub_id
            
            # Build final URL
            parsed_url = urlparse(tracking_url)
            query_params = urlencode(params)
            final_url = urlunparse((
                parsed_url.scheme,
                parsed_url.netloc,
                parsed_url.path,
                parsed_url.params,
                query_params,
                parsed_url.fragment
            ))
            
            return {
                'tracking_url': final_url,
                'click_id': click_id,
                'offer_id': offer_id,
                'affiliate_id': affiliate_id,
                'hash': tracking_hash,
                'expires_at': datetime.utcnow() + timedelta(days=offer.get('click_expiration', 7))
            }
            
        except Exception as e:
            self.logger.error(f"Error generating tracking link: {str(e)}")
            return {'error': str(e)}
    
    def record_click(self, click_id, request_info):
        """
        Record a click and redirect to offer
        
        Args:
            click_id: Unique click ID
            request_info: Request information (IP, user agent, etc.)
        
        Returns:
            dict: Click record and redirect URL
        """
        try:
            # Validate click parameters
            offer_id = request_info.get('offer_id')
            affiliate_id = request_info.get('aff_id')
            provided_hash = request_info.get('hash')
            
            self.logger.info(f"🔍 Validating parameters: offer_id={offer_id}, aff_id={affiliate_id}, hash={provided_hash}")
            
            missing_params = []
            if not offer_id:
                missing_params.append('offer_id')
            if not affiliate_id:
                missing_params.append('aff_id')
            if not provided_hash:
                missing_params.append('hash')
            
            if missing_params:
                return {'error': f'Missing required parameters: {", ".join(missing_params)}'}
            
            # Get offer
            offer = self.offers_collection.find_one({
                'offer_id': offer_id, 
                'status': {'$in': ['Active', 'active']}
            })
            if not offer:
                return {'error': f'Offer {offer_id} not found or inactive'}
            
            # Verify hash
            hash_data = f"{offer_id}:{affiliate_id}:{click_id}"
            if offer.get('hash_code'):
                hash_data += f":{offer['hash_code']}"
            
            expected_hash = hashlib.md5(hash_data.encode()).hexdigest()
            
            if provided_hash != expected_hash:
                return {'error': 'Invalid tracking hash'}
            
            # Check if click already exists (prevent duplicates)
            existing_click = self.clicks_collection.find_one({'click_id': click_id})
            if existing_click:
                return {
                    'redirect_url': offer['target_url'],
                    'click_id': click_id,
                    'duplicate': True
                }
            
            # Check click expiration
            click_expiration = offer.get('click_expiration', 7)
            # For now, we'll assume all clicks are valid (implement expiration logic as needed)
            
            # Record click
            click_doc = {
                'click_id': click_id,
                'offer_id': offer_id,
                'affiliate_id': affiliate_id,
                'ip_address': request_info.get('ip_address'),
                'user_agent': request_info.get('user_agent'),
                'country': request_info.get('country'),
                'referer': request_info.get('referer'),
                'sub_ids': {
                    'sub1': request_info.get('sub1'),
                    'sub2': request_info.get('sub2'),
                    'sub3': request_info.get('sub3'),
                    'sub4': request_info.get('sub4'),
                    'sub5': request_info.get('sub5')
                },
                'click_time': datetime.utcnow(),
                'conversion_window_expires': datetime.utcnow() + timedelta(days=offer.get('conversion_window', 30)),
                'status': 'clicked',
                'created_at': datetime.utcnow()
            }
            
            # Insert click record
            result = self.clicks_collection.insert_one(click_doc)
            click_doc['_id'] = str(result.inserted_id)
            
            # Log tracking event
            self.tracking_events.log_click_event(
                offer_id=offer_id,
                user_id=affiliate_id,
                click_id=click_id,
                ip_address=request_info.get('ip_address'),
                user_agent=request_info.get('user_agent'),
                country=request_info.get('country'),
                referer=request_info.get('referer')
            )
            
            # Increment offer hits
            self.offers_collection.update_one(
                {'offer_id': offer_id},
                {'$inc': {'hits': 1}}
            )
            
            return {
                'redirect_url': offer['target_url'],
                'click_id': click_id,
                'click_record': click_doc
            }
            
        except Exception as e:
            self.logger.error(f"Error recording click: {str(e)}")
            return {'error': str(e)}
    
    def record_conversion(self, conversion_data):
        """
        Record a conversion from postback
        
        Args:
            conversion_data: Conversion information
        
        Returns:
            dict: Conversion record
        """
        try:
            click_id = conversion_data.get('click_id')
            if not click_id:
                return {'error': 'Click ID required'}
            
            # Get click record
            click = self.clicks_collection.find_one({'click_id': click_id})
            if not click:
                return {'error': 'Click not found'}
            
            # Check conversion window
            if datetime.utcnow() > click['conversion_window_expires']:
                return {'error': 'Conversion window expired'}
            
            # Get offer
            offer = self.offers_collection.find_one({'offer_id': click['offer_id']})
            if not offer:
                return {'error': 'Offer not found'}
            
            # Check for duplicate conversions
            duplicate_rule = offer.get('duplicate_conversion_rule', 'allow')
            
            if duplicate_rule != 'allow':
                existing_conversion = self.conversions_collection.find_one({
                    'click_id': click_id,
                    'status': {'$in': ['approved', 'pending']}
                })
                
                if existing_conversion:
                    if duplicate_rule == 'deny':
                        return {'error': 'Duplicate conversion not allowed'}
                    elif duplicate_rule == 'unique':
                        # Check for same IP/offer combination
                        ip_conversion = self.conversions_collection.find_one({
                            'offer_id': click['offer_id'],
                            'ip_address': click['ip_address'],
                            'status': {'$in': ['approved', 'pending']}
                        })
                        if ip_conversion:
                            return {'error': 'Unique conversion rule violated'}
            
            # Create conversion record with transaction_id and response_data
            conversion_doc = {
                'conversion_id': str(uuid.uuid4()),
                'transaction_id': conversion_data.get('transaction_id', str(uuid.uuid4())),  # Transaction ID
                'click_id': click_id,
                'offer_id': click['offer_id'],
                'partner_id': offer.get('partner_id', ''),  # Partner ID for postback
                'affiliate_id': click['affiliate_id'],
                'payout': conversion_data.get('payout', offer['payout']),
                'currency': offer.get('currency', 'USD'),
                'status': conversion_data.get('status', 'pending'),
                'conversion_time': datetime.utcnow(),
                'ip_address': click['ip_address'],
                'user_agent': click['user_agent'],
                'country': click['country'],
                'sub_ids': click['sub_ids'],
                'external_id': conversion_data.get('external_id'),
                'revenue': conversion_data.get('revenue'),
                'response_data': conversion_data.get('response_data', {}),  # Full response from offer completion
                'created_at': datetime.utcnow()
            }
            
            # STEP 1: Insert conversion FIRST (save to database)
            result = self.conversions_collection.insert_one(conversion_doc)
            conversion_doc['_id'] = str(result.inserted_id)
            self.logger.info(f"✅ Conversion saved: {conversion_doc['conversion_id']}")
            
            # STEP 2: Update click status
            self.clicks_collection.update_one(
                {'click_id': click_id},
                {'$set': {'status': 'converted', 'converted_at': datetime.utcnow()}}
            )
            
            # STEP 2.5: Log completion tracking event
            self.tracking_events.log_completion_event(
                offer_id=conversion_doc['offer_id'],
                user_id=conversion_doc['affiliate_id'],
                conversion_id=conversion_doc['conversion_id'],
                payout=conversion_doc['payout'],
                partner_id=conversion_doc.get('partner_id'),
                external_transaction_id=conversion_doc.get('external_id')
            )
            
            # STEP 3: Queue postback AFTER conversion is saved (use partner_id if available)
            if offer.get('partner_id'):
                self._queue_postback(offer, conversion_doc)
                self.logger.info(f"📤 Postback queued for partner: {offer.get('partner_id')}")
            elif offer.get('postback_url'):
                # Fallback to legacy postback_url if no partner_id
                self._queue_postback(offer, conversion_doc)
                self.logger.info(f"📤 Postback queued (legacy mode)")
            
            # STEP 4: Calculate and apply promo code bonuses
            bonus_result = self.bonus_service.apply_bonus_to_conversion(conversion_doc['conversion_id'])
            if 'error' not in bonus_result and bonus_result.get('bonus_amount', 0) > 0:
                self.logger.info(f"💰 Bonus applied: ${bonus_result['bonus_amount']} for conversion {conversion_doc['conversion_id']}")
                conversion_doc['bonus_amount'] = bonus_result['bonus_amount']
                conversion_doc['promo_codes_applied'] = bonus_result.get('codes_applied', [])
            
            return {
                'conversion': conversion_doc,
                'bonus': bonus_result if 'error' not in bonus_result else None,
                'message': 'Conversion recorded successfully'
            }
            
        except Exception as e:
            self.logger.error(f"Error recording conversion: {str(e)}")
            return {'error': str(e)}
    
    def _queue_postback(self, offer, conversion):
        """Queue postback for processing with partner support"""
        try:
            # Get partner details if partner_id exists
            partner = None
            postback_url = None
            method = 'GET'  # Default method
            
            if offer.get('partner_id'):
                partner = self.partners_collection.find_one({'partner_id': offer['partner_id']})
                if partner:
                    postback_url = partner.get('postback_url')
                    method = partner.get('method', 'GET')
                    self.logger.info(f"Using partner postback: {partner.get('partner_name')}")
            
            # Fallback to offer's postback_url if no partner
            if not postback_url:
                postback_url = offer.get('postback_url')
            
            if not postback_url:
                self.logger.warning(f"No postback URL configured for offer {offer['offer_id']}")
                return
            
            # Replace macros in postback URL (support all 6 macros)
            macros = {
                '{click_id}': conversion.get('click_id', ''),
                '{payout}': str(conversion.get('payout', '')),
                '{status}': conversion.get('status', ''),
                '{offer_id}': conversion.get('offer_id', ''),
                '{conversion_id}': conversion.get('conversion_id', ''),
                '{transaction_id}': conversion.get('transaction_id', ''),
                # Additional macros
                '{affiliate_id}': conversion.get('affiliate_id', ''),
                '{currency}': conversion.get('currency', ''),
                '{sub1}': conversion.get('sub_ids', {}).get('sub1', ''),
                '{sub2}': conversion.get('sub_ids', {}).get('sub2', ''),
                '{sub3}': conversion.get('sub_ids', {}).get('sub3', ''),
                '{sub4}': conversion.get('sub_ids', {}).get('sub4', ''),
                '{sub5}': conversion.get('sub_ids', {}).get('sub5', ''),
            }
            
            # Replace macros in URL
            final_url = postback_url
            for macro, value in macros.items():
                final_url = final_url.replace(macro, str(value))
            
            # Queue postback
            postback_doc = {
                'postback_id': str(uuid.uuid4()),
                'conversion_id': conversion['conversion_id'],
                'offer_id': conversion['offer_id'],
                'partner_id': offer.get('partner_id', ''),
                'partner_name': partner.get('partner_name', '') if partner else '',
                'url': final_url,
                'method': method,
                'status': 'pending',
                'attempts': 0,
                'max_attempts': 3,
                'next_attempt': datetime.utcnow(),
                'created_at': datetime.utcnow()
            }
            
            self.postback_queue_collection.insert_one(postback_doc)
            self.logger.info(f"Queued postback ({method}) for conversion {conversion['conversion_id']}")
            
        except Exception as e:
            self.logger.error(f"Error queueing postback: {str(e)}")
    
    def process_postback_queue(self):
        """Process pending postbacks with GET/POST support and logging"""
        try:
            # Get pending postbacks
            pending_postbacks = self.postback_queue_collection.find({
                'status': 'pending',
                'attempts': {'$lt': 3},
                'next_attempt': {'$lte': datetime.utcnow()}
            }).limit(100)
            
            for postback in pending_postbacks:
                try:
                    method = postback.get('method', 'GET')
                    
                    # Send postback (GET or POST)
                    if method == 'POST':
                        # For POST, send data as JSON body
                        post_data = {
                            'click_id': postback.get('click_id', ''),
                            'payout': postback.get('payout', ''),
                            'status': postback.get('status', ''),
                            'offer_id': postback.get('offer_id', ''),
                            'conversion_id': postback.get('conversion_id', ''),
                            'transaction_id': postback.get('transaction_id', '')
                        }
                        response = requests.post(
                            postback['url'],
                            json=post_data,
                            timeout=30,
                            headers={'User-Agent': 'PepeLeads-Postback/1.0', 'Content-Type': 'application/json'}
                        )
                    else:  # GET
                        response = requests.get(
                            postback['url'],
                            timeout=30,
                            headers={'User-Agent': 'PepeLeads-Postback/1.0'}
                        )
                    
                    # Determine if successful
                    is_success = response.status_code == 200
                    new_status = 'sent' if is_success else 'pending'
                    
                    # Log to postback_logs collection
                    log_doc = {
                        'log_id': str(uuid.uuid4()),
                        'postback_id': postback['postback_id'],
                        'conversion_id': postback.get('conversion_id', ''),
                        'partner_id': postback.get('partner_id', ''),
                        'partner_name': postback.get('partner_name', ''),
                        'offer_id': postback.get('offer_id', ''),
                        'url': postback['url'],
                        'method': method,
                        'status': 'success' if is_success else 'failed',
                        'response_code': response.status_code,
                        'response_body': response.text[:1000],
                        'attempts': postback['attempts'] + 1,
                        'error_message': '' if is_success else f'HTTP {response.status_code}',
                        'sent_at': datetime.utcnow(),
                        'created_at': datetime.utcnow()
                    }
                    self.postback_logs_collection.insert_one(log_doc)
                    
                    # Update postback queue
                    if is_success:
                        self.postback_queue_collection.update_one(
                            {'_id': postback['_id']},
                            {
                                '$set': {
                                    'status': 'sent',
                                    'response_code': response.status_code,
                                    'response_body': response.text[:1000],
                                    'sent_at': datetime.utcnow()
                                },
                                '$inc': {'attempts': 1}
                            }
                        )
                        
                        # Log successful postback event
                        self.tracking_events.log_postback_event(
                            event_type='postback_sent',
                            offer_id=postback.get('offer_id', ''),
                            partner_id=postback.get('partner_id', ''),
                            postback_url=postback['url'],
                            response_code=response.status_code,
                            response_body=response.text,
                            conversion_id=postback.get('conversion_id', '')
                        )
                        
                        self.logger.info(f"✅ Postback sent successfully: {postback['postback_id']}")
                    else:
                        # Retry later with exponential backoff
                        next_attempt = datetime.utcnow() + timedelta(minutes=5 * (postback['attempts'] + 1))
                        self.postback_queue_collection.update_one(
                            {'_id': postback['_id']},
                            {
                                '$set': {
                                    'response_code': response.status_code,
                                    'response_body': response.text[:1000],
                                    'next_attempt': next_attempt
                                },
                                '$inc': {'attempts': 1}
                            }
                        )
                        
                        # Log failed postback event
                        self.tracking_events.log_postback_event(
                            event_type='postback_failed',
                            offer_id=postback.get('offer_id', ''),
                            partner_id=postback.get('partner_id', ''),
                            postback_url=postback['url'],
                            response_code=response.status_code,
                            response_body=response.text,
                            conversion_id=postback.get('conversion_id', '')
                        )
                        
                        self.logger.warning(f"⚠️ Postback failed (will retry): {postback['postback_id']}")
                        
                except requests.RequestException as e:
                    # Network error - retry later
                    next_attempt = datetime.utcnow() + timedelta(minutes=5 * (postback['attempts'] + 1))
                    
                    # Log error to postback_logs
                    log_doc = {
                        'log_id': str(uuid.uuid4()),
                        'postback_id': postback['postback_id'],
                        'conversion_id': postback.get('conversion_id', ''),
                        'partner_id': postback.get('partner_id', ''),
                        'partner_name': postback.get('partner_name', ''),
                        'offer_id': postback.get('offer_id', ''),
                        'url': postback['url'],
                        'method': postback.get('method', 'GET'),
                        'status': 'failed',
                        'response_code': 0,
                        'response_body': '',
                        'attempts': postback['attempts'] + 1,
                        'error_message': str(e),
                        'sent_at': datetime.utcnow(),
                        'created_at': datetime.utcnow()
                    }
                    self.postback_logs_collection.insert_one(log_doc)
                    
                    self.postback_queue_collection.update_one(
                        {'_id': postback['_id']},
                        {
                            '$set': {
                                'error': str(e),
                                'next_attempt': next_attempt
                            },
                            '$inc': {'attempts': 1}
                        }
                    )
                    self.logger.error(f"❌ Postback network error: {postback['postback_id']} - {str(e)}")
                
                except Exception as e:
                    self.logger.error(f"❌ Error processing postback {postback['postback_id']}: {str(e)}")
            
            # Mark failed postbacks (max attempts reached)
            self.postback_queue_collection.update_many(
                {'status': 'pending', 'attempts': {'$gte': 3}},
                {'$set': {'status': 'failed', 'failed_at': datetime.utcnow()}}
            )
            
        except Exception as e:
            self.logger.error(f"Error processing postback queue: {str(e)}")
    
    def validate_traffic_source(self, offer, request_info):
        """Validate traffic source against offer rules"""
        try:
            referer = request_info.get('referer', '')
            
            # Check allowed traffic sources
            allowed_sources = offer.get('allowed_traffic_sources', [])
            if allowed_sources:
                source_allowed = False
                for allowed_source in allowed_sources:
                    if allowed_source.lower() in referer.lower():
                        source_allowed = True
                        break
                
                if not source_allowed:
                    return False, "Traffic source not allowed"
            
            # Check blocked traffic sources
            blocked_sources = offer.get('blocked_traffic_sources', [])
            if blocked_sources:
                for blocked_source in blocked_sources:
                    if blocked_source.lower() in referer.lower():
                        return False, f"Traffic source '{blocked_source}' is blocked"
            
            return True, "Traffic source validated"
            
        except Exception as e:
            self.logger.error(f"Error validating traffic source: {str(e)}")
            return False, f"Traffic source validation error: {str(e)}"
    
    def start_postback_processor(self):
        """Start background postback processor"""
        def processor_loop():
            while True:
                try:
                    self.process_postback_queue()
                    time.sleep(30)  # Process every 30 seconds
                except Exception as e:
                    self.logger.error(f"Error in postback processor: {str(e)}")
                    time.sleep(60)  # Sleep 1 minute on error
        
        # Start processor in background thread
        processor_thread = Thread(target=processor_loop, daemon=True)
        processor_thread.start()
        self.logger.info("Postback processor started")
        
        return processor_thread
    
    def track_offer_completion(self, offer_id: str, user_id: str, external_data: dict = None) -> dict:
        """
        Track offer completion from external source (e.g., offer wall completion)
        
        Args:
            offer_id: Offer ID that was completed
            user_id: User who completed the offer
            external_data: Additional data from external completion (transaction_id, payout, etc.)
        
        Returns:
            dict: Completion tracking result
        """
        try:
            # Find the most recent click for this user and offer
            recent_click = self.clicks_collection.find_one({
                'offer_id': offer_id,
                'affiliate_id': user_id,
                'status': 'clicked'
            }, sort=[('created_at', -1)])
            
            if not recent_click:
                # Create a synthetic click record for direct completions
                click_id = str(uuid.uuid4())
                click_doc = {
                    'click_id': click_id,
                    'offer_id': offer_id,
                    'affiliate_id': user_id,
                    'ip_address': external_data.get('ip_address', ''),
                    'user_agent': external_data.get('user_agent', ''),
                    'country': external_data.get('country', ''),
                    'referer': 'direct_completion',
                    'sub_ids': external_data.get('sub_ids', {}),
                    'click_time': datetime.utcnow(),
                    'conversion_window_expires': datetime.utcnow() + timedelta(days=30),
                    'status': 'clicked',
                    'created_at': datetime.utcnow(),
                    'synthetic': True  # Mark as synthetic click
                }
                
                result = self.clicks_collection.insert_one(click_doc)
                click_id = click_doc['click_id']
                self.logger.info(f"Created synthetic click for direct completion: {click_id}")
            else:
                click_id = recent_click['click_id']
            
            # Create conversion data
            conversion_data = {
                'click_id': click_id,
                'transaction_id': external_data.get('transaction_id', str(uuid.uuid4())),
                'payout': external_data.get('payout'),
                'status': external_data.get('status', 'approved'),
                'external_id': external_data.get('external_id'),
                'revenue': external_data.get('revenue'),
                'response_data': external_data or {}
            }
            
            # Record the conversion
            result = self.record_conversion(conversion_data)
            
            if 'error' in result:
                return {'error': result['error']}
            
            return {
                'success': True,
                'click_id': click_id,
                'conversion_id': result['conversion']['conversion_id'],
                'message': 'Offer completion tracked successfully'
            }
            
        except Exception as e:
            self.logger.error(f"Error tracking offer completion: {str(e)}")
            return {'error': str(e)}
    
    def get_tracking_stats(self, offer_id: str = None, user_id: str = None, 
                          date_range: dict = None) -> dict:
        """
        Get tracking statistics
        
        Args:
            offer_id: Filter by specific offer
            user_id: Filter by specific user
            date_range: {'start': datetime, 'end': datetime}
        
        Returns:
            dict: Tracking statistics
        """
        try:
            # Build filter
            filter_query = {}
            if offer_id:
                filter_query['offer_id'] = offer_id
            if user_id:
                filter_query['affiliate_id'] = user_id
            if date_range:
                filter_query['created_at'] = {
                    '$gte': date_range['start'],
                    '$lte': date_range['end']
                }
            
            # Get click stats
            total_clicks = self.clicks_collection.count_documents(filter_query)
            converted_clicks = self.clicks_collection.count_documents({
                **filter_query,
                'status': 'converted'
            })
            
            # Get conversion stats
            conversion_filter = dict(filter_query)
            if 'affiliate_id' in conversion_filter:
                conversion_filter['affiliate_id'] = conversion_filter.pop('affiliate_id')
            
            total_conversions = self.conversions_collection.count_documents(conversion_filter)
            
            # Calculate conversion rate
            conversion_rate = (converted_clicks / total_clicks * 100) if total_clicks > 0 else 0
            
            # Get revenue stats
            revenue_pipeline = [
                {'$match': conversion_filter},
                {'$group': {
                    '_id': None,
                    'total_payout': {'$sum': '$payout'},
                    'avg_payout': {'$avg': '$payout'},
                    'total_revenue': {'$sum': '$revenue'}
                }}
            ]
            
            revenue_result = list(self.conversions_collection.aggregate(revenue_pipeline))
            revenue_data = revenue_result[0] if revenue_result else {
                'total_payout': 0, 'avg_payout': 0, 'total_revenue': 0
            }
            
            return {
                'clicks': {
                    'total': total_clicks,
                    'converted': converted_clicks,
                    'conversion_rate': round(conversion_rate, 2)
                },
                'conversions': {
                    'total': total_conversions,
                    'total_payout': revenue_data['total_payout'],
                    'avg_payout': round(revenue_data['avg_payout'], 2) if revenue_data['avg_payout'] else 0,
                    'total_revenue': revenue_data['total_revenue']
                }
            }
            
        except Exception as e:
            self.logger.error(f"Error getting tracking stats: {str(e)}")
            return {'error': str(e)}
