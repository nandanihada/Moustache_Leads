from datetime import datetime
from bson import ObjectId
from database import db_instance
import re
import sys
import os

# Add utils directory to path for frontend mapping
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'utils'))
from frontend_mapping import frontend_to_database, validate_frontend_data

class Offer:
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
    
    def create_offer(self, offer_data, created_by):
        """Create a new offer with frontend field mapping support"""
        if not self._check_db_connection():
            return None, "Database connection not available"
        
        try:
            # Validate frontend data first
            is_valid, validation_errors = validate_frontend_data(offer_data)
            if not is_valid:
                return None, f"Validation errors: {'; '.join(validation_errors)}"
            
            # Map frontend fields to database schema
            mapped_data = frontend_to_database(offer_data)
            
            # Generate unique offer ID
            offer_id = self._get_next_offer_id()
            
            # Validate required fields
            required_fields = ['campaign_id', 'name', 'payout', 'network', 'target_url']
            for field in required_fields:
                if not mapped_data.get(field):
                    return None, f"Field '{field}' is required"
            
            # Validate URL format
            url_pattern = re.compile(
                r'^https?://'  # http:// or https://
                r'(?:(?:[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?\.)+[A-Z]{2,6}\.?|'  # domain...
                r'localhost|'  # localhost...
                r'\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})'  # ...or ip
                r'(?::\d+)?'  # optional port
                r'(?:/?|[/?]\S+)$', re.IGNORECASE)
            
            if not url_pattern.match(mapped_data['target_url']):
                return None, "Invalid target URL format"
            
            if mapped_data.get('preview_url') and not url_pattern.match(mapped_data['preview_url']):
                return None, "Invalid preview URL format"
            
            # Validate payout is numeric
            try:
                float(mapped_data['payout'])
            except (ValueError, TypeError):
                return None, "Payout must be a valid number"
            
            # Create offer document using mapped data
            offer_doc = {
                # SECTION 1: OFFER IDENTIFICATION
                'offer_id': offer_id,  # Our auto-generated ML-00001
                'campaign_id': mapped_data['campaign_id'].strip(),  # Publisher's campaign ID
                'name': mapped_data['name'].strip(),
                'description': mapped_data.get('description', '').strip(),
                'category': mapped_data.get('category', 'general'),  # Finance/Gaming/Dating/etc
                'offer_type': mapped_data.get('offer_type', 'CPA'),  # CPA/CPL/CPS/CPI/CPC
                'status': mapped_data.get('status', 'pending'),  # Active/Inactive/Pending/Paused/Hidden
                'tags': mapped_data.get('tags', []),  # Internal filtering tags
                'keywords': mapped_data.get('keywords', []),  # SEO/filtering keywords
                
                # SECTION 2: TARGETING RULES
                'countries': mapped_data.get('countries', []),
                'languages': mapped_data.get('languages', []),  # en, es, fr, etc
                'device_targeting': mapped_data.get('device_targeting', 'all'),  # all/mobile/desktop
                'os_targeting': mapped_data.get('os_targeting', []),  # iOS/Android/Windows/Mac
                'browser_targeting': mapped_data.get('browser_targeting', []),  # Chrome/Safari/Edge
                'carrier_targeting': mapped_data.get('carrier_targeting', []),  # Verizon/AT&T/T-Mobile
                'connection_type': mapped_data.get('connection_type', 'all'),  # wifi/mobile/all
                'timezone': mapped_data.get('timezone', 'UTC'),  # UTC/EST/PST/etc
                
                # SECTION 3: PAYOUT & FINANCE
                'payout': float(offer_data['payout']),
                'currency': offer_data.get('currency', 'USD'),  # USD/EUR/GBP/etc
                'revenue': offer_data.get('revenue'),  # Optional network earn
                'payout_type': offer_data.get('payout_type', 'fixed'),  # fixed/tiered/percentage
                'daily_cap': offer_data.get('daily_cap'),  # Daily conversion limit
                'weekly_cap': offer_data.get('weekly_cap'),  # Weekly conversion limit
                'monthly_cap': offer_data.get('monthly_cap'),  # Monthly conversion limit
                'auto_pause_on_cap': offer_data.get('auto_pause_on_cap', False),  # Auto pause when cap reached
                'cap_alert_emails': offer_data.get('cap_alert_emails', []),  # Email alerts for caps
                
                # SECTION 4: TRACKING SETUP
                'network': offer_data['network'].strip(),
                'partner_id': offer_data.get('partner_id', '').strip(),  # Partner ID for postback
                'target_url': offer_data['target_url'].strip(),
                'preview_url': offer_data.get('preview_url', '').strip(),
                'tracking_domain': offer_data.get('tracking_domain', 'main'),  # main/subdomain
                'tracking_protocol': offer_data.get('tracking_protocol', 'pixel'),  # pixel/s2s/api
                'postback_url': offer_data.get('postback_url', '').strip(),  # Conversion postback URL
                'hash_code': offer_data.get('hash_code', '').strip(),
                'click_expiration': offer_data.get('click_expiration', 7),  # Days
                'conversion_window': offer_data.get('conversion_window', 30),  # Days
                'allowed_traffic_sources': offer_data.get('allowed_traffic_sources', []),  # Allowed sources
                'blocked_traffic_sources': offer_data.get('blocked_traffic_sources', []),  # Blocked sources
                'duplicate_conversion_rule': offer_data.get('duplicate_conversion_rule', 'allow'),  # allow/deny/unique
                
                # SECTION 5: ACCESS & AFFILIATES
                'affiliates': offer_data.get('affiliates', 'all'),  # all/specific
                'access_type': offer_data.get('access_type', 'public'),  # public/private/request-only
                'selected_users': offer_data.get('selected_users', []),  # Specific affiliate list
                'manager': offer_data.get('manager', '').strip(),  # Campaign manager
                'approval_notes': offer_data.get('approval_notes', '').strip(),  # Access instructions
                
                # SECTION 6: CREATIVES & VISUALS
                'creative_type': offer_data.get('creative_type', 'image'),  # image/html/email
                'image_url': offer_data.get('image_url', '').strip(),
                'thumbnail_url': offer_data.get('thumbnail_url', '').strip(),
                'html_code': offer_data.get('html_code', '').strip(),  # HTML banner code
                'email_template': offer_data.get('email_template', '').strip(),  # Email HTML template
                'email_subject': offer_data.get('email_subject', '').strip(),  # Email subject line
                # Legacy fields (keeping for backward compatibility)
                'banner_codes': offer_data.get('banner_codes', []),  # HTML banner codes
                'email_creative': offer_data.get('email_creative', '').strip(),  # Email template
                'landing_page_variants': offer_data.get('landing_page_variants', []),  # LP variations
                'creative_category': offer_data.get('creative_category', 'banner'),  # banner/email/video
                
                # SECTION 7: SCHEDULE & EXPIRY
                'start_date': offer_data.get('start_date', ''),
                'expiration_date': offer_data.get('expiration_date', ''),
                'auto_expire_action': offer_data.get('auto_expire_action', 'pause'),  # pause/replace/redirect
                'fallback_url': offer_data.get('fallback_url', '').strip(),
                
                # SECTION 8: SMART RULES
                'random_redirect': offer_data.get('random_redirect', False),
                'redirect_urls': offer_data.get('redirect_urls', []),  # Alternate URLs
                'geo_redirect_rules': offer_data.get('geo_redirect_rules', {}),  # Country-specific URLs
                'rotation_enabled': offer_data.get('rotation_enabled', False),
                'leads_filter_enabled': offer_data.get('leads_filter_enabled', False),  # Mustache leads filter
                'rotation_rules': offer_data.get('rotation_rules', {}),  # Advanced rotation settings
                
                # SECTION 9: COMPLIANCE
                'allowed_traffic_types': offer_data.get('allowed_traffic_types', ['email', 'search', 'display']),
                'disallowed_traffic_types': offer_data.get('disallowed_traffic_types', ['adult', 'fraud']),
                'creative_approval_required': offer_data.get('creative_approval_required', False),
                'affiliate_terms': offer_data.get('affiliate_terms', '').strip(),  # Terms and conditions
                'brand_guidelines': offer_data.get('brand_guidelines', '').strip(),  # Brand guidelines
                'terms_notes': offer_data.get('terms_notes', '').strip(),
                
                # SECTION 10: INTEGRATIONS
                'network_partner': offer_data.get('network_partner', '').strip(),  # PepperAds/PepeLeads
                'network_short_description': offer_data.get('network_short_description', '').strip(),  # Brief description
                'external_offer_id': offer_data.get('external_offer_id', '').strip(),
                'sync_frequency': offer_data.get('sync_frequency', 'manual'),  # daily/weekly/manual
                'webhook_template': offer_data.get('webhook_template', '').strip(),  # Postback template
                'webhook_url': offer_data.get('webhook_url', '').strip(),
                
                # SECTION 11: REPORTING & MONITORING
                'hit_limit': offer_data.get('hit_limit'),  # Click limit
                'conversion_goal': offer_data.get('conversion_goal', 'lead'),  # lead/sale/install
                'quality_threshold': offer_data.get('quality_threshold'),  # CR threshold
                'validation_type': offer_data.get('validation_type', 'internal'),  # internal/external
                
                # SYSTEM FIELDS
                'hits': 0,  # Click counter
                'limit': offer_data.get('limit'),  # Overall limit
                'created_by': created_by,
                'created_at': datetime.utcnow(),
                'updated_at': datetime.utcnow(),
                'is_active': True
            }
            
            # Insert offer
            result = self.collection.insert_one(offer_doc)
            offer_doc['_id'] = str(result.inserted_id)
            
            return offer_doc, None
            
        except Exception as e:
            return None, f"Error creating offer: {str(e)}"
    
    def get_offers(self, filters=None, skip=0, limit=20):
        """Get offers with filtering and pagination"""
        if not self._check_db_connection():
            return [], 0
        
        try:
            query = {'is_active': True}
            
            if filters:
                if filters.get('status'):
                    query['status'] = filters['status']
                if filters.get('network'):
                    query['network'] = {'$regex': filters['network'], '$options': 'i'}
                if filters.get('search'):
                    search_regex = {'$regex': filters['search'], '$options': 'i'}
                    query['$or'] = [
                        {'name': search_regex},
                        {'campaign_id': search_regex},
                        {'offer_id': search_regex}
                    ]
            
            # Get total count
            total = self.collection.count_documents(query)
            
            # Get offers with pagination
            offers = list(self.collection.find(query)
                         .sort('created_at', -1)
                         .skip(skip)
                         .limit(limit))
            
            return offers, total
            
        except Exception as e:
            return [], 0
    
    def clone_offer(self, offer_id, created_by):
        """Clone an existing offer"""
        if not self._check_db_connection():
            return None, "Database connection not available"
        
        try:
            # Get original offer
            original_offer = self.collection.find_one({'offer_id': offer_id, 'is_active': True})
            if not original_offer:
                return None, "Original offer not found"
            
            # Generate new offer ID
            new_offer_id = self._get_next_offer_id()
            
            # Create cloned offer document
            cloned_offer_doc = {
                'offer_id': new_offer_id,
                'campaign_id': f"{original_offer['campaign_id']}-CLONE",
                'name': f"{original_offer['name']} (Clone)",
                'description': original_offer.get('description', ''),
                'status': 'pending',  # New clones start as pending
                'countries': original_offer.get('countries', []),
                'payout': original_offer['payout'],
                'network': original_offer['network'],
                'short_description': original_offer.get('short_description', ''),
                'affiliates': original_offer.get('affiliates', 'all'),
                'selected_users': original_offer.get('selected_users', []),
                'image_url': original_offer.get('image_url', ''),
                'thumbnail_url': original_offer.get('thumbnail_url', ''),
                'hash_code': original_offer.get('hash_code', ''),
                'hits': 0,  # Reset hits for clone
                'limit': original_offer.get('limit'),
                'target_url': original_offer['target_url'],
                'preview_url': original_offer.get('preview_url', ''),
                'expiration_date': original_offer.get('expiration_date'),
                'device_targeting': original_offer.get('device_targeting', 'all'),
                'created_by': created_by,
                'created_at': datetime.utcnow(),
                'updated_at': datetime.utcnow(),
                'is_active': True
            }
            
            # Insert cloned offer
            result = self.collection.insert_one(cloned_offer_doc)
            cloned_offer_doc['_id'] = str(result.inserted_id)
            
            return cloned_offer_doc, None
            
        except Exception as e:
            return None, f"Error cloning offer: {str(e)}"
    
    def get_offer_by_id(self, offer_id):
        """Get offer by offer_id (ML-00001 format)"""
        if not self._check_db_connection():
            return None
        
        try:
            return self.collection.find_one({'offer_id': offer_id, 'is_active': True})
        except:
            return None
    
    def update_offer(self, offer_id, update_data, updated_by):
        """Update an offer"""
        if not self._check_db_connection():
            return False, "Database connection not available"
        
        try:
            # Validate URL if provided
            if 'target_url' in update_data or 'preview_url' in update_data:
                url_pattern = re.compile(
                    r'^https?://'
                    r'(?:(?:[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?\.)+[A-Z]{2,6}\.?|'
                    r'localhost|'
                    r'\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})'
                    r'(?::\d+)?'
                    r'(?:/?|[/?]\S+)$', re.IGNORECASE)
                
                if 'target_url' in update_data and not url_pattern.match(update_data['target_url']):
                    return False, "Invalid target URL format"
                if 'preview_url' in update_data and update_data['preview_url'] and not url_pattern.match(update_data['preview_url']):
                    return False, "Invalid preview URL format"
            
            # Validate payout if provided
            if 'payout' in update_data:
                try:
                    update_data['payout'] = float(update_data['payout'])
                except (ValueError, TypeError):
                    return False, "Payout must be a valid number"
            
            update_data['updated_at'] = datetime.utcnow()
            update_data['updated_by'] = updated_by
            
            result = self.collection.update_one(
                {'offer_id': offer_id, 'is_active': True},
                {'$set': update_data}
            )
            
            return result.modified_count > 0, None
            
        except Exception as e:
            return False, f"Error updating offer: {str(e)}"
    
    def delete_offer(self, offer_id):
        """Soft delete an offer"""
        if not self._check_db_connection():
            return False
        
        try:
            result = self.collection.update_one(
                {'offer_id': offer_id},
                {'$set': {'is_active': False, 'updated_at': datetime.utcnow()}}
            )
            return result.modified_count > 0
        except:
            return False
    
    def increment_hits(self, offer_id):
        """Increment hit count for an offer"""
        if not self._check_db_connection():
            return False
        
        try:
            result = self.collection.update_one(
                {'offer_id': offer_id, 'is_active': True},
                {'$inc': {'hits': 1}}
            )
            return result.modified_count > 0
        except:
            return False
    
    def get_offer_settings(self, offer_id):
        """Get advanced settings for an offer"""
        if not self._check_db_connection():
            return None
        
        try:
            # Get settings from offer_settings collection
            settings = self.settings_collection.find_one({'offer_id': offer_id})
            
            if settings:
                # Remove MongoDB _id field
                settings.pop('_id', None)
                settings.pop('offer_id', None)
                return settings
            
            return None
            
        except Exception as e:
            import logging
            logging.error(f"Error getting offer settings: {str(e)}")
            return None
    
    def update_offer_settings(self, offer_id, settings):
        """Update advanced settings for an offer"""
        if not self._check_db_connection():
            return False, "Database connection not available"
        
        try:
            # Validate offer exists
            offer = self.collection.find_one({'offer_id': offer_id})
            if not offer:
                return False, "Offer not found"
            
            # Prepare settings document
            settings_doc = {
                'offer_id': offer_id,
                'updated_at': datetime.utcnow(),
                **settings
            }
            
            # Upsert settings (update if exists, insert if not)
            result = self.settings_collection.update_one(
                {'offer_id': offer_id},
                {'$set': settings_doc},
                upsert=True
            )
            
            return True, None
            
        except Exception as e:
            import logging
            logging.error(f"Error updating offer settings: {str(e)}")
            return False, f"Error updating offer settings: {str(e)}"
