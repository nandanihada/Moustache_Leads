"""
Promo Code Model
Handles creation, validation, and management of promotional codes
"""

from datetime import datetime, timedelta
from bson import ObjectId
from database import db_instance
import re
import logging

logger = logging.getLogger(__name__)


class PromoCode:
    def __init__(self):
        self.collection = db_instance.get_collection('promo_codes')
        self.user_promo_collection = db_instance.get_collection('user_promo_codes')
        self.bonus_earnings_collection = db_instance.get_collection('bonus_earnings')
        self.offers_collection = db_instance.get_collection('offers')
        self.users_collection = db_instance.get_collection('users')
    
    def _check_db_connection(self):
        """Check if database is connected and usable"""
        if self.collection is None or not db_instance.is_connected():
            return False
        
        try:
            self.collection.find_one({}, {'_id': 1})
            return True
        except Exception:
            return False
    
    def create_promo_code(self, code_data, created_by):
        """
        Create a new promo code
        
        Args:
            code_data: Dictionary with promo code details
            created_by: Admin user ID who created the code
            
        Returns:
            Tuple (promo_code_doc, error_message)
        """
        if not self._check_db_connection():
            return None, "Database connection not available"
        
        try:
            # Validate required fields
            required_fields = ['code', 'bonus_type', 'bonus_amount']
            for field in required_fields:
                if not code_data.get(field):
                    return None, f"Field '{field}' is required"
            
            # Validate code format (alphanumeric, 3-20 chars)
            code = code_data['code'].upper().strip()
            if not re.match(r'^[A-Z0-9]{3,20}$', code):
                return None, "Code must be 3-20 alphanumeric characters"
            
            # Check if code already exists
            if self.collection.find_one({'code': code}):
                return None, "Code already exists"
            
            # Validate bonus type
            bonus_type = code_data.get('bonus_type', '').lower()
            if bonus_type not in ['percentage', 'fixed']:
                return None, "Bonus type must be 'percentage' or 'fixed'"
            
            # Validate bonus amount
            try:
                bonus_amount = float(code_data['bonus_amount'])
                if bonus_amount <= 0:
                    return None, "Bonus amount must be greater than 0"
                if bonus_type == 'percentage' and bonus_amount > 100:
                    return None, "Percentage bonus cannot exceed 100%"
            except (ValueError, TypeError):
                return None, "Bonus amount must be a valid number"
            
            # Validate dates
            start_date = code_data.get('start_date')
            end_date = code_data.get('end_date')
            
            if start_date and end_date:
                if isinstance(start_date, str):
                    start_date = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
                if isinstance(end_date, str):
                    end_date = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
                
                if end_date <= start_date:
                    return None, "End date must be after start date"
            
            # Validate max uses
            max_uses = code_data.get('max_uses', 0)
            try:
                max_uses = int(max_uses)
                if max_uses < 0:
                    return None, "Max uses must be 0 or greater (0 = unlimited)"
            except (ValueError, TypeError):
                return None, "Max uses must be a valid number"
            
            # Validate max uses per user
            max_uses_per_user = code_data.get('max_uses_per_user', 1)
            try:
                max_uses_per_user = int(max_uses_per_user)
                if max_uses_per_user < 1:
                    return None, "Max uses per user must be at least 1"
            except (ValueError, TypeError):
                return None, "Max uses per user must be a valid number"
            
            # Validate min payout
            min_payout = code_data.get('min_payout', 0)
            try:
                min_payout = float(min_payout)
                if min_payout < 0:
                    return None, "Min payout must be 0 or greater"
            except (ValueError, TypeError):
                return None, "Min payout must be a valid number"
            
            # Create promo code document
            now = datetime.utcnow()
            default_start = now  # Today (immediately active)
            default_end = now + timedelta(days=30)  # 30 days from today
            
            promo_code_doc = {
                'code': code,
                'name': code_data.get('name', code).strip(),
                'description': code_data.get('description', '').strip(),
                'bonus_type': bonus_type,
                'bonus_amount': bonus_amount,
                'start_date': start_date if start_date else default_start,
                'end_date': end_date if end_date else default_end,
                'max_uses': max_uses,
                'max_uses_per_user': max_uses_per_user,
                'applicable_offers': code_data.get('applicable_offers', []),  # Empty = all offers
                'applicable_categories': code_data.get('applicable_categories', []),  # Empty = all
                'min_payout': min_payout,
                'status': 'active',  # active, paused, expired
                'created_by': str(created_by),
                'created_at': datetime.utcnow(),
                'updated_at': datetime.utcnow(),
                'usage_count': 0,
                'total_bonus_distributed': 0.0,
                # NEW: Time-based validity
                'active_hours': {
                    'enabled': code_data.get('active_hours', {}).get('enabled', False),
                    'start_time': code_data.get('active_hours', {}).get('start_time', '00:00'),
                    'end_time': code_data.get('active_hours', {}).get('end_time', '23:59'),
                    'timezone': code_data.get('active_hours', {}).get('timezone', 'UTC')
                },
                # NEW: Auto-deactivation
                'auto_deactivate_on_max_uses': code_data.get('auto_deactivate_on_max_uses', True)
            }
            
            # Insert promo code
            result = self.collection.insert_one(promo_code_doc)
            promo_code_doc['_id'] = str(result.inserted_id)
            
            logger.info(f"✅ Promo code '{code}' created successfully")
            return promo_code_doc, None
            
        except Exception as e:
            logger.error(f"❌ Error creating promo code: {str(e)}")
            return None, f"Error creating promo code: {str(e)}"
    
    def get_promo_code_by_code(self, code):
        """Get promo code by code string"""
        if not self._check_db_connection():
            return None
        
        try:
            code_obj = self.collection.find_one({'code': code.upper().strip()})
            if code_obj:
                code_obj['_id'] = str(code_obj['_id'])
            return code_obj
        except Exception as e:
            logger.error(f"Error fetching promo code: {str(e)}")
            return None
    
    def get_promo_code_by_id(self, code_id):
        """Get promo code by ID"""
        if not self._check_db_connection():
            return None
        
        try:
            code_obj = self.collection.find_one({'_id': ObjectId(code_id)})
            if code_obj:
                code_obj['_id'] = str(code_obj['_id'])
            return code_obj
        except Exception as e:
            logger.error(f"Error fetching promo code: {str(e)}")
            return None
    
    def validate_active_hours(self, code_obj):
        """
        Validate if code is within active hours
        
        Returns:
            Tuple (is_valid, error_message)
        """
        try:
            active_hours = code_obj.get('active_hours', {})
            
            # If active hours not enabled, always valid
            if not active_hours.get('enabled', False):
                return True, None
            
            # Get current time in the specified timezone
            from datetime import datetime
            import pytz
            
            timezone = active_hours.get('timezone', 'UTC')
            try:
                tz = pytz.timezone(timezone)
            except:
                tz = pytz.UTC
            
            now = datetime.now(tz)
            current_time = now.strftime('%H:%M')
            
            start_time = active_hours.get('start_time', '00:00')
            end_time = active_hours.get('end_time', '23:59')
            
            # Compare times
            if start_time <= current_time <= end_time:
                return True, None
            else:
                return False, f"Promo code is only valid between {start_time} and {end_time} {timezone}"
                
        except Exception as e:
            logger.error(f"Error validating active hours: {str(e)}")
            return True, None  # If error, don't block the code
    
    def validate_code_for_user(self, code, user_id, offer_id=None):
        """
        Validate if a code can be applied by a user for an offer
        
        Returns:
            Tuple (is_valid, error_message, code_data)
        """
        if not self._check_db_connection():
            return False, "Database connection not available", None
        
        try:
            # Get code
            code_obj = self.get_promo_code_by_code(code)
            if not code_obj:
                return False, "Promo code not found", None
            
            # Check if code is active
            if code_obj['status'] != 'active':
                return False, f"Promo code is {code_obj['status']}", None
            
            # Check if code has expired
            now = datetime.utcnow()
            if code_obj['end_date'] and now > code_obj['end_date']:
                return False, "Promo code has expired", None
            
            # Check if code has started
            if code_obj['start_date'] and now < code_obj['start_date']:
                return False, "Promo code is not yet active", None
            
            # Check max uses
            if code_obj['max_uses'] > 0 and code_obj['usage_count'] >= code_obj['max_uses']:
                return False, "Promo code has reached maximum uses", None
            
            # NEW: Check active hours
            is_valid_time, time_error = self.validate_active_hours(code_obj)
            if not is_valid_time:
                return False, time_error, None
            
            # Check if user already applied this code
            user_code = self.user_promo_collection.find_one({
                'user_id': ObjectId(user_id) if isinstance(user_id, str) else user_id,
                'promo_code_id': ObjectId(code_obj['_id']) if isinstance(code_obj['_id'], str) else code_obj['_id'],
                'is_active': True
            })
            
            if user_code:
                return False, "You have already applied this promo code", None
            
            # Check if applicable to offer (if offer_id provided)
            if offer_id:
                applicable_offers = code_obj.get('applicable_offers', [])
                if applicable_offers and offer_id not in applicable_offers:
                    return False, "This promo code is not applicable to this offer", None
            
            return True, None, code_obj
            
        except Exception as e:
            logger.error(f"Error validating promo code: {str(e)}")
            return False, f"Error validating code: {str(e)}", None
    
    def apply_code_to_user(self, code, user_id):
        """
        Apply a promo code to a user's account
        
        Returns:
            Tuple (user_promo_code_doc, error_message)
        """
        if not self._check_db_connection():
            return None, "Database connection not available"
        
        try:
            # Validate code
            is_valid, error_msg, code_obj = self.validate_code_for_user(code, user_id)
            if not is_valid:
                return None, error_msg
            
            # Create user promo code entry
            user_promo_doc = {
                'user_id': ObjectId(user_id) if isinstance(user_id, str) else user_id,
                'promo_code_id': ObjectId(code_obj['_id']) if isinstance(code_obj['_id'], str) else code_obj['_id'],
                'code': code.upper().strip(),
                'applied_at': datetime.utcnow(),
                'expires_at': code_obj['end_date'],
                'is_active': True,
                'total_bonus_earned': 0.0,
                'conversions_count': 0,
                'last_used_at': None,
                # NEW: Track offer applications
                'offer_applications': []
            }
            
            result = self.user_promo_collection.insert_one(user_promo_doc)
            user_promo_doc['_id'] = str(result.inserted_id)
            
            # Update user's active_promo_codes array
            self.users_collection.update_one(
                {'_id': ObjectId(user_id) if isinstance(user_id, str) else user_id},
                {
                    '$addToSet': {'active_promo_codes': code.upper().strip()},
                    '$set': {'updated_at': datetime.utcnow()}
                }
            )
            
            # Increment usage_count in promo_codes collection
            self.collection.update_one(
                {'_id': ObjectId(code_obj['_id']) if isinstance(code_obj['_id'], str) else code_obj['_id']},
                {
                    '$inc': {'usage_count': 1},
                    '$set': {'updated_at': datetime.utcnow()}
                }
            )
            
            # Check if code should be auto-deactivated
            self.check_and_deactivate(code_obj['_id'])
            
            logger.info(f"✅ Promo code '{code}' applied to user {user_id}")
            return user_promo_doc, None
            
        except Exception as e:
            logger.error(f"❌ Error applying promo code: {str(e)}")
            return None, f"Error applying code: {str(e)}"
    
    def calculate_bonus(self, base_earning, code_obj):
        """
        Calculate bonus amount based on code settings
        
        Args:
            base_earning: Original earning amount
            code_obj: Promo code object
            
        Returns:
            Tuple (bonus_amount, total_earning)
        """
        try:
            base_earning = float(base_earning)
            bonus_amount = 0.0
            
            if code_obj['bonus_type'] == 'percentage':
                bonus_amount = (base_earning * code_obj['bonus_amount']) / 100
            else:  # fixed
                bonus_amount = code_obj['bonus_amount']
            
            total_earning = base_earning + bonus_amount
            return bonus_amount, total_earning
            
        except Exception as e:
            logger.error(f"Error calculating bonus: {str(e)}")
            return 0.0, base_earning
    
    def record_bonus_earning(self, user_id, promo_code_id, offer_id, conversion_id, base_earning, bonus_amount):
        """
        Record a bonus earning transaction
        
        Returns:
            Tuple (bonus_earning_doc, error_message)
        """
        if not self._check_db_connection():
            return None, "Database connection not available"
        
        try:
            code_obj = self.get_promo_code_by_id(promo_code_id)
            if not code_obj:
                return None, "Promo code not found"
            
            bonus_earning_doc = {
                'user_id': ObjectId(user_id) if isinstance(user_id, str) else user_id,
                'promo_code_id': ObjectId(promo_code_id) if isinstance(promo_code_id, str) else promo_code_id,
                'offer_id': ObjectId(offer_id) if isinstance(offer_id, str) else offer_id,
                'conversion_id': ObjectId(conversion_id) if isinstance(conversion_id, str) else conversion_id,
                'base_earning': float(base_earning),
                'bonus_amount': float(bonus_amount),
                'bonus_type': code_obj['bonus_type'],
                'total_earning': float(base_earning) + float(bonus_amount),
                'created_at': datetime.utcnow(),
                'status': 'pending'  # pending, credited, reversed
            }
            
            result = self.bonus_earnings_collection.insert_one(bonus_earning_doc)
            bonus_earning_doc['_id'] = str(result.inserted_id)
            
            # Update user promo code stats
            self.user_promo_collection.update_one(
                {'promo_code_id': ObjectId(promo_code_id) if isinstance(promo_code_id, str) else promo_code_id,
                 'user_id': ObjectId(user_id) if isinstance(user_id, str) else user_id},
                {
                    '$inc': {
                        'total_bonus_earned': float(bonus_amount),
                        'conversions_count': 1
                    },
                    '$set': {'last_used_at': datetime.utcnow()}
                }
            )
            
            # Update promo code stats
            self.collection.update_one(
                {'_id': ObjectId(promo_code_id) if isinstance(promo_code_id, str) else promo_code_id},
                {
                    '$inc': {
                        'usage_count': 1,
                        'total_bonus_distributed': float(bonus_amount)
                    }
                }
            )
            
            # NEW: Check and auto-deactivate if max uses reached
            self.check_and_deactivate(promo_code_id)
            
            # NEW: Track offer application
            try:
                # Get offer name
                offer = self.offers_collection.find_one({'_id': ObjectId(offer_id) if isinstance(offer_id, str) else offer_id})
                offer_name = offer.get('name', 'Unknown Offer') if offer else 'Unknown Offer'
                
                self.add_offer_application(
                    user_id=user_id,
                    promo_code_id=promo_code_id,
                    offer_id=offer_id,
                    offer_name=offer_name,
                    bonus_amount=bonus_amount,
                    conversion_id=conversion_id
                )
            except Exception as e:
                logger.error(f"Error tracking offer application: {str(e)}")
            
            logger.info(f"✅ Bonus earning recorded: ${bonus_amount} for user {user_id}")
            return bonus_earning_doc, None
            
        except Exception as e:
            logger.error(f"❌ Error recording bonus earning: {str(e)}")
            return None, f"Error recording bonus: {str(e)}"
    
    def check_and_deactivate(self, code_id):
        """
        Check if promo code should be auto-deactivated based on max uses
        
        Returns:
            Boolean indicating if code was deactivated
        """
        if not self._check_db_connection():
            return False
        
        try:
            code_obj = self.get_promo_code_by_id(code_id)
            if not code_obj:
                return False
            
            # Check if auto-deactivation is enabled
            if not code_obj.get('auto_deactivate_on_max_uses', True):
                return False
            
            # Check if max uses is set and reached
            max_uses = code_obj.get('max_uses', 0)
            usage_count = code_obj.get('usage_count', 0)
            
            if max_uses > 0 and usage_count >= max_uses:
                # Deactivate the code
                self.collection.update_one(
                    {'_id': ObjectId(code_id) if isinstance(code_id, str) else code_id},
                    {
                        '$set': {
                            'status': 'expired',
                            'updated_at': datetime.utcnow(),
                            'auto_deactivated_at': datetime.utcnow()
                        }
                    }
                )
                logger.info(f"🔒 Promo code {code_obj['code']} auto-deactivated after reaching {max_uses} uses")
                return True
            
            return False
            
        except Exception as e:
            logger.error(f"Error checking auto-deactivation: {str(e)}")
            return False
    
    def add_offer_application(self, user_id, promo_code_id, offer_id, offer_name, bonus_amount, conversion_id=None):
        """
        Track when a user uses a promo code on a specific offer
        
        Args:
            user_id: User ID
            promo_code_id: Promo code ID
            offer_id: Offer ID
            offer_name: Offer name
            bonus_amount: Bonus earned
            conversion_id: Conversion ID (optional)
            
        Returns:
            Boolean indicating success
        """
        if not self._check_db_connection():
            return False
        
        try:
            application_entry = {
                'offer_id': str(offer_id),
                'offer_name': offer_name,
                'applied_at': datetime.utcnow(),
                'bonus_earned': float(bonus_amount),
                'conversion_id': str(conversion_id) if conversion_id else None
            }
            
            # Add to user_promo_codes.offer_applications array
            result = self.user_promo_collection.update_one(
                {
                    'user_id': ObjectId(user_id) if isinstance(user_id, str) else user_id,
                    'promo_code_id': ObjectId(promo_code_id) if isinstance(promo_code_id, str) else promo_code_id,
                    'is_active': True
                },
                {
                    '$push': {'offer_applications': application_entry},
                    '$set': {'last_used_at': datetime.utcnow()}
                }
            )
            
            if result.modified_count > 0:
                logger.info(f"✅ Tracked offer application: User {user_id} used promo on offer {offer_name}")
                return True
            else:
                logger.warning(f"⚠️ Could not track offer application for user {user_id}")
                return False
                
        except Exception as e:
            logger.error(f"Error tracking offer application: {str(e)}")
            return False
    
    def get_user_active_codes(self, user_id):
        """Get all active promo codes for a user"""
        if not self._check_db_connection():
            return []
        
        try:
            codes = list(self.user_promo_collection.find({
                'user_id': ObjectId(user_id) if isinstance(user_id, str) else user_id,
                'is_active': True
            }).sort('applied_at', -1))
            
            for code in codes:
                code['_id'] = str(code['_id'])
                code['promo_code_id'] = str(code['promo_code_id'])
                code['user_id'] = str(code['user_id'])
            
            return codes
        except Exception as e:
            logger.error(f"Error fetching user active codes: {str(e)}")
            return []
    
    def get_available_codes(self, skip=0, limit=20):
        """Get all available promo codes (active and not expired)"""
        if not self._check_db_connection():
            return [], 0
        
        try:
            now = datetime.utcnow()
            
            # Auto-expire codes that have passed their end_date
            self.collection.update_many(
                {
                    'status': 'active',
                    'end_date': {'$lt': now}
                },
                {
                    '$set': {
                        'status': 'expired',
                        'updated_at': now
                    }
                }
            )
            
            query = {
                'status': 'active',
                'start_date': {'$lte': now},
                'end_date': {'$gte': now}
            }
            
            total = self.collection.count_documents(query)
            codes = list(self.collection.find(query)
                        .sort('created_at', -1)
                        .skip(skip)
                        .limit(limit))
            
            for code in codes:
                code['_id'] = str(code['_id'])
                code['created_by'] = str(code['created_by'])
            
            return codes, total
        except Exception as e:
            logger.error(f"Error fetching available codes: {str(e)}")
            return [], 0
    
    def update_promo_code(self, code_id, update_data, updated_by):
        """Update a promo code (only if not used yet)"""
        if not self._check_db_connection():
            return False, "Database connection not available"
        
        try:
            code_obj = self.get_promo_code_by_id(code_id)
            if not code_obj:
                return False, "Promo code not found"
            
            # Can't edit if code has been used
            if code_obj['usage_count'] > 0:
                return False, "Cannot edit a code that has already been used"
            
            # Prepare update document
            update_doc = {
                'updated_at': datetime.utcnow(),
                'updated_by': str(updated_by)
            }
            
            # Update allowed fields
            allowed_fields = ['name', 'description', 'status', 'max_uses', 'applicable_offers', 'applicable_categories']
            for field in allowed_fields:
                if field in update_data:
                    update_doc[field] = update_data[field]
            
            result = self.collection.update_one(
                {'_id': ObjectId(code_id)},
                {'$set': update_doc}
            )
            
            return result.modified_count > 0, None
            
        except Exception as e:
            logger.error(f"Error updating promo code: {str(e)}")
            return False, f"Error updating code: {str(e)}"
    
    def pause_promo_code(self, code_id):
        """Pause a promo code"""
        if not self._check_db_connection():
            return False, "Database connection not available"
        
        try:
            result = self.collection.update_one(
                {'_id': ObjectId(code_id)},
                {'$set': {'status': 'paused', 'updated_at': datetime.utcnow()}}
            )
            return result.modified_count > 0, None
        except Exception as e:
            logger.error(f"Error pausing promo code: {str(e)}")
            return False, f"Error pausing code: {str(e)}"
    
    def resume_promo_code(self, code_id):
        """Resume a paused promo code"""
        if not self._check_db_connection():
            return False, "Database connection not available"
        
        try:
            result = self.collection.update_one(
                {'_id': ObjectId(code_id)},
                {'$set': {'status': 'active', 'updated_at': datetime.utcnow()}}
            )
            return result.modified_count > 0, None
        except Exception as e:
            logger.error(f"Error resuming promo code: {str(e)}")
            return False, f"Error resuming code: {str(e)}"
    
    def get_promo_code_analytics(self, code_id):
        """Get analytics for a promo code"""
        if not self._check_db_connection():
            return None
        
        try:
            code_obj = self.get_promo_code_by_id(code_id)
            if not code_obj:
                return None
            
            # Get users who applied this code
            users_applied = self.user_promo_collection.count_documents({
                'promo_code_id': ObjectId(code_id)
            })
            
            # Get total bonus earnings from this code
            bonus_earnings = list(self.bonus_earnings_collection.aggregate([
                {'$match': {'promo_code_id': ObjectId(code_id)}},
                {'$group': {
                    '_id': None,
                    'total_bonus': {'$sum': '$bonus_amount'},
                    'total_conversions': {'$sum': 1},
                    'avg_bonus': {'$avg': '$bonus_amount'}
                }}
            ]))
            
            analytics = {
                'code': code_obj['code'],
                'total_uses': code_obj['usage_count'],
                'users_applied': users_applied,
                'total_bonus_distributed': code_obj['total_bonus_distributed'],
                'status': code_obj['status'],
                'created_at': code_obj['created_at'],
                'end_date': code_obj['end_date']
            }
            
            if bonus_earnings:
                analytics.update({
                    'total_conversions': int(bonus_earnings[0]['total_conversions']),
                    'avg_bonus_per_conversion': bonus_earnings[0]['avg_bonus']
                })
            
            return analytics
            
        except Exception as e:
            logger.error(f"Error getting promo code analytics: {str(e)}")
            return None
    
    def get_offer_analytics(self, code_id):
        """
        Get breakdown of which offers a promo code was used on
        
        Returns:
            Dictionary with offer breakdown
        """
        if not self._check_db_connection():
            return None
        
        try:
            code_obj = self.get_promo_code_by_id(code_id)
            if not code_obj:
                return None
            
            # Aggregate bonus earnings by offer
            offer_breakdown = list(self.bonus_earnings_collection.aggregate([
                {'$match': {'promo_code_id': ObjectId(code_id) if isinstance(code_id, str) else code_id}},
                {'$group': {
                    '_id': '$offer_id',
                    'uses': {'$sum': 1},
                    'total_bonus': {'$sum': '$bonus_amount'},
                    'users': {'$addToSet': '$user_id'}
                }},
                {'$sort': {'uses': -1}}
            ]))
            
            # Enrich with offer names
            for item in offer_breakdown:
                offer = self.offers_collection.find_one({'_id': item['_id']})
                item['offer_id'] = str(item['_id'])
                item['offer_name'] = offer.get('name', 'Unknown Offer') if offer else 'Unknown Offer'
                item['unique_users'] = len(item['users'])
                del item['_id']
                del item['users']
            
            return {
                'code': code_obj['code'],
                'total_uses': code_obj['usage_count'],
                'offer_breakdown': offer_breakdown
            }
            
        except Exception as e:
            logger.error(f"Error getting offer analytics: {str(e)}")
            return None
    
    def get_user_applications(self, code_id, skip=0, limit=20):
        """
        Get detailed list of user applications with offer information
        
        Returns:
            Tuple (applications_list, total_count)
        """
        if not self._check_db_connection():
            return [], 0
        
        try:
            # Get all ACTIVE user_promo_codes for this promo code
            user_promos = list(self.user_promo_collection.find({
                'promo_code_id': ObjectId(code_id) if isinstance(code_id, str) else code_id,
                'is_active': True  # Only show active applications
            }).skip(skip).limit(limit))
            
            total = self.user_promo_collection.count_documents({
                'promo_code_id': ObjectId(code_id) if isinstance(code_id, str) else code_id,
                'is_active': True  # Only count active applications
            })
            
            applications = []
            
            for user_promo in user_promos:
                # Get user details
                user = self.users_collection.find_one({'_id': user_promo['user_id']})
                
                # Get offer applications for this user
                offer_apps = user_promo.get('offer_applications', [])
                
                if offer_apps:
                    # User has used code on specific offers
                    for app in offer_apps:
                        applications.append({
                            'user_id': str(user_promo['user_id']),
                            'username': user.get('username', 'Unknown') if user else 'Unknown',
                            'email': user.get('email', '') if user else '',
                            'offer_id': app.get('offer_id'),
                            'offer_name': app.get('offer_name'),
                            'applied_at': app.get('applied_at'),
                            'bonus_earned': app.get('bonus_earned', 0),
                            'conversion_id': app.get('conversion_id')
                        })
                else:
                    # User applied code but hasn't used it on any offer yet
                    applications.append({
                        'user_id': str(user_promo['user_id']),
                        'username': user.get('username', 'Unknown') if user else 'Unknown',
                        'email': user.get('email', '') if user else '',
                        'offer_id': None,
                        'offer_name': 'Not used yet',
                        'applied_at': user_promo.get('applied_at'),
                        'bonus_earned': 0,
                        'conversion_id': None
                    })
            
            return applications, total
            
        except Exception as e:
            logger.error(f"Error getting user applications: {str(e)}")
            return [], 0
