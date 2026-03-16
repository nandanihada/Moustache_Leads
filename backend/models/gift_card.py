"""
Gift Card Model
Handles creation, assignment, email sending, and redemption of gift cards
"""

from datetime import datetime
from bson import ObjectId
from database import db_instance
import logging
import secrets
import string

logger = logging.getLogger(__name__)


class GiftCard:
    def __init__(self):
        self.collection = db_instance.get_collection('gift_cards')
        self.redemptions_collection = db_instance.get_collection('gift_card_redemptions')
        self.users_collection = db_instance.get_collection('users')
        self.advertisers_collection = db_instance.get_collection('advertisers')
    
    def _check_db_connection(self):
        """Check if database is connected and usable"""
        if self.collection is None or not db_instance.is_connected():
            return False
        
        try:
            self.collection.find_one({}, {'_id': 1})
            return True
        except Exception:
            return False
    
    def generate_unique_code(self, prefix="GIFT", length=8):
        """
        Generate a unique gift card code
        
        Args:
            prefix: Code prefix (default: "GIFT")
            length: Length of random part (default: 8)
            
        Returns:
            Unique code string
        """
        while True:
            # Generate random alphanumeric string
            random_part = ''.join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(length))
            code = f"{prefix}{random_part}"
            
            # Check if code already exists
            if not self.collection.find_one({'code': code}):
                return code
    
    def create_gift_card(self, gift_card_data, created_by):
        """
        Create a new gift card (First-Come-First-Served Model)
        
        Args:
            gift_card_data: Dictionary with gift card details
                - name: Gift card name/title
                - description: Optional description
                - amount: Credit amount
                - image_url: Gift card image URL
                - expiry_date: Expiration date
                - max_redemptions: Maximum number of users who can redeem (e.g., 10, 15, 20)
                - send_to_all: Boolean - send to all users or specific users
                - excluded_users: List of user IDs to exclude from email
                - code: Optional custom code (auto-generated if not provided)
            created_by: Admin user ID who created the gift card
            
        Returns:
            Tuple (gift_card_doc, error_message)
        """
        if not self._check_db_connection():
            return None, "Database connection not available"
        
        try:
            # Validate required fields
            required_fields = ['name', 'amount', 'max_redemptions']
            for field in required_fields:
                if not gift_card_data.get(field):
                    return None, f"Field '{field}' is required"
            
            # Validate amount
            try:
                amount = float(gift_card_data['amount'])
                if amount <= 0:
                    return None, "Amount must be greater than 0"
            except (ValueError, TypeError):
                return None, "Amount must be a valid number"
            
            # Validate max_redemptions
            try:
                max_redemptions = int(gift_card_data['max_redemptions'])
                if max_redemptions <= 0:
                    return None, "Max redemptions must be greater than 0"
            except (ValueError, TypeError):
                return None, "Max redemptions must be a valid number"
            
            # Generate or validate code
            code = gift_card_data.get('code')
            if code:
                code = code.upper().strip()
                # Check if code already exists
                if self.collection.find_one({'code': code}):
                    return None, "Code already exists"
            else:
                code = self.generate_unique_code()
            
            # Validate expiry date
            expiry_date = gift_card_data.get('expiry_date')
            if expiry_date:
                if isinstance(expiry_date, str):
                    expiry_date = datetime.fromisoformat(expiry_date.replace('Z', '+00:00'))
                    # Remove timezone info to make it naive (for comparison with utcnow)
                    expiry_date = expiry_date.replace(tzinfo=None)
                
                if expiry_date <= datetime.utcnow():
                    return None, "Expiry date must be in the future"
            else:
                # Default: 30 days from now
                from datetime import timedelta
                expiry_date = datetime.utcnow() + timedelta(days=30)
            
            # Get excluded users
            excluded_users = gift_card_data.get('excluded_users', [])
            if not isinstance(excluded_users, list):
                return None, "excluded_users must be a list"
            
            # Convert excluded user IDs to ObjectId
            excluded_user_ids = []
            for user_id in excluded_users:
                try:
                    excluded_user_ids.append(ObjectId(user_id) if isinstance(user_id, str) else user_id)
                except Exception:
                    return None, f"Invalid excluded user ID: {user_id}"
            
            # Create gift card document
            gift_card_doc = {
                'code': code,
                'name': gift_card_data.get('name', '').strip(),
                'description': gift_card_data.get('description', '').strip(),
                'amount': amount,
                'image_url': gift_card_data.get('image_url', ''),
                'expiry_date': expiry_date,
                'max_redemptions': max_redemptions,  # NEW: First N users can redeem
                'send_to_all': gift_card_data.get('send_to_all', True),  # NEW: Send to all users
                'excluded_users': excluded_user_ids,  # NEW: Users to exclude from email
                'user_ids': [],  # Specific user IDs if not send_to_all
                'redeemed_by': [],  # List of user IDs who redeemed
                'status': 'active',  # active, expired, cancelled, fully_redeemed
                'created_by': ObjectId(created_by) if isinstance(created_by, str) else created_by,
                'created_at': datetime.utcnow(),
                'updated_at': datetime.utcnow(),
                'redemption_count': 0,
                'total_credited': 0.0,
                'email_sent_to': []  # Track which users received email
            }
            
            # Handle targeted user IDs
            target_user_ids = gift_card_data.get('user_ids', [])
            if target_user_ids and not gift_card_data.get('send_to_all', True):
                converted_ids = []
                for uid in target_user_ids:
                    try:
                        converted_ids.append(ObjectId(uid) if isinstance(uid, str) else uid)
                    except:
                        pass
                gift_card_doc['user_ids'] = converted_ids
            
            # Insert gift card
            result = self.collection.insert_one(gift_card_doc)
            gift_card_doc['_id'] = str(result.inserted_id)
            gift_card_doc['created_by'] = str(gift_card_doc['created_by'])
            gift_card_doc['excluded_users'] = [str(uid) for uid in gift_card_doc.get('excluded_users', [])]
            gift_card_doc['user_ids'] = [str(uid) for uid in gift_card_doc.get('user_ids', [])]
            
            logger.info(f"✅ Gift card '{code}' created successfully - ${amount}, max {max_redemptions} redemptions")
            return gift_card_doc, None
            
        except Exception as e:
            logger.error(f"❌ Error creating gift card: {str(e)}")
            return None, f"Error creating gift card: {str(e)}"
    
    def send_gift_card_email(self, gift_card_id, user_ids=None):
        """
        Send gift card email to users
        
        Args:
            gift_card_id: Gift card ID
            user_ids: Optional list of specific user IDs (if None, uses gift card settings)
            
        Returns:
            Tuple (success, error_message)
        """
        if not self._check_db_connection():
            return False, "Database connection not available"
        
        try:
            # Get gift card
            gift_card = self.collection.find_one({'_id': ObjectId(gift_card_id) if isinstance(gift_card_id, str) else gift_card_id})
            if not gift_card:
                return False, "Gift card not found"
            
            # Import email service
            from services.email_service import send_gift_card_email
            
            # Helper to find user in both collections
            def find_user(uid):
                uid_obj = ObjectId(uid) if isinstance(uid, str) else uid
                user = self.users_collection.find_one({'_id': uid_obj})
                if not user:
                    user = self.advertisers_collection.find_one({'_id': uid_obj})
                return user
            
            # Determine which users to send to
            if user_ids is None:
                # Use gift card settings
                if gift_card.get('send_to_all', True):
                    # Send to all users except excluded ones
                    excluded_users = gift_card.get('excluded_users', [])
                    query = {}
                    if excluded_users:
                        query['_id'] = {'$nin': excluded_users}
                    
                    # Get all users from both collections (excluding excluded ones)
                    publishers = list(self.users_collection.find(query, {'_id': 1, 'email': 1, 'name': 1}))
                    advertisers = list(self.advertisers_collection.find(query, {'_id': 1, 'email': 1, 'name': 1}))
                    all_users = publishers + advertisers
                    user_ids = [user['_id'] for user in all_users]
                    logger.info(f"📧 Sending gift card to ALL users ({len(user_ids)} users: {len(publishers)} publishers + {len(advertisers)} advertisers), excluding {len(excluded_users)} users")
                else:
                    return False, "send_to_all is False but no user_ids provided"
            
            sent_count = 0
            failed_users = []
            
            for user_id in user_ids:
                try:
                    # Get user details from both collections
                    user = find_user(user_id)
                    if not user:
                        logger.warning(f"⚠️ User {user_id} not found in users or advertisers collection")
                        failed_users.append(str(user_id))
                        continue
                    
                    # Check if user is in excluded list
                    if ObjectId(user_id) in gift_card.get('excluded_users', []):
                        logger.info(f"⏭️ Skipping excluded user: {user.get('email')}")
                        continue
                    
                    # Send email
                    email_sent = send_gift_card_email(
                        to_email=user.get('email'),
                        user_name=user.get('name', 'User'),
                        gift_card_code=gift_card['code'],
                        gift_card_name=gift_card['name'],
                        gift_card_amount=gift_card['amount'],
                        gift_card_image=gift_card.get('image_url', ''),
                        expiry_date=gift_card['expiry_date']
                    )
                    
                    if email_sent:
                        sent_count += 1
                        # Track email sent
                        self.collection.update_one(
                            {'_id': ObjectId(gift_card_id) if isinstance(gift_card_id, str) else gift_card_id},
                            {'$addToSet': {'email_sent_to': ObjectId(user_id) if isinstance(user_id, str) else user_id}}
                        )
                    else:
                        failed_users.append(str(user_id))
                        
                except Exception as e:
                    logger.error(f"Error sending email to user {user_id}: {str(e)}")
                    failed_users.append(str(user_id))
            
            if sent_count > 0:
                logger.info(f"✅ Gift card emails sent to {sent_count} users")
                return True, None
            else:
                return False, f"Failed to send emails to users: {', '.join(failed_users)}"
                
        except Exception as e:
            logger.error(f"❌ Error sending gift card emails: {str(e)}")
            return False, f"Error sending emails: {str(e)}"
    
    def redeem_gift_card(self, code, user_id):
        """
        Redeem a gift card and credit user account balance (First-Come-First-Served)
        
        Args:
            code: Gift card code
            user_id: User ID
            
        Returns:
            Tuple (redemption_doc, error_message)
        """
        if not self._check_db_connection():
            return None, "Database connection not available"
        
        try:
            # Get gift card
            gift_card = self.collection.find_one({'code': code.upper().strip()})
            if not gift_card:
                return None, "Gift card not found"
            
            # Check if gift card is active
            if gift_card['status'] == 'fully_redeemed':
                return None, "Sorry! This gift card has been fully redeemed by other users"
            
            if gift_card['status'] != 'active':
                return None, f"Gift card is {gift_card['status']}"
            
            # Check if expired
            if gift_card['expiry_date'] and datetime.utcnow() > gift_card['expiry_date']:
                # Auto-expire
                self.collection.update_one(
                    {'_id': gift_card['_id']},
                    {'$set': {'status': 'expired', 'updated_at': datetime.utcnow()}}
                )
                return None, "Gift card has expired"
            
            # Convert user_id to ObjectId
            user_obj_id = ObjectId(user_id) if isinstance(user_id, str) else user_id
            
            # Check if user already redeemed
            if user_obj_id in gift_card.get('redeemed_by', []):
                return None, "You have already redeemed this gift card"
            
            # NEW: Check if max redemptions reached (First-Come-First-Served)
            max_redemptions = gift_card.get('max_redemptions', 0)
            current_redemptions = gift_card.get('redemption_count', 0)
            
            if max_redemptions > 0 and current_redemptions >= max_redemptions:
                # Auto-deactivate
                self.collection.update_one(
                    {'_id': gift_card['_id']},
                    {'$set': {'status': 'fully_redeemed', 'updated_at': datetime.utcnow()}}
                )
                return None, f"Sorry! This gift card has been fully redeemed (limit: {max_redemptions} users)"
            
            # Credit user account balance
            user_update_result = self.users_collection.update_one(
                {'_id': user_obj_id},
                {
                    '$inc': {'balance': gift_card['amount']},
                    '$set': {'updated_at': datetime.utcnow()}
                }
            )
            
            if user_update_result.modified_count == 0:
                return None, "Failed to credit user account"
            
            # Create redemption record
            redemption_doc = {
                'user_id': user_obj_id,
                'gift_card_id': gift_card['_id'],
                'code': code.upper().strip(),
                'amount': gift_card['amount'],
                'redeemed_at': datetime.utcnow(),
                'status': 'credited',
                'redemption_number': current_redemptions + 1  # Track which number redeemer this user is
            }
            
            result = self.redemptions_collection.insert_one(redemption_doc)
            redemption_doc['_id'] = str(result.inserted_id)
            
            # Update gift card
            update_result = self.collection.update_one(
                {'_id': gift_card['_id']},
                {
                    '$push': {'redeemed_by': user_obj_id},
                    '$inc': {
                        'redemption_count': 1,
                        'total_credited': gift_card['amount']
                    },
                    '$set': {'updated_at': datetime.utcnow()}
                }
            )
            
            # Check if we just hit the max redemptions limit
            new_redemption_count = current_redemptions + 1
            if max_redemptions > 0 and new_redemption_count >= max_redemptions:
                # Auto-deactivate
                self.collection.update_one(
                    {'_id': gift_card['_id']},
                    {'$set': {'status': 'fully_redeemed', 'updated_at': datetime.utcnow()}}
                )
                logger.info(f"🔒 Gift card '{code}' auto-deactivated after reaching {max_redemptions} redemptions")
            
            # Get updated user balance
            user = self.users_collection.find_one({'_id': user_obj_id})
            new_balance = user.get('balance', 0) if user else gift_card['amount']
            
            logger.info(f"✅ Gift card '{code}' redeemed by user {user_id} (#{new_redemption_count}/{max_redemptions}) for ${gift_card['amount']}")
            
            return {
                'redemption': redemption_doc,
                'amount': gift_card['amount'],
                'new_balance': new_balance,
                'gift_card_name': gift_card['name'],
                'redemption_number': new_redemption_count,
                'max_redemptions': max_redemptions
            }, None
            
        except Exception as e:
            logger.error(f"❌ Error redeeming gift card: {str(e)}")
            return None, f"Error redeeming gift card: {str(e)}"
    
    def get_user_gift_cards(self, user_id):
        """
        Get gift cards visible to this specific user.
        - If send_to_all=True: visible to everyone (except excluded_users)
        - If send_to_all=False: only visible to users in user_ids list
        
        Args:
            user_id: User ID
            
        Returns:
            List of gift cards
        """
        if not self._check_db_connection():
            return []
        
        try:
            user_obj_id = ObjectId(user_id) if isinstance(user_id, str) else user_id
            user_id_str = str(user_id)
            
            # Get all non-expired gift cards
            gift_cards = list(self.collection.find({
                'status': {'$in': ['active', 'fully_redeemed']},
                'expiry_date': {'$gte': datetime.utcnow()}
            }).sort('created_at', -1))
            
            visible_cards = []
            for card in gift_cards:
                # Check user targeting
                send_to_all = card.get('send_to_all', True)
                if not send_to_all:
                    # Targeted card — only show to users in user_ids list
                    target_ids = card.get('user_ids', [])
                    target_ids_str = [str(uid) for uid in target_ids]
                    if user_id_str not in target_ids_str:
                        continue
                
                # Check if user is excluded
                excluded = card.get('excluded_users', [])
                excluded_str = [str(uid) for uid in excluded]
                if user_id_str in excluded_str:
                    continue
                
                card['_id'] = str(card['_id'])
                card['created_by'] = str(card['created_by'])
                card['is_redeemed'] = user_obj_id in card.get('redeemed_by', [])
                card['remaining_redemptions'] = max(0, card.get('max_redemptions', 0) - card.get('redemption_count', 0))
                card['redeemed_by'] = [str(uid) for uid in card.get('redeemed_by', [])]
                card['excluded_users'] = excluded_str
                card['user_ids'] = [str(uid) for uid in card.get('user_ids', [])]
                card['email_sent_to'] = [str(uid) for uid in card.get('email_sent_to', [])]
                visible_cards.append(card)
            
            return visible_cards
            
        except Exception as e:
            logger.error(f"Error fetching user gift cards: {str(e)}")
            return []
    
    def get_redemption_history(self, user_id):
        """
        Get redemption history for a user
        
        Args:
            user_id: User ID
            
        Returns:
            List of redemptions
        """
        if not self._check_db_connection():
            return []
        
        try:
            user_obj_id = ObjectId(user_id) if isinstance(user_id, str) else user_id
            
            redemptions = list(self.redemptions_collection.find({
                'user_id': user_obj_id
            }).sort('redeemed_at', -1))
            
            for redemption in redemptions:
                redemption['_id'] = str(redemption['_id'])
                redemption['user_id'] = str(redemption['user_id'])
                redemption['gift_card_id'] = str(redemption['gift_card_id'])
            
            return redemptions
            
        except Exception as e:
            logger.error(f"Error fetching redemption history: {str(e)}")
            return []
    
    def get_all_gift_cards(self, skip=0, limit=20, status=None):
        """
        Get all gift cards (admin view)
        
        Args:
            skip: Number of records to skip
            limit: Number of records to return
            status: Filter by status (optional)
            
        Returns:
            Tuple (gift_cards, total_count)
        """
        if not self._check_db_connection():
            return [], 0
        
        try:
            query = {}
            if status:
                query['status'] = status
            
            total = self.collection.count_documents(query)
            gift_cards = list(self.collection.find(query)
                            .sort('created_at', -1)
                            .skip(skip)
                            .limit(limit))
            
            for card in gift_cards:
                card['_id'] = str(card['_id'])
                card['created_by'] = str(card['created_by'])
                card['excluded_users'] = [str(uid) for uid in card.get('excluded_users', [])]
                card['user_ids'] = [str(uid) for uid in card.get('user_ids', [])]
                card['redeemed_by'] = [str(uid) for uid in card.get('redeemed_by', [])]
                card['email_sent_to'] = [str(uid) for uid in card.get('email_sent_to', [])]
            
            return gift_cards, total
            
        except Exception as e:
            logger.error(f"Error fetching gift cards: {str(e)}")
            return [], 0
    
    def update_gift_card(self, gift_card_id, update_data):
        """
        Update a gift card
        
        Args:
            gift_card_id: Gift card ID
            update_data: Dictionary with fields to update
            
        Returns:
            Tuple (success, error_message)
        """
        if not self._check_db_connection():
            return False, "Database connection not available"
        
        try:
            gc = self.collection.find_one({'_id': ObjectId(gift_card_id) if isinstance(gift_card_id, str) else gift_card_id})
            if not gc:
                return False, "Gift card not found"
            
            update_doc = {'updated_at': datetime.utcnow()}
            
            allowed_fields = ['name', 'description', 'amount', 'max_redemptions', 'image_url', 'send_to_all', 'code']
            for field in allowed_fields:
                if field in update_data:
                    if field == 'amount':
                        update_doc[field] = float(update_data[field])
                    elif field == 'max_redemptions':
                        update_doc[field] = int(update_data[field])
                    elif field == 'code':
                        new_code = update_data[field].upper().strip()
                        existing = self.collection.find_one({'code': new_code, '_id': {'$ne': gc['_id']}})
                        if existing:
                            return False, "Code already exists"
                        update_doc[field] = new_code
                    else:
                        update_doc[field] = update_data[field]
            
            if 'expiry_date' in update_data:
                expiry = update_data['expiry_date']
                if isinstance(expiry, str):
                    expiry = datetime.fromisoformat(expiry.replace('Z', '+00:00')).replace(tzinfo=None)
                update_doc['expiry_date'] = expiry
            
            if 'excluded_users' in update_data:
                excluded = []
                for uid in update_data['excluded_users']:
                    try:
                        excluded.append(ObjectId(uid) if isinstance(uid, str) else uid)
                    except:
                        pass
                update_doc['excluded_users'] = excluded
            
            if 'user_ids' in update_data:
                user_ids = []
                for uid in update_data['user_ids']:
                    try:
                        user_ids.append(ObjectId(uid) if isinstance(uid, str) else uid)
                    except:
                        pass
                update_doc['user_ids'] = user_ids
            
            result = self.collection.update_one(
                {'_id': gc['_id']},
                {'$set': update_doc}
            )
            
            if result.modified_count > 0:
                logger.info(f"✅ Gift card {gift_card_id} updated")
                return True, None
            else:
                return True, None  # No changes needed
                
        except Exception as e:
            logger.error(f"❌ Error updating gift card: {str(e)}")
            return False, f"Error updating gift card: {str(e)}"
    
    def cancel_gift_card(self, gift_card_id):
        """
        Cancel a gift card
        
        Args:
            gift_card_id: Gift card ID
            
        Returns:
            Tuple (success, error_message)
        """
        if not self._check_db_connection():
            return False, "Database connection not available"
        
        try:
            result = self.collection.update_one(
                {'_id': ObjectId(gift_card_id) if isinstance(gift_card_id, str) else gift_card_id},
                {'$set': {'status': 'cancelled', 'updated_at': datetime.utcnow()}}
            )
            
            if result.modified_count > 0:
                logger.info(f"✅ Gift card {gift_card_id} cancelled")
                return True, None
            else:
                return False, "Gift card not found or already cancelled"
                
        except Exception as e:
            logger.error(f"❌ Error cancelling gift card: {str(e)}")
            return False, f"Error cancelling gift card: {str(e)}"


# Singleton instance
_gift_card_instance = None

def get_gift_card_service():
    """Get singleton instance of GiftCard service"""
    global _gift_card_instance
    if _gift_card_instance is None:
        _gift_card_instance = GiftCard()
    return _gift_card_instance
