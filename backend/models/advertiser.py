"""Advertiser model - separate from Publisher users"""
from database import db_instance
from bson import ObjectId
import bcrypt
from datetime import datetime
import logging
import re

class Advertiser:
    """Model for advertiser accounts - separate from Publisher users"""
    
    def __init__(self):
        self.collection = db_instance.get_collection('advertisers')
    
    def _check_db_connection(self):
        """Check if database is connected"""
        return db_instance.is_connected()
    
    def create_advertiser(self, data: dict) -> tuple:
        """Create a new advertiser account"""
        try:
            if not self._check_db_connection():
                return None, "Database connection failed"
            
            # Check if email already exists
            if self.collection.find_one({'email': data.get('email', '').lower()}):
                return None, "An account with this email already exists"
            
            # Hash password
            password = data.get('password', '')
            if len(password) < 6:
                return None, "Password must be at least 6 characters"
            
            hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())
            
            # Create advertiser document
            advertiser_doc = {
                # General Info
                'first_name': data.get('firstName', '').strip(),
                'last_name': data.get('lastName', '').strip(),
                'email': data.get('email', '').lower().strip(),
                'phone_number': data.get('phoneNumber', '').strip(),
                'password': hashed_password,
                
                # Company Info
                'company_name': data.get('companyName', '').strip(),
                'website_url': data.get('websiteUrl', '').strip(),
                'offer_landing_page': data.get('offerLandingPage', '').strip(),
                
                # Address
                'address': data.get('address', '').strip(),
                'apartment': data.get('apartment', '').strip(),
                'country': data.get('country', '').strip(),
                'city': data.get('city', '').strip(),
                'zip_code': data.get('zipCode', '').strip(),
                
                # Accounting
                'accounting_contact_name': data.get('accountingContactName', '').strip(),
                'accounting_contact_role': data.get('accountingContactRole', '').strip(),
                'accounting_contact_number': data.get('accountingContactNumber', '').strip(),
                'accounting_contact_email': data.get('accountingContactEmail', '').strip(),
                'payment_agreement': data.get('paymentAgreement', '').strip(),
                'payment_terms': data.get('paymentTerms', '').strip(),
                
                # Additional
                'references': data.get('references', []),
                'no_minimum_threshold_agreed': data.get('noMinimumThresholdAgreed', False),
                'ein_vat_number': data.get('einVatNumber', '').strip(),
                
                # Terms
                'terms_agreed': data.get('termsAgreed', False),
                'terms_agreed_at': datetime.utcnow() if data.get('termsAgreed') else None,
                
                # Metadata
                'created_at': datetime.utcnow(),
                'updated_at': datetime.utcnow(),
                'is_active': True,
                'email_verified': False,
                'account_status': 'pending_approval',
                'user_type': 'advertiser'
            }
            
            result = self.collection.insert_one(advertiser_doc)
            advertiser_doc['_id'] = result.inserted_id
            
            logging.info(f"✅ Advertiser created: {advertiser_doc['email']}")
            return advertiser_doc, None
            
        except Exception as e:
            logging.error(f"Error creating advertiser: {str(e)}")
            return None, f"Failed to create advertiser: {str(e)}"
    
    def find_by_email(self, email: str) -> dict:
        """Find advertiser by email"""
        try:
            if not self._check_db_connection():
                return None
            return self.collection.find_one({'email': email.lower().strip()})
        except Exception as e:
            logging.error(f"Error finding advertiser by email: {str(e)}")
            return None
    
    def find_by_id(self, advertiser_id: str) -> dict:
        """Find advertiser by ID"""
        try:
            if not self._check_db_connection():
                return None
            return self.collection.find_one({'_id': ObjectId(advertiser_id)})
        except Exception as e:
            logging.error(f"Error finding advertiser by ID: {str(e)}")
            return None
    
    def verify_password(self, email: str, password: str) -> dict:
        """Verify advertiser credentials"""
        try:
            advertiser = self.find_by_email(email)
            if not advertiser:
                return None
            
            if bcrypt.checkpw(password.encode('utf-8'), advertiser['password']):
                return advertiser
            return None
        except Exception as e:
            logging.error(f"Error verifying advertiser password: {str(e)}")
            return None
    
    def update_advertiser(self, advertiser_id: str, data: dict) -> bool:
        """Update advertiser data"""
        try:
            if not self._check_db_connection():
                return False
            
            data['updated_at'] = datetime.utcnow()
            result = self.collection.update_one(
                {'_id': ObjectId(advertiser_id)},
                {'$set': data}
            )
            return result.modified_count > 0
        except Exception as e:
            logging.error(f"Error updating advertiser: {str(e)}")
            return False
    
    def mark_email_verified(self, advertiser_id: str) -> bool:
        """Mark advertiser email as verified"""
        return self.update_advertiser(advertiser_id, {'email_verified': True})
