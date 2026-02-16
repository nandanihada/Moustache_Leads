"""
Extended Offer Model with Schedule and Smart Rules Support
Integrates with existing MongoDB structure and adds new subdocuments
"""

from datetime import datetime, timedelta
from bson import ObjectId
from database import db_instance
import re
import sys
import os
from typing import List, Dict, Optional, Any

# Import traffic source rules service
try:
    sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'services'))
    from traffic_source_rules_service import TrafficSourceRulesService
except ImportError:
    TrafficSourceRulesService = None

class OfferExtended:
    def __init__(self):
        self.collection = db_instance.get_collection('offers')
        self.counter_collection = db_instance.get_collection('counters')
        self.settings_collection = db_instance.get_collection('offer_settings')
    
    def _check_db_connection(self):
        """Check if database is connected and usable"""
        if self.collection is None or not db_instance.is_connected():
            return False
        
        try:
            self.collection.find_one({}, {'_id': 1})
            return True
        except Exception:
            return False
    
    def _get_next_offer_id(self):
        """Generate next auto-increment offer ID in format ML-00001"""
        if not self._check_db_connection():
            return "ML-00001"  # Fallback for testing
        
        try:
            # Find and update counter
            result = self.counter_collection.find_one_and_update(
                {'_id': 'offer_counter'},
                {'$inc': {'sequence_value': 1}},
                upsert=True,
                return_document=True
            )
            
            sequence = result['sequence_value']
            return f"ML-{sequence:05d}"  # Format as ML-00001, ML-00002, etc.
            
        except Exception as e:
            # Fallback: find highest existing ID and increment
            try:
                last_offer = self.collection.find_one(
                    {'offer_id': {'$regex': '^ML-'}},
                    sort=[('offer_id', -1)]
                )
                if last_offer:
                    last_num = int(last_offer['offer_id'].split('-')[1])
                    return f"ML-{last_num + 1:05d}"
                else:
                    return "ML-00001"
            except:
                return "ML-00001"
    
    def _generate_traffic_source_fields(self, vertical, allowed_countries, offer_data):
        """
        Generate traffic source fields based on category/vertical.
        
        Uses the TrafficSourceRulesService for deterministic rule-based generation.
        Supports manual overrides from offer_data.
        """
        # Check if TrafficSourceRulesService is available
        if TrafficSourceRulesService is None:
            # Fallback to basic defaults if service not available
            return {
                'allowed_traffic_sources': offer_data.get('allowed_traffic_sources', ['Email', 'Search', 'Display']),
                'risky_traffic_sources': offer_data.get('risky_traffic_sources', ['Social', 'Push']),
                'disallowed_traffic_sources': offer_data.get('disallowed_traffic_sources', ['Adult', 'Fraud', 'Spam']),
                'blocked_traffic_sources': offer_data.get('blocked_traffic_sources', []),
                'traffic_source_overrides': None
            }
        
        # Get primary country for country-specific adjustments
        country = None
        if allowed_countries and len(allowed_countries) == 1:
            country = allowed_countries[0]
        
        # Check for manual overrides in offer_data
        overrides = None
        if (offer_data.get('allowed_traffic_sources') or 
            offer_data.get('risky_traffic_sources') or 
            offer_data.get('disallowed_traffic_sources')):
            overrides = {
                'allowed': offer_data.get('allowed_traffic_sources'),
                'risky': offer_data.get('risky_traffic_sources'),
                'disallowed': offer_data.get('disallowed_traffic_sources')
            }
            # Filter out None values
            overrides = {k: v for k, v in overrides.items() if v is not None}
            if not overrides:
                overrides = None
        
        # Generate traffic sources using the rules service
        rules = TrafficSourceRulesService.generate_traffic_sources(
            category=vertical,
            country=country,
            overrides=overrides
        )
        
        return {
            'allowed_traffic_sources': rules['allowed'],
            'risky_traffic_sources': rules['risky'],
            'disallowed_traffic_sources': rules['disallowed'],
            'blocked_traffic_sources': offer_data.get('blocked_traffic_sources', rules['disallowed']),
            'traffic_source_overrides': overrides
        }
    
    def _validate_schedule(self, schedule_data: Dict) -> tuple[bool, str]:
        """Validate schedule data"""
        if not schedule_data:
            return True, ""
        
        start_at = schedule_data.get('startAt')
        end_at = schedule_data.get('endAt')
        
        # Convert string dates to datetime if needed
        if isinstance(start_at, str):
            try:
                start_at = datetime.fromisoformat(start_at.replace('Z', '+00:00'))
            except ValueError:
                return False, "Invalid startAt date format"
        
        if isinstance(end_at, str):
            try:
                end_at = datetime.fromisoformat(end_at.replace('Z', '+00:00'))
            except ValueError:
                return False, "Invalid endAt date format"
        
        # Validate date logic
        if start_at and end_at and end_at <= start_at:
            return False, "End date must be after start date"
        
        # Validate recurring days
        valid_days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
        recurring_days = schedule_data.get('recurringDays', [])
        
        for day in recurring_days:
            if day not in valid_days:
                return False, f"Invalid recurring day: {day}"
        
        # Validate status
        valid_statuses = ['Active', 'Paused']
        status = schedule_data.get('status', 'Active')
        if status not in valid_statuses:
            return False, f"Invalid schedule status: {status}"
        
        return True, ""
    
    def _validate_smart_rules(self, smart_rules: List[Dict]) -> tuple[bool, str]:
        """Validate smart rules data"""
        if not smart_rules:
            return True, ""
        
        valid_types = ['Backup', 'Rotation', 'GEO', 'Time']
        priorities = []
        
        for i, rule in enumerate(smart_rules):
            # Validate rule type
            rule_type = rule.get('type')
            if rule_type not in valid_types:
                return False, f"Invalid rule type '{rule_type}' in rule {i+1}"
            
            # Validate URL
            url = rule.get('url', '')
            if not url or not re.match(r'^https?://.+', url):
                return False, f"Invalid URL in rule {i+1}"
            
            # Validate percentage
            percentage = rule.get('percentage', 0)
            if not isinstance(percentage, (int, float)) or percentage < 0 or percentage > 100:
                return False, f"Invalid percentage in rule {i+1} (must be 0-100)"
            
            # Validate cap
            cap = rule.get('cap', 0)
            if not isinstance(cap, (int, float)) or cap < 0:
                return False, f"Invalid cap in rule {i+1} (must be >= 0)"
            
            # Validate priority
            priority = rule.get('priority', 1)
            if not isinstance(priority, int) or priority < 1:
                return False, f"Invalid priority in rule {i+1} (must be >= 1)"
            
            if priority in priorities:
                return False, f"Duplicate priority {priority} in rules"
            priorities.append(priority)
            
            # Validate geo codes
            geo = rule.get('geo', [])
            if geo:
                for country_code in geo:
                    if not isinstance(country_code, str) or len(country_code) != 2:
                        return False, f"Invalid country code '{country_code}' in rule {i+1}"
        
        return True, ""
    
    def create_offer_extended(self, offer_data: Dict, created_by: str) -> tuple[Optional[Dict], Optional[str]]:
        """Create a new offer with extended schedule and smart rules support"""
        if not self._check_db_connection():
            return None, "Database connection not available"
        
        try:
            # Generate unique offer ID
            offer_id = self._get_next_offer_id()
            
            # Validate required fields
            required_fields = ['campaign_id', 'name', 'payout', 'network', 'target_url']
            for field in required_fields:
                if not offer_data.get(field):
                    return None, f"Field '{field}' is required"
            
            # Validate URL format
            url_pattern = re.compile(
                r'^https?://'  # http:// or https://
                r'(?:(?:[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?\.)+[A-Z]{2,6}\.?|'  # domain...
                r'localhost|'  # localhost...
                r'\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})'  # ...or ip
                r'(?::\d+)?'  # optional port
                r'(?:/?|[/?]\S+)$', re.IGNORECASE)
            
            if not url_pattern.match(offer_data['target_url']):
                return None, "Invalid target URL format"
            
            if offer_data.get('preview_url') and not url_pattern.match(offer_data['preview_url']):
                return None, "Invalid preview URL format"
            
            # Validate payout is numeric
            try:
                float(offer_data['payout'])
            except (ValueError, TypeError):
                return None, "Payout must be a valid number"
            
            # Validate schedule data
            schedule_data = offer_data.get('schedule', {})
            is_valid, error_msg = self._validate_schedule(schedule_data)
            if not is_valid:
                return None, f"Schedule validation error: {error_msg}"
            
            # Validate smart rules data
            smart_rules_data = offer_data.get('smartRules', [])
            is_valid, error_msg = self._validate_smart_rules(smart_rules_data)
            if not is_valid:
                return None, f"Smart rules validation error: {error_msg}"
            
            # Create offer document with extended schema
            offer_doc = {
                # SECTION 1: OFFER IDENTIFICATION
                'offer_id': offer_id,
                'campaign_id': offer_data['campaign_id'].strip(),
                'name': offer_data['name'].strip(),
                'description': offer_data.get('description', '').strip(),
                'category': offer_data.get('category', 'General'),
                'offer_type': offer_data.get('offer_type', 'CPA'),
                'status': offer_data.get('status', 'pending'),
                'tags': offer_data.get('tags', []),
                'keywords': offer_data.get('keywords', []),
                
                # SECTION 2: TARGETING RULES
                'countries': offer_data.get('countries', []),
                'languages': offer_data.get('languages', []),
                'device_targeting': offer_data.get('device_targeting', 'all'),
                'os_targeting': offer_data.get('os_targeting', []),
                'browser_targeting': offer_data.get('browser_targeting', []),
                'carrier_targeting': offer_data.get('carrier_targeting', []),
                'connection_type': offer_data.get('connection_type', 'all'),
                'timezone': offer_data.get('timezone', 'UTC'),
                
                # SECTION 3: PAYOUT & FINANCE
                'payout': float(offer_data['payout']),
                'currency': offer_data.get('currency', 'USD'),
                'revenue': offer_data.get('revenue'),
                'payout_type': offer_data.get('payout_type', 'fixed'),
                'daily_cap': offer_data.get('daily_cap'),
                'weekly_cap': offer_data.get('weekly_cap'),
                'monthly_cap': offer_data.get('monthly_cap'),
                'auto_pause_on_cap': offer_data.get('auto_pause_on_cap', False),
                'cap_alert_emails': offer_data.get('cap_alert_emails', []),
                
                # SECTION 4: TRACKING SETUP
                'network': offer_data['network'].strip(),
                'partner_id': offer_data.get('partner_id', '').strip(),  # Partner ID for postback
                'target_url': offer_data['target_url'].strip(),
                'preview_url': offer_data.get('preview_url', '').strip(),
                'tracking_domain': offer_data.get('tracking_domain', 'main'),
                'tracking_protocol': offer_data.get('tracking_protocol', 'pixel'),
                'postback_url': offer_data.get('postback_url', '').strip(),
                'hash_code': offer_data.get('hash_code', '').strip(),
                'click_expiration': offer_data.get('click_expiration', 7),
                'conversion_window': offer_data.get('conversion_window', 30),
                
                # SECTION 4.1: TRAFFIC SOURCE RULES (Auto-generated based on category)
                **self._generate_traffic_source_fields(
                    offer_data.get('vertical', 'Lifestyle'),
                    offer_data.get('allowed_countries', []),
                    offer_data
                ),
                
                'duplicate_conversion_rule': offer_data.get('duplicate_conversion_rule', 'allow'),
                
                # SECTION 5: ACCESS & AFFILIATES
                'affiliates': offer_data.get('affiliates', 'all'),
                'access_type': offer_data.get('access_type', 'public'),
                'selected_users': offer_data.get('selected_users', []),
                'manager': offer_data.get('manager', '').strip(),
                'approval_notes': offer_data.get('approval_notes', '').strip(),
                
                # SECTION 6: CREATIVES & VISUALS
                'creative_type': offer_data.get('creative_type', 'image'),
                'image_url': offer_data.get('image_url', '').strip(),
                'thumbnail_url': offer_data.get('thumbnail_url', '').strip(),
                'html_code': offer_data.get('html_code', '').strip(),
                'email_template': offer_data.get('email_template', '').strip(),
                'email_subject': offer_data.get('email_subject', '').strip(),
                'banner_codes': offer_data.get('banner_codes', []),
                'email_creative': offer_data.get('email_creative', '').strip(),
                'landing_page_variants': offer_data.get('landing_page_variants', []),
                'creative_category': offer_data.get('creative_category', 'banner'),
                
                # SECTION 7: SCHEDULE (NEW EXTENDED SCHEMA)
                'schedule': self._process_schedule_data(schedule_data),
                
                # SECTION 8: SMART RULES (NEW EXTENDED SCHEMA)
                'smartRules': self._process_smart_rules_data(smart_rules_data),
                
                # SECTION 9: COMPLIANCE
                'allowed_traffic_types': offer_data.get('allowed_traffic_types', ['email', 'search', 'display']),
                'disallowed_traffic_types': offer_data.get('disallowed_traffic_types', ['adult', 'fraud']),
                'creative_approval_required': offer_data.get('creative_approval_required', False),
                'affiliate_terms': offer_data.get('affiliate_terms', '').strip(),
                'brand_guidelines': offer_data.get('brand_guidelines', '').strip(),
                'terms_notes': offer_data.get('terms_notes', '').strip(),
                
                # SECTION 10: INTEGRATIONS
                'network_partner': offer_data.get('network_partner', '').strip(),
                'network_short_description': offer_data.get('network_short_description', '').strip(),
                'external_offer_id': offer_data.get('external_offer_id', '').strip(),
                'sync_frequency': offer_data.get('sync_frequency', 'manual'),
                'webhook_template': offer_data.get('webhook_template', '').strip(),
                'webhook_url': offer_data.get('webhook_url', '').strip(),
                
                # SECTION 11: REPORTING & MONITORING
                'hit_limit': offer_data.get('hit_limit'),
                'conversion_goal': offer_data.get('conversion_goal', 'lead'),
                'quality_threshold': offer_data.get('quality_threshold'),
                'validation_type': offer_data.get('validation_type', 'internal'),
                
                # SECTION 12: PROMO CODE ASSIGNMENT (Admin-assigned)
                'promo_code_id': offer_data.get('promo_code_id'),  # ObjectId of assigned promo code
                'promo_code': offer_data.get('promo_code'),  # Code name (e.g., "SUMMER20")
                'bonus_amount': offer_data.get('bonus_amount'),  # Bonus amount (20 for 20%)
                'bonus_type': offer_data.get('bonus_type'),  # Bonus type (percentage/fixed)
                'promo_code_assigned_at': offer_data.get('promo_code_assigned_at'),  # When assigned
                'promo_code_assigned_by': offer_data.get('promo_code_assigned_by'),  # Admin who assigned
                
                # SECTION 13: FALLBACK REDIRECT WITH TIMER
                'fallback_redirect_enabled': bool(offer_data.get('fallback_redirect_enabled', False)),
                'fallback_redirect_url': (offer_data.get('fallback_redirect_url') or '').strip(),
                'fallback_redirect_timer': int(offer_data.get('fallback_redirect_timer') or 0),
                
                # SYSTEM FIELDS
                'hits': 0,
                'limit': offer_data.get('limit'),
                'created_by': created_by,
                'created_at': datetime.utcnow(),
                'updated_at': datetime.utcnow(),
                'is_active': True,
                'schema_version': '2.0'  # Mark as extended schema
            }
            
            # Insert offer
            result = self.collection.insert_one(offer_doc)
            offer_doc['_id'] = str(result.inserted_id)
            
            return offer_doc, None
            
        except Exception as e:
            return None, f"Error creating offer: {str(e)}"
    
    def _process_schedule_data(self, schedule_data: Dict) -> Dict:
        """Process and normalize schedule data"""
        if not schedule_data:
            return {
                'startAt': None,
                'endAt': None,
                'recurringDays': [],
                'status': 'Active',
                'timezone': 'UTC',
                'isRecurring': False
            }
        
        processed = {
            'startAt': schedule_data.get('startAt'),
            'endAt': schedule_data.get('endAt'),
            'recurringDays': schedule_data.get('recurringDays', []),
            'status': schedule_data.get('status', 'Active'),
            'timezone': schedule_data.get('timezone', 'UTC'),
            'isRecurring': schedule_data.get('isRecurring', False)
        }
        
        # Convert string dates to datetime objects
        for date_field in ['startAt', 'endAt']:
            if processed[date_field] and isinstance(processed[date_field], str):
                try:
                    processed[date_field] = datetime.fromisoformat(processed[date_field].replace('Z', '+00:00'))
                except ValueError:
                    processed[date_field] = None
        
        return processed
    
    def _process_smart_rules_data(self, smart_rules_data: List[Dict]) -> List[Dict]:
        """Process and normalize smart rules data"""
        if not smart_rules_data:
            return []
        
        processed_rules = []
        for rule in smart_rules_data:
            processed_rule = {
                '_id': ObjectId(),
                'type': rule.get('type', 'Backup'),
                'url': rule.get('url', ''),
                'geo': [geo.upper() for geo in rule.get('geo', [])],
                'percentage': float(rule.get('percentage', 0)),
                'cap': int(rule.get('cap', 0)),
                'priority': int(rule.get('priority', 1)),
                'active': bool(rule.get('active', True)),
                'createdAt': datetime.utcnow()
            }
            processed_rules.append(processed_rule)
        
        # Sort by priority
        processed_rules.sort(key=lambda x: x['priority'])
        
        return processed_rules
    
    def get_active_offers_with_schedule(self) -> List[Dict]:
        """Get currently active offers considering their schedule"""
        if not self._check_db_connection():
            return []
        
        now = datetime.utcnow()
        
        query = {
            'status': 'Active',
            'is_active': True,
            'schedule.status': 'Active',
            '$or': [
                {'schedule.startAt': {'$exists': False}},
                {'schedule.startAt': None},
                {'schedule.startAt': {'$lte': now}}
            ],
            '$and': [
                {
                    '$or': [
                        {'schedule.endAt': {'$exists': False}},
                        {'schedule.endAt': None},
                        {'schedule.endAt': {'$gte': now}}
                    ]
                }
            ]
        }
        
        try:
            offers = list(self.collection.find(query).sort('created_at', -1))
            
            # Convert ObjectIds to strings
            for offer in offers:
                offer['_id'] = str(offer['_id'])
                # Convert smart rule ObjectIds to strings
                if 'smartRules' in offer:
                    for rule in offer['smartRules']:
                        if '_id' in rule:
                            rule['_id'] = str(rule['_id'])
            
            return offers
        except Exception as e:
            print(f"Error getting active offers: {str(e)}")
            return []
    
    def get_offers_by_geo_rules(self, country_code: str) -> List[Dict]:
        """Get offers with active GEO-based smart rules for specific country"""
        if not self._check_db_connection():
            return []
        
        query = {
            'status': 'Active',
            'is_active': True,
            'smartRules': {
                '$elemMatch': {
                    'type': 'GEO',
                    'geo': country_code.upper(),
                    'active': True
                }
            }
        }
        
        try:
            offers = list(self.collection.find(query).sort('payout', -1))
            
            # Convert ObjectIds to strings
            for offer in offers:
                offer['_id'] = str(offer['_id'])
                if 'smartRules' in offer:
                    for rule in offer['smartRules']:
                        if '_id' in rule:
                            rule['_id'] = str(rule['_id'])
            
            return offers
        except Exception as e:
            print(f"Error getting geo-targeted offers: {str(e)}")
            return []
    
    def update_smart_rule(self, offer_id: str, rule_id: str, rule_data: Dict) -> tuple[bool, str]:
        """Update a specific smart rule in an offer"""
        if not self._check_db_connection():
            return False, "Database connection not available"
        
        try:
            # Validate rule data
            is_valid, error_msg = self._validate_smart_rules([rule_data])
            if not is_valid:
                return False, error_msg
            
            # Update the specific rule
            result = self.collection.update_one(
                {
                    'offer_id': offer_id,
                    'smartRules._id': ObjectId(rule_id)
                },
                {
                    '$set': {
                        'smartRules.$.type': rule_data.get('type'),
                        'smartRules.$.url': rule_data.get('url'),
                        'smartRules.$.geo': [geo.upper() for geo in rule_data.get('geo', [])],
                        'smartRules.$.percentage': float(rule_data.get('percentage', 0)),
                        'smartRules.$.cap': int(rule_data.get('cap', 0)),
                        'smartRules.$.priority': int(rule_data.get('priority', 1)),
                        'smartRules.$.active': bool(rule_data.get('active', True)),
                        'updated_at': datetime.utcnow()
                    }
                }
            )
            
            if result.modified_count > 0:
                return True, "Smart rule updated successfully"
            else:
                return False, "Smart rule not found or no changes made"
                
        except Exception as e:
            return False, f"Error updating smart rule: {str(e)}"
    
    def add_smart_rule(self, offer_id: str, rule_data: Dict) -> tuple[bool, str]:
        """Add a new smart rule to an offer"""
        if not self._check_db_connection():
            return False, "Database connection not available"
        
        try:
            # Validate rule data
            is_valid, error_msg = self._validate_smart_rules([rule_data])
            if not is_valid:
                return False, error_msg
            
            # Process rule data
            processed_rule = {
                '_id': ObjectId(),
                'type': rule_data.get('type', 'Backup'),
                'url': rule_data.get('url', ''),
                'geo': [geo.upper() for geo in rule_data.get('geo', [])],
                'percentage': float(rule_data.get('percentage', 0)),
                'cap': int(rule_data.get('cap', 0)),
                'priority': int(rule_data.get('priority', 1)),
                'active': bool(rule_data.get('active', True)),
                'createdAt': datetime.utcnow()
            }
            
            # Add rule to offer
            result = self.collection.update_one(
                {'offer_id': offer_id},
                {
                    '$push': {'smartRules': processed_rule},
                    '$set': {'updated_at': datetime.utcnow()}
                }
            )
            
            if result.modified_count > 0:
                return True, "Smart rule added successfully"
            else:
                return False, "Offer not found"
                
        except Exception as e:
            return False, f"Error adding smart rule: {str(e)}"
    
    def remove_smart_rule(self, offer_id: str, rule_id: str) -> tuple[bool, str]:
        """Remove a smart rule from an offer"""
        if not self._check_db_connection():
            return False, "Database connection not available"
        
        try:
            result = self.collection.update_one(
                {'offer_id': offer_id},
                {
                    '$pull': {'smartRules': {'_id': ObjectId(rule_id)}},
                    '$set': {'updated_at': datetime.utcnow()}
                }
            )
            
            if result.modified_count > 0:
                return True, "Smart rule removed successfully"
            else:
                return False, "Smart rule not found"
                
        except Exception as e:
            return False, f"Error removing smart rule: {str(e)}"
    
    def create_offer(self, offer_data: Dict, created_by: str) -> tuple[Optional[Dict], Optional[str]]:
        """Create a new offer - wrapper for create_offer_extended for compatibility"""
        return self.create_offer_extended(offer_data, created_by)
    
    def update_offer(self, offer_id: str, update_data: Dict, updated_by: str) -> tuple[bool, Optional[str]]:
        """Update an existing offer with schedule and smart rules support"""
        if not self._check_db_connection():
            return False, "Database connection not available"
        
        try:
            # Validate offer exists
            existing_offer = self.collection.find_one({'offer_id': offer_id})
            if not existing_offer:
                return False, "Offer not found"
            
            # Prepare update document
            update_doc = {
                'updated_at': datetime.utcnow(),
                'updated_by': updated_by
            }
            
            # Process regular offer fields
            regular_fields = [
                'name', 'description', 'status', 'countries', 'payout', 'network',
                'target_url', 'preview_url', 'device_targeting', 'affiliates',
                'selected_users', 'image_url', 'thumbnail_url', 'hash_code',
                'limit', 'daily_cap', 'weekly_cap', 'monthly_cap', 'click_expiration',
                'conversion_window', 'expiration_date', 'start_date', 'revenue',
                'languages', 'os_targeting', 'browser_targeting', 'carrier_targeting',
                'creative_type', 'html_code', 'banner_sizes', 'landing_pages',
                'allowed_traffic_types', 'disallowed_traffic_types',
                'creative_approval_required', 'affiliate_terms', 'brand_guidelines',
                'terms_notes', 'conversion_goal',
                # Promo code fields
                'promo_code_id', 'promo_code', 'bonus_amount', 'bonus_type',
                'promo_code_assigned_at', 'promo_code_assigned_by',
                # Fallback redirect with timer fields
                'fallback_redirect_enabled', 'fallback_redirect_url', 'fallback_redirect_timer',
                # Geo-restriction fields
                'allowed_countries', 'non_access_url',
                # Revenue sharing fields
                'revenue_share_percent', 'incentive_type', 'payout_type',
                # Approval workflow fields
                'approval_type', 'auto_approve_delay', 'require_approval', 
                'approval_message', 'max_inactive_days', 'approval_settings',
                # Traffic source fields
                'allowed_traffic_sources', 'risky_traffic_sources', 
                'disallowed_traffic_sources', 'blocked_traffic_sources', 'traffic_source_overrides',
                # Vertical/category
                'vertical', 'category'
            ]
            
            for field in regular_fields:
                if field in update_data:
                    update_doc[field] = update_data[field]
            
            # Process schedule data if present
            if 'schedule' in update_data:
                schedule_valid, schedule_error = self._validate_schedule(update_data['schedule'])
                if not schedule_valid:
                    return False, f"Invalid schedule data: {schedule_error}"
                
                processed_schedule = self._process_schedule_data(update_data['schedule'])
                update_doc['schedule'] = processed_schedule
            
            # Process smart rules data if present
            if 'smartRules' in update_data:
                rules_valid, rules_error = self._validate_smart_rules(update_data['smartRules'])
                if not rules_valid:
                    return False, f"Invalid smart rules data: {rules_error}"
                
                processed_rules = self._process_smart_rules_data(update_data['smartRules'])
                update_doc['smartRules'] = processed_rules
            
            # Update the offer
            result = self.collection.update_one(
                {'offer_id': offer_id},
                {'$set': update_doc}
            )
            
            if result.modified_count > 0:
                return True, None
            else:
                return False, "No changes were made to the offer"
                
        except Exception as e:
            return False, f"Error updating offer: {str(e)}"
    
    def get_offer_by_id(self, offer_id: str) -> Optional[Dict]:
        """Get an offer by its ID"""
        if not self._check_db_connection():
            return None
        
        try:
            offer = self.collection.find_one({'offer_id': offer_id})
            return offer
        except Exception as e:
            print(f"Error getting offer by ID: {str(e)}")
            return None
