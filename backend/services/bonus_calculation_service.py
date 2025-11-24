"""
Bonus Calculation Service
Calculates and applies promo code bonuses to conversions
Integrates with conversion tracking system
"""

from database import db_instance
from models.promo_code import PromoCode
from datetime import datetime
from bson import ObjectId
import logging

logger = logging.getLogger(__name__)


class BonusCalculationService:
    """Service for calculating and applying promo code bonuses"""
    
    def __init__(self):
        self.db = db_instance
        self.promo_code_model = PromoCode()
        self.conversions_collection = self.db.get_collection('conversions')
        self.users_collection = self.db.get_collection('users')
        self.bonus_earnings_collection = self.db.get_collection('bonus_earnings')
        self.user_promo_codes_collection = self.db.get_collection('user_promo_codes')
    
    def calculate_bonus_for_conversion(self, conversion_id: str) -> dict:
        """
        Calculate bonus for a conversion based on user's active promo codes
        
        Args:
            conversion_id: ID of the conversion to calculate bonus for
            
        Returns:
            dict: Bonus calculation result with bonus_amount and details
        """
        try:
            # Get conversion details
            conversion = self.conversions_collection.find_one({'conversion_id': conversion_id})
            
            if not conversion:
                logger.warning(f"Conversion not found: {conversion_id}")
                return {'error': 'Conversion not found', 'bonus_amount': 0}
            
            # Get user's active promo codes
            user_id = conversion.get('affiliate_id')
            if not user_id:
                logger.warning(f"No affiliate_id in conversion {conversion_id}")
                return {'error': 'No user found', 'bonus_amount': 0}
            
            # Get user's active codes
            user_codes = self.user_promo_codes_collection.find({
                'user_id': ObjectId(user_id) if isinstance(user_id, str) else user_id,
                'is_active': True
            })
            
            user_codes_list = list(user_codes)
            
            if not user_codes_list:
                logger.info(f"No active promo codes for user {user_id}")
                return {'bonus_amount': 0, 'codes_applied': []}
            
            # Calculate total bonus from all applicable codes
            total_bonus = 0
            codes_applied = []
            base_earning = conversion.get('payout', 0)
            
            for user_code in user_codes_list:
                # Get full code details
                code_id = user_code.get('promo_code_id')
                code_obj = self.promo_code_model.get_promo_code_by_id(str(code_id))
                
                if not code_obj:
                    logger.warning(f"Promo code not found: {code_id}")
                    continue
                
                # Check if code is still valid
                if code_obj.get('status') != 'active':
                    logger.info(f"Code {code_obj.get('code')} is not active")
                    continue
                
                # Check expiration
                if code_obj.get('end_date') and code_obj['end_date'] < datetime.utcnow():
                    logger.info(f"Code {code_obj.get('code')} has expired")
                    continue
                
                # Calculate bonus
                bonus_amount, _ = self.promo_code_model.calculate_bonus(base_earning, code_obj)
                
                if bonus_amount > 0:
                    total_bonus += bonus_amount
                    codes_applied.append({
                        'code': code_obj.get('code'),
                        'bonus_type': code_obj.get('bonus_type'),
                        'bonus_amount': code_obj.get('bonus_amount'),
                        'calculated_bonus': bonus_amount
                    })
                    
                    logger.info(f"✅ Bonus calculated: ${bonus_amount} for code {code_obj.get('code')}")
            
            return {
                'bonus_amount': total_bonus,
                'base_earning': base_earning,
                'total_earning': base_earning + total_bonus,
                'codes_applied': codes_applied,
                'conversion_id': conversion_id,
                'user_id': user_id
            }
            
        except Exception as e:
            logger.error(f"Error calculating bonus: {str(e)}")
            return {'error': str(e), 'bonus_amount': 0}
    
    def apply_bonus_to_conversion(self, conversion_id: str) -> dict:
        """
        Calculate bonus for conversion and record bonus earnings
        
        Args:
            conversion_id: ID of the conversion
            
        Returns:
            dict: Result with bonus details and earnings recorded
        """
        try:
            # Calculate bonus
            bonus_result = self.calculate_bonus_for_conversion(conversion_id)
            
            if 'error' in bonus_result:
                return bonus_result
            
            bonus_amount = bonus_result.get('bonus_amount', 0)
            
            if bonus_amount <= 0:
                logger.info(f"No bonus to apply for conversion {conversion_id}")
                return {
                    'conversion_id': conversion_id,
                    'bonus_amount': 0,
                    'message': 'No applicable promo codes'
                }
            
            # Get conversion details
            conversion = self.conversions_collection.find_one({'conversion_id': conversion_id})
            user_id = conversion.get('affiliate_id')
            offer_id = conversion.get('offer_id')
            
            # Record bonus earnings for each applied code
            for code_info in bonus_result.get('codes_applied', []):
                # Get code object to get code ID
                code_obj = self.promo_code_model.get_promo_code_by_code(code_info['code'])
                
                if code_obj:
                    # Record bonus earning
                    bonus_earning = {
                        'user_id': ObjectId(user_id) if isinstance(user_id, str) else user_id,
                        'promo_code_id': code_obj['_id'],
                        'code': code_info['code'],
                        'offer_id': ObjectId(offer_id) if isinstance(offer_id, str) else offer_id,
                        'conversion_id': conversion_id,
                        'base_earning': bonus_result.get('base_earning', 0),
                        'bonus_amount': code_info['calculated_bonus'],
                        'bonus_type': code_info['bonus_type'],
                        'bonus_percentage': code_info['bonus_amount'] if code_info['bonus_type'] == 'percentage' else None,
                        'status': 'pending',  # pending, credited, reversed
                        'created_at': datetime.utcnow(),
                        'credited_at': None,
                        'notes': f"Bonus from conversion {conversion_id}"
                    }
                    
                    result = self.bonus_earnings_collection.insert_one(bonus_earning)
                    
                    # Update user promo code stats
                    self.user_promo_codes_collection.update_one(
                        {'_id': ObjectId(user_id)},
                        {
                            '$inc': {
                                'total_bonus_earned': code_info['calculated_bonus'],
                                'conversions_count': 1
                            },
                            '$set': {'last_used_at': datetime.utcnow()}
                        }
                    )
                    
                    # Update promo code stats
                    self.promo_code_model.record_bonus_earning(
                        user_id=user_id,
                        promo_code_id=str(code_obj['_id']),
                        offer_id=offer_id,
                        conversion_id=conversion_id,
                        base_earning=bonus_result.get('base_earning', 0),
                        bonus_amount=code_info['calculated_bonus']
                    )
                    
                    logger.info(f"✅ Bonus earning recorded: ${code_info['calculated_bonus']} for {code_info['code']}")
            
            # Update conversion with bonus info
            self.conversions_collection.update_one(
                {'conversion_id': conversion_id},
                {
                    '$set': {
                        'bonus_amount': bonus_amount,
                        'total_payout': conversion.get('payout', 0) + bonus_amount,
                        'bonus_applied_at': datetime.utcnow(),
                        'promo_codes_applied': [c['code'] for c in bonus_result.get('codes_applied', [])]
                    }
                }
            )
            
            return {
                'conversion_id': conversion_id,
                'bonus_amount': bonus_amount,
                'total_payout': conversion.get('payout', 0) + bonus_amount,
                'codes_applied': bonus_result.get('codes_applied', []),
                'message': f'Bonus of ${bonus_amount} applied successfully'
            }
            
        except Exception as e:
            logger.error(f"Error applying bonus: {str(e)}")
            return {'error': str(e)}
    
    def credit_bonus_to_user_balance(self, conversion_id: str) -> dict:
        """
        Credit bonus earnings to user's balance
        
        Args:
            conversion_id: ID of the conversion
            
        Returns:
            dict: Result with updated balance
        """
        try:
            # Get conversion
            conversion = self.conversions_collection.find_one({'conversion_id': conversion_id})
            
            if not conversion:
                return {'error': 'Conversion not found'}
            
            bonus_amount = conversion.get('bonus_amount', 0)
            user_id = conversion.get('affiliate_id')
            
            if bonus_amount <= 0:
                return {'message': 'No bonus to credit', 'bonus_amount': 0}
            
            # Update bonus earnings status to credited
            self.bonus_earnings_collection.update_many(
                {'conversion_id': conversion_id},
                {
                    '$set': {
                        'status': 'credited',
                        'credited_at': datetime.utcnow()
                    }
                }
            )
            
            # Update user balance
            self.users_collection.update_one(
                {'_id': ObjectId(user_id) if isinstance(user_id, str) else user_id},
                {
                    '$inc': {'balance': bonus_amount},
                    '$set': {'last_bonus_credited_at': datetime.utcnow()}
                }
            )
            
            logger.info(f"✅ Bonus ${bonus_amount} credited to user {user_id}")
            
            return {
                'conversion_id': conversion_id,
                'bonus_amount': bonus_amount,
                'message': f'Bonus of ${bonus_amount} credited to user balance'
            }
            
        except Exception as e:
            logger.error(f"Error crediting bonus: {str(e)}")
            return {'error': str(e)}
    
    def get_user_bonus_summary(self, user_id: str) -> dict:
        """
        Get summary of user's bonus earnings
        
        Args:
            user_id: User ID
            
        Returns:
            dict: Bonus summary with totals
        """
        try:
            user_obj_id = ObjectId(user_id) if isinstance(user_id, str) else user_id
            
            # Get all bonus earnings for user
            earnings = list(self.bonus_earnings_collection.aggregate([
                {'$match': {'user_id': user_obj_id}},
                {'$group': {
                    '_id': None,
                    'total_earned': {'$sum': '$bonus_amount'},
                    'pending': {
                        '$sum': {
                            '$cond': [{'$eq': ['$status', 'pending']}, '$bonus_amount', 0]
                        }
                    },
                    'credited': {
                        '$sum': {
                            '$cond': [{'$eq': ['$status', 'credited']}, '$bonus_amount', 0]
                        }
                    },
                    'reversed': {
                        '$sum': {
                            '$cond': [{'$eq': ['$status', 'reversed']}, '$bonus_amount', 0]
                        }
                    },
                    'count': {'$sum': 1}
                }}
            ]))
            
            if earnings:
                summary = earnings[0]
            else:
                summary = {
                    'total_earned': 0,
                    'pending': 0,
                    'credited': 0,
                    'reversed': 0,
                    'count': 0
                }
            
            # Get user's current balance
            user = self.users_collection.find_one({'_id': user_obj_id})
            current_balance = user.get('balance', 0) if user else 0
            
            return {
                'user_id': user_id,
                'total_earned': summary.get('total_earned', 0),
                'pending': summary.get('pending', 0),
                'credited': summary.get('credited', 0),
                'reversed': summary.get('reversed', 0),
                'current_balance': current_balance,
                'total_conversions': summary.get('count', 0)
            }
            
        except Exception as e:
            logger.error(f"Error getting bonus summary: {str(e)}")
            return {'error': str(e)}
    
    def process_pending_bonuses(self, limit: int = 100) -> dict:
        """
        Process pending bonus calculations for conversions
        
        Args:
            limit: Maximum number of conversions to process
            
        Returns:
            dict: Processing results
        """
        try:
            # Find conversions without bonus calculations
            conversions = list(self.conversions_collection.find({
                'bonus_applied_at': {'$exists': False},
                'status': 'approved'
            }).limit(limit))
            
            logger.info(f"Processing {len(conversions)} pending bonuses")
            
            processed = 0
            failed = 0
            total_bonus = 0
            
            for conversion in conversions:
                result = self.apply_bonus_to_conversion(conversion['conversion_id'])
                
                if 'error' not in result:
                    processed += 1
                    total_bonus += result.get('bonus_amount', 0)
                else:
                    failed += 1
            
            logger.info(f"✅ Processed {processed} bonuses, failed {failed}, total bonus ${total_bonus}")
            
            return {
                'processed': processed,
                'failed': failed,
                'total_bonus': total_bonus,
                'message': f'Processed {processed} bonus calculations'
            }
            
        except Exception as e:
            logger.error(f"Error processing pending bonuses: {str(e)}")
            return {'error': str(e)}
