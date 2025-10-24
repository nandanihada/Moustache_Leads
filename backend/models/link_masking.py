from datetime import datetime
from bson import ObjectId
from database import db_instance
import secrets
import string
import re

class LinkMasking:
    def __init__(self):
        self.collection = db_instance.get_collection('masked_links')
        self.domains_collection = db_instance.get_collection('masking_domains')
        self.counter_collection = db_instance.get_collection('counters')
    
    def _check_db_connection(self):
        """Check if database is connected and usable"""
        if self.collection is None or not db_instance.is_connected():
            return False
        
        try:
            self.collection.find_one({}, {'_id': 1})
            return True
        except Exception:
            return False
    
    def _generate_short_code(self, length=8):
        """Generate a random short code for masking"""
        characters = string.ascii_letters + string.digits
        return ''.join(secrets.choice(characters) for _ in range(length))
    
    def _get_next_sequence_id(self):
        """Generate next auto-increment sequence ID"""
        if not self._check_db_connection():
            return 1
        
        try:
            result = self.counter_collection.find_one_and_update(
                {'_id': 'masked_link_sequence'},
                {'$inc': {'sequence_value': 1}},
                upsert=True,
                return_document=True
            )
            return result['sequence_value']
        except Exception:
            return 1
    
    def create_masked_link(self, offer_id, target_url, masking_settings, created_by):
        """Create a masked link for an offer"""
        if not self._check_db_connection():
            return None, "Database connection not available"
        
        try:
            # Validate target URL
            url_pattern = re.compile(
                r'^https?://'
                r'(?:(?:[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?\.)+[A-Z]{2,6}\.?|'
                r'localhost|'
                r'\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})'
                r'(?::\d+)?'
                r'(?:/?|[/?]\S+)$', re.IGNORECASE)
            
            if not url_pattern.match(target_url):
                return None, "Invalid target URL format"
            
            # Get masking domain
            domain = self.get_masking_domain(masking_settings.get('domain_id'))
            if not domain:
                return None, "Invalid masking domain"
            
            # Generate short code or use custom
            if masking_settings.get('use_custom_code') and masking_settings.get('custom_code'):
                short_code = masking_settings['custom_code']
                # Check if custom code already exists
                existing = self.collection.find_one({'short_code': short_code, 'domain_id': domain['_id']})
                if existing:
                    return None, f"Custom code '{short_code}' already exists for this domain"
            else:
                # Generate unique short code
                attempts = 0
                while attempts < 10:
                    short_code = self._generate_short_code(masking_settings.get('code_length', 8))
                    existing = self.collection.find_one({'short_code': short_code, 'domain_id': domain['_id']})
                    if not existing:
                        break
                    attempts += 1
                
                if attempts >= 10:
                    return None, "Failed to generate unique short code"
            
            # Generate sequence ID
            sequence_id = self._get_next_sequence_id()
            
            # Create masked link document
            masked_link = {
                'sequence_id': sequence_id,
                'offer_id': offer_id,
                'short_code': short_code,
                'target_url': target_url,
                'domain_id': domain['_id'],
                'domain_name': domain['domain'],
                'masked_url': f"https://{domain['domain']}/{short_code}",
                'redirect_type': masking_settings.get('redirect_type', '302'),
                'subid_append': masking_settings.get('subid_append', True),
                'preview_mode': masking_settings.get('preview_mode', False),
                'auto_rotation': masking_settings.get('auto_rotation', False),
                'rotation_urls': masking_settings.get('rotation_urls', []),
                'click_count': 0,
                'unique_clicks': 0,
                'last_clicked': None,
                'status': 'active',
                'created_by': created_by,
                'created_at': datetime.utcnow(),
                'updated_at': datetime.utcnow(),
                'is_active': True
            }
            
            # Insert masked link
            result = self.collection.insert_one(masked_link)
            masked_link['_id'] = result.inserted_id
            
            return masked_link, None
            
        except Exception as e:
            return None, f"Error creating masked link: {str(e)}"
    
    def get_masked_links(self, filters=None, skip=0, limit=50):
        """Get masked links with optional filtering"""
        if not self._check_db_connection():
            return [], 0
        
        try:
            query = {'is_active': True}
            
            if filters:
                if filters.get('offer_id'):
                    query['offer_id'] = filters['offer_id']
                if filters.get('domain_id'):
                    query['domain_id'] = ObjectId(filters['domain_id'])
                if filters.get('status'):
                    query['status'] = filters['status']
                if filters.get('search'):
                    search_regex = {'$regex': filters['search'], '$options': 'i'}
                    query['$or'] = [
                        {'short_code': search_regex},
                        {'offer_id': search_regex},
                        {'target_url': search_regex}
                    ]
            
            # Get total count
            total = self.collection.count_documents(query)
            
            # Get masked links with pagination
            links = list(self.collection.find(query)
                        .sort('created_at', -1)
                        .skip(skip)
                        .limit(limit))
            
            return links, total
            
        except Exception as e:
            return [], 0
    
    def get_masked_link_by_code(self, short_code, domain_name):
        """Get masked link by short code and domain"""
        if not self._check_db_connection():
            return None
        
        try:
            return self.collection.find_one({
                'short_code': short_code,
                'domain_name': domain_name,
                'is_active': True,
                'status': 'active'
            })
        except:
            return None
    
    def update_masked_link(self, link_id, update_data, updated_by):
        """Update a masked link"""
        if not self._check_db_connection():
            return False, "Database connection not available"
        
        try:
            update_data['updated_at'] = datetime.utcnow()
            update_data['updated_by'] = updated_by
            
            result = self.collection.update_one(
                {'_id': ObjectId(link_id), 'is_active': True},
                {'$set': update_data}
            )
            
            return result.modified_count > 0, None
            
        except Exception as e:
            return False, f"Error updating masked link: {str(e)}"
    
    def increment_click_count(self, link_id, is_unique=False):
        """Increment click count for a masked link"""
        if not self._check_db_connection():
            return False
        
        try:
            update_data = {
                '$inc': {'click_count': 1},
                '$set': {'last_clicked': datetime.utcnow()}
            }
            
            if is_unique:
                update_data['$inc']['unique_clicks'] = 1
            
            result = self.collection.update_one(
                {'_id': ObjectId(link_id)},
                update_data
            )
            
            return result.modified_count > 0
        except:
            return False
    
    def delete_masked_link(self, link_id):
        """Soft delete a masked link"""
        if not self._check_db_connection():
            return False
        
        try:
            result = self.collection.update_one(
                {'_id': ObjectId(link_id)},
                {'$set': {'is_active': False, 'updated_at': datetime.utcnow()}}
            )
            return result.modified_count > 0
        except:
            return False
    
    # Domain Management Methods
    
    def create_masking_domain(self, domain_data, created_by):
        """Create a new masking domain"""
        if not self._check_db_connection():
            return None, "Database connection not available"
        
        try:
            # Validate domain format
            domain_pattern = re.compile(
                r'^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$'
            )
            
            if not domain_pattern.match(domain_data['domain']):
                return None, "Invalid domain format"
            
            # Check if domain already exists
            existing = self.domains_collection.find_one({'domain': domain_data['domain']})
            if existing:
                return None, "Domain already exists"
            
            domain_doc = {
                'domain': domain_data['domain'].lower(),
                'name': domain_data.get('name', domain_data['domain']),
                'description': domain_data.get('description', ''),
                'ssl_enabled': domain_data.get('ssl_enabled', True),
                'default_redirect_type': domain_data.get('default_redirect_type', '302'),
                'status': domain_data.get('status', 'active'),
                'priority': domain_data.get('priority', 1),
                'created_by': created_by,
                'created_at': datetime.utcnow(),
                'updated_at': datetime.utcnow(),
                'is_active': True
            }
            
            result = self.domains_collection.insert_one(domain_doc)
            domain_doc['_id'] = result.inserted_id
            
            return domain_doc, None
            
        except Exception as e:
            return None, f"Error creating domain: {str(e)}"
    
    def get_masking_domains(self, active_only=True):
        """Get all masking domains"""
        if not self._check_db_connection():
            return []
        
        try:
            query = {}
            if active_only:
                query['is_active'] = True
                query['status'] = 'active'
            
            domains = list(self.domains_collection.find(query).sort('priority', 1))
            return domains
            
        except Exception:
            return []
    
    def get_masking_domain(self, domain_id):
        """Get a specific masking domain"""
        if not self._check_db_connection():
            return None
        
        try:
            return self.domains_collection.find_one({
                '_id': ObjectId(domain_id),
                'is_active': True
            })
        except:
            return None
    
    def update_masking_domain(self, domain_id, update_data, updated_by):
        """Update a masking domain"""
        if not self._check_db_connection():
            return False, "Database connection not available"
        
        try:
            update_data['updated_at'] = datetime.utcnow()
            update_data['updated_by'] = updated_by
            
            result = self.domains_collection.update_one(
                {'_id': ObjectId(domain_id), 'is_active': True},
                {'$set': update_data}
            )
            
            return result.modified_count > 0, None
            
        except Exception as e:
            return False, f"Error updating domain: {str(e)}"
    
    def delete_masking_domain(self, domain_id):
        """Soft delete a masking domain"""
        if not self._check_db_connection():
            return False
        
        try:
            result = self.domains_collection.update_one(
                {'_id': ObjectId(domain_id)},
                {'$set': {'is_active': False, 'updated_at': datetime.utcnow()}}
            )
            return result.modified_count > 0
        except:
            return False
