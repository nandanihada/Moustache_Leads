"""
Payout Methods Model
Handles user payout preferences (Bank, PayPal, Crypto)
"""

from datetime import datetime
from bson import ObjectId
from database import db_instance
import logging

logger = logging.getLogger(__name__)


class PayoutMethod:
    def __init__(self):
        self.collection = db_instance.get_collection('payout_methods')

    def get_user_payout_method(self, user_id: str):
        """Get payout method for a user"""
        try:
            method = self.collection.find_one({'user_id': ObjectId(user_id)})
            if method:
                method['_id'] = str(method['_id'])
                method['user_id'] = str(method['user_id'])
            return method, None
        except Exception as e:
            logger.error(f"Error getting payout method: {e}")
            return None, str(e)

    def save_payout_method(self, user_id: str, method_data: dict):
        """Save or update payout method"""
        try:
            # Validate active_method
            if 'active_method' not in method_data:
                return None, "active_method is required"
            
            if method_data['active_method'] not in ['bank', 'paypal', 'crypto']:
                return None, "active_method must be 'bank', 'paypal', or 'crypto'"

            # Prepare document
            doc = {
                'user_id': ObjectId(user_id),
                'active_method': method_data['active_method'],
                'bank_details': method_data.get('bank_details', {}),
                'paypal_details': method_data.get('paypal_details', {}),
                'crypto_details': method_data.get('crypto_details', {}),
                'updated_at': datetime.utcnow()
            }

            # Update or insert
            result = self.collection.update_one(
                {'user_id': ObjectId(user_id)},
                {
                    '$set': doc,
                    '$setOnInsert': {'created_at': datetime.utcnow()}
                },
                upsert=True
            )

            # Fetch updated document
            updated_method, error = self.get_user_payout_method(user_id)
            if error:
                return None, error

            return updated_method, None

        except Exception as e:
            logger.error(f"Error saving payout method: {e}")
            return None, str(e)

    def validate_bank_details(self, details: dict):
        """Validate bank transfer details"""
        required = ['account_name', 'bank_name', 'account_number', 'ifsc_swift', 'country', 'currency']
        for field in required:
            if field not in details or not details[field]:
                return False, f"{field} is required for bank transfer"
        return True, None

    def validate_paypal_details(self, details: dict):
        """Validate PayPal details"""
        required = ['email', 'country', 'minimum_threshold']
        for field in required:
            if field not in details or not details[field]:
                return False, f"{field} is required for PayPal"
        
        # Validate email format
        if '@' not in details['email']:
            return False, "Invalid PayPal email address"
        
        return True, None

    def validate_crypto_details(self, details: dict):
        """Validate cryptocurrency details"""
        required = ['currency', 'network', 'wallet_address']
        for field in required:
            if field not in details or not details[field]:
                return False, f"{field} is required for cryptocurrency"
        
        # Basic wallet address validation (length check)
        if len(details['wallet_address']) < 20:
            return False, "Invalid wallet address"
        
        return True, None

    def delete_payout_method(self, user_id: str):
        """Delete payout method"""
        try:
            result = self.collection.delete_one({'user_id': ObjectId(user_id)})
            return result.deleted_count > 0, None
        except Exception as e:
            logger.error(f"Error deleting payout method: {e}")
            return False, str(e)
