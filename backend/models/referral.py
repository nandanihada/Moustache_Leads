"""
Referral Model
Handles referral links, P1 (Balance Booster), P2 (Commission Share), and fraud logs
"""

from datetime import datetime, timedelta
from bson import ObjectId
from database import db_instance
import logging
import secrets
import string

logger = logging.getLogger(__name__)


class Referral:
    def __init__(self):
        self.referral_links = db_instance.get_collection('referral_links')
        self.referrals_p1 = db_instance.get_collection('referrals_p1')
        self.referrals_p2 = db_instance.get_collection('referrals_p2')
        self.referral_fraud_log = db_instance.get_collection('referral_fraud_log')
        self.p2_commission_settlements = db_instance.get_collection('p2_commission_settlements')
        self.users = db_instance.get_collection('users')
        self.forwarded_postbacks = db_instance.get_collection('forwarded_postbacks')

    # ─── Referral Link Management ───

    def generate_referral_code(self):
        """Generate a unique 8-char alphanumeric referral code"""
        chars = string.ascii_uppercase + string.digits
        while True:
            code = ''.join(secrets.choice(chars) for _ in range(8))
            if not self.referral_links.find_one({'referral_code': code}):
                return code

    def get_or_create_referral_link(self, user_id):
        """Get existing referral link or create one for the user"""
        try:
            existing = self.referral_links.find_one({'user_id': str(user_id)})
            if existing:
                existing['_id'] = str(existing['_id'])
                return existing, None

            code = self.generate_referral_code()
            doc = {
                'user_id': str(user_id),
                'referral_code': code,
                'created_at': datetime.utcnow(),
                'is_active': True
            }
            result = self.referral_links.insert_one(doc)
            doc['_id'] = str(result.inserted_id)
            return doc, None
        except Exception as e:
            logger.error(f"Error creating referral link: {e}")
            return None, str(e)

    def find_referrer_by_code(self, referral_code):
        """Find the user who owns a referral code"""
        try:
            link = self.referral_links.find_one({'referral_code': referral_code, 'is_active': True})
            if not link:
                return None
            return link
        except Exception as e:
            logger.error(f"Error finding referrer by code: {e}")
            return None

    # ─── P1: Balance Booster ───

    def get_user_total_earnings(self, user_id):
        """Get total earnings for a user from forwarded_postbacks"""
        try:
            pipeline = [
                {'$match': {'publisher_id': str(user_id)}},
                {'$group': {'_id': None, 'total': {'$sum': '$points'}}}
            ]
            result = list(self.forwarded_postbacks.aggregate(pipeline))
            return result[0]['total'] if result else 0
        except Exception as e:
            logger.error(f"Error getting user total earnings: {e}")
            return 0

    def get_referrer_p1_count(self, referrer_id):
        """Get count of P1 referrals for a referrer"""
        try:
            return self.referrals_p1.count_documents({'referrer_id': str(referrer_id)})
        except Exception:
            return 0

    def create_p1_referral(self, referrer_id, referred_user_id, referred_email, referred_username,
                           ip_address, device_fingerprint, user_agent):
        """Create a new P1 referral record (pending fraud check)"""
        try:
            # Calculate bonus percentage
            existing_count = self.get_referrer_p1_count(referrer_id)
            bonus_percent = 10.0 if existing_count == 0 else 2.0

            # Calculate bonus amount based on referrer's total earnings
            referrer_earnings = self.get_user_total_earnings(referrer_id)
            bonus_amount = round(referrer_earnings * (bonus_percent / 100), 2)

            # Resolve country from IP
            country = ''
            country_code = ''
            city = ''
            try:
                from services.ipinfo_service import get_ipinfo_service
                ipinfo_svc = get_ipinfo_service()
                ip_to_lookup = ip_address.split(',')[0].strip() if ip_address else ''
                if ip_to_lookup and '.' in ip_to_lookup:
                    ip_data = ipinfo_svc.lookup_ip(ip_to_lookup)
                    if ip_data:
                        country = ip_data.get('country', '')
                        country_code = ip_data.get('country_code', '')
                        city = ip_data.get('city', '')
            except Exception as geo_err:
                logger.warning(f"IP geo lookup failed for {ip_address}: {geo_err}")

            doc = {
                'referrer_id': str(referrer_id),
                'referred_user_id': str(referred_user_id),
                'referred_email': referred_email,
                'referred_username': referred_username,
                'bonus_percent': bonus_percent,
                'bonus_amount': bonus_amount,
                'referrer_earnings_at_time': referrer_earnings,
                'status': 'pending_fraud_check',
                'fraud_score': None,
                'ip_address': ip_address,
                'country': country,
                'country_code': country_code,
                'city': city,
                'device_fingerprint': device_fingerprint,
                'user_agent': user_agent,
                'created_at': datetime.utcnow(),
                'updated_at': datetime.utcnow(),
                'bonus_released': False,
                'bonus_released_at': None
            }
            result = self.referrals_p1.insert_one(doc)
            doc['_id'] = str(result.inserted_id)
            return doc, None
        except Exception as e:
            logger.error(f"Error creating P1 referral: {e}")
            return None, str(e)

    def update_p1_fraud_result(self, referral_id, fraud_score, status, fraud_details=None):
        """Update P1 referral with fraud check results"""
        try:
            update = {
                '$set': {
                    'fraud_score': fraud_score,
                    'status': status,
                    'updated_at': datetime.utcnow()
                }
            }
            if fraud_details:
                update['$set']['fraud_details'] = fraud_details

            self.referrals_p1.update_one(
                {'_id': ObjectId(referral_id)},
                update
            )
            return True, None
        except Exception as e:
            logger.error(f"Error updating P1 fraud result: {e}")
            return False, str(e)

    def release_p1_bonus(self, referral_id):
        """Release P1 bonus to referrer's balance"""
        try:
            referral = self.referrals_p1.find_one({'_id': ObjectId(referral_id)})
            if not referral:
                return False, "Referral not found"
            if referral.get('bonus_released'):
                return False, "Bonus already released"

            bonus = referral['bonus_amount']
            referrer_id = referral['referrer_id']

            # Add bonus to referrer's balance (total_points)
            self.users.update_one(
                {'_id': ObjectId(referrer_id)},
                {
                    '$inc': {'total_points': bonus, 'referral_bonus_total': bonus},
                    '$set': {'updated_at': datetime.utcnow()}
                }
            )

            # Mark bonus as released
            self.referrals_p1.update_one(
                {'_id': ObjectId(referral_id)},
                {'$set': {
                    'bonus_released': True,
                    'bonus_released_at': datetime.utcnow(),
                    'status': 'approved',
                    'updated_at': datetime.utcnow()
                }}
            )
            return True, None
        except Exception as e:
            logger.error(f"Error releasing P1 bonus: {e}")
            return False, str(e)

    def reject_p1_referral(self, referral_id):
        """Reject a P1 referral"""
        try:
            self.referrals_p1.update_one(
                {'_id': ObjectId(referral_id)},
                {'$set': {'status': 'rejected', 'updated_at': datetime.utcnow()}}
            )
            return True, None
        except Exception as e:
            return False, str(e)

    def hold_p1_referral(self, referral_id):
        """Put a P1 referral on hold for manual review"""
        try:
            self.referrals_p1.update_one(
                {'_id': ObjectId(referral_id)},
                {'$set': {'status': 'pending_review', 'updated_at': datetime.utcnow()}}
            )
            return True, None
        except Exception as e:
            return False, str(e)

    def get_p1_referrals_for_user(self, referrer_id):
        """Get all P1 referrals for a specific referrer"""
        try:
            referrals = list(self.referrals_p1.find(
                {'referrer_id': str(referrer_id)}
            ).sort('created_at', -1))
            for r in referrals:
                r['_id'] = str(r['_id'])
            return referrals, None
        except Exception as e:
            return [], str(e)

    def get_p1_stats_for_user(self, referrer_id):
        """Get P1 stats for a user"""
        try:
            rid = str(referrer_id)
            total = self.referrals_p1.count_documents({'referrer_id': rid})
            approved = self.referrals_p1.count_documents({'referrer_id': rid, 'status': 'approved'})

            pipeline = [
                {'$match': {'referrer_id': rid, 'bonus_released': True}},
                {'$group': {'_id': None, 'total_bonus': {'$sum': '$bonus_amount'}}}
            ]
            result = list(self.referrals_p1.aggregate(pipeline))
            total_bonus = result[0]['total_bonus'] if result else 0

            return {
                'total_joins': total,
                'approved': approved,
                'total_bonus_earned': round(total_bonus, 2)
            }, None
        except Exception as e:
            return None, str(e)

    # ─── P2: Commission Share ───

    def create_p2_referral(self, referrer_id, referred_user_id, referred_email, referred_username):
        """Create a new P2 referral tracking record"""
        try:
            doc = {
                'referrer_id': str(referrer_id),
                'referred_user_id': str(referred_user_id),
                'referred_email': referred_email,
                'referred_username': referred_username,
                'revenue_generated': 0.0,
                'commission_earned': 0.0,
                'commission_rate': 0.04,  # 4%
                'status': 'tracking',  # tracking, qualified, active, expired
                'qualified': False,
                'qualified_at': None,
                'qualification_type': None,  # 'cpa' or 'cpl'
                'months_remaining': 6,
                'expires_at': None,
                'created_at': datetime.utcnow(),
                'updated_at': datetime.utcnow(),
                'first_positive_quality_month': None,
                'positive_quality_months': 0
            }
            result = self.referrals_p2.insert_one(doc)
            doc['_id'] = str(result.inserted_id)
            return doc, None
        except Exception as e:
            logger.error(f"Error creating P2 referral: {e}")
            return None, str(e)

    def update_p2_revenue(self, referred_user_id, payout_amount):
        """Update revenue for a referred user in P2 tracking.
        Called from postback handler after each conversion."""
        try:
            p2_record = self.referrals_p2.find_one({
                'referred_user_id': str(referred_user_id),
                'status': {'$in': ['tracking', 'qualified', 'active']}
            })
            if not p2_record:
                return None  # User not referred under P2

            new_revenue = p2_record.get('revenue_generated', 0) + payout_amount

            update_fields = {
                'revenue_generated': new_revenue,
                'updated_at': datetime.utcnow()
            }

            # Check qualification thresholds
            if not p2_record.get('qualified'):
                # Determine offer type from the revenue pattern
                # CPA: >$500 revenue
                # CPL: >$1000 revenue + 2 months positive quality
                if new_revenue > 500:
                    update_fields['qualified'] = True
                    update_fields['qualified_at'] = datetime.utcnow()
                    update_fields['qualification_type'] = 'cpa'
                    update_fields['status'] = 'active'
                    update_fields['expires_at'] = datetime.utcnow() + timedelta(days=180)
                    update_fields['months_remaining'] = 6

            # If qualified and active, calculate commission
            commission = 0
            if p2_record.get('status') == 'active' or update_fields.get('status') == 'active':
                if p2_record.get('expires_at') and datetime.utcnow() > p2_record['expires_at']:
                    update_fields['status'] = 'expired'
                    update_fields['months_remaining'] = 0
                else:
                    commission = round(payout_amount * 0.04, 2)
                    update_fields['commission_earned'] = p2_record.get('commission_earned', 0) + commission

            self.referrals_p2.update_one(
                {'_id': p2_record['_id']},
                {'$set': update_fields}
            )

            # If commission earned, add to referrer's pending commission
            if commission > 0:
                self.users.update_one(
                    {'_id': ObjectId(p2_record['referrer_id'])},
                    {
                        '$inc': {'referral_commission_pending': commission},
                        '$set': {'updated_at': datetime.utcnow()}
                    }
                )

            return {
                'p2_record_id': str(p2_record['_id']),
                'new_revenue': new_revenue,
                'commission': commission,
                'qualified': update_fields.get('qualified', p2_record.get('qualified')),
                'status': update_fields.get('status', p2_record.get('status'))
            }
        except Exception as e:
            logger.error(f"Error updating P2 revenue: {e}")
            return None

    def get_p2_referrals_for_user(self, referrer_id):
        """Get all P2 referrals for a specific referrer"""
        try:
            referrals = list(self.referrals_p2.find(
                {'referrer_id': str(referrer_id)}
            ).sort('created_at', -1))
            for r in referrals:
                r['_id'] = str(r['_id'])
            return referrals, None
        except Exception as e:
            return [], str(e)

    def get_p2_stats_for_user(self, referrer_id):
        """Get P2 stats for a user"""
        try:
            rid = str(referrer_id)
            total = self.referrals_p2.count_documents({'referrer_id': rid})
            active = self.referrals_p2.count_documents({'referrer_id': rid, 'status': 'active'})

            pipeline = [
                {'$match': {'referrer_id': rid}},
                {'$group': {'_id': None, 'total_commission': {'$sum': '$commission_earned'}}}
            ]
            result = list(self.referrals_p2.aggregate(pipeline))
            total_commission = result[0]['total_commission'] if result else 0

            return {
                'total_referred': total,
                'active': active,
                'total_commission_earned': round(total_commission, 2)
            }, None
        except Exception as e:
            return None, str(e)

    # ─── Admin Queries ───

    def get_p1_admin_stats(self):
        """Get aggregate P1 stats for admin dashboard"""
        try:
            total = self.referrals_p1.count_documents({})
            auto_approved = self.referrals_p1.count_documents({'status': 'approved'})
            pending = self.referrals_p1.count_documents({'status': 'pending_review'})
            rejected = self.referrals_p1.count_documents({'status': 'rejected'})

            bonus_pipeline = [
                {'$match': {'bonus_released': True}},
                {'$group': {'_id': None, 'total': {'$sum': '$bonus_amount'}}}
            ]
            bonus_result = list(self.referrals_p1.aggregate(bonus_pipeline))
            total_bonus = bonus_result[0]['total'] if bonus_result else 0

            blocked_pipeline = [
                {'$match': {'status': 'rejected'}},
                {'$group': {'_id': None, 'total': {'$sum': '$bonus_amount'}}}
            ]
            blocked_result = list(self.referrals_p1.aggregate(blocked_pipeline))
            total_blocked = blocked_result[0]['total'] if blocked_result else 0

            return {
                'total_referrals': total,
                'auto_approved': auto_approved,
                'pending_review': pending,
                'auto_rejected': rejected,
                'total_bonus_released': round(total_bonus, 2),
                'total_fraud_blocked': round(total_blocked, 2)
            }, None
        except Exception as e:
            return None, str(e)

    def get_p1_admin_list(self, page=1, per_page=20, status=None, fraud_score_min=None,
                          fraud_score_max=None, search=None, country=None):
        """Get paginated P1 referrals for admin with filters"""
        try:
            query = {}
            if status:
                query['status'] = status
            if fraud_score_min is not None or fraud_score_max is not None:
                score_q = {}
                if fraud_score_min is not None:
                    score_q['$gte'] = fraud_score_min
                if fraud_score_max is not None:
                    score_q['$lte'] = fraud_score_max
                query['fraud_score'] = score_q

            if search:
                query['$or'] = [
                    {'referred_username': {'$regex': search, '$options': 'i'}},
                    {'referred_email': {'$regex': search, '$options': 'i'}}
                ]

            if country:
                query['country'] = {'$regex': country, '$options': 'i'}

            total = self.referrals_p1.count_documents(query)
            skip = (page - 1) * per_page
            referrals = list(self.referrals_p1.find(query)
                           .sort('created_at', -1)
                           .skip(skip)
                           .limit(per_page))

            # Enrich with referrer + referred user info
            for r in referrals:
                r['_id'] = str(r['_id'])
                # Referrer info
                referrer = self.users.find_one({'_id': ObjectId(r['referrer_id'])})
                if referrer:
                    r['referrer_name'] = referrer.get('username', '')
                    r['referrer_email'] = referrer.get('email', '')
                else:
                    r['referrer_name'] = 'Unknown'
                    r['referrer_email'] = ''

                # Referred user enrichment
                try:
                    referred = self.users.find_one({'_id': ObjectId(r['referred_user_id'])})
                    if referred:
                        r['referred_logins'] = referred.get('login_count', 0)
                        r['referred_email_verified'] = referred.get('email_verified', False)
                        r['referred_account_status'] = referred.get('account_status', 'unknown')
                        r['referred_created_at'] = referred.get('created_at')
                    else:
                        r['referred_logins'] = 0
                        r['referred_email_verified'] = False
                        r['referred_account_status'] = 'unknown'
                except Exception:
                    pass

                # Get fraud check details from log
                try:
                    fraud_log = self.referral_fraud_log.find_one(
                        {'referral_id': r['_id'], 'referral_type': 'p1'},
                        sort=[('created_at', -1)]
                    )
                    if fraud_log:
                        checks = fraud_log.get('checks', [])
                        r['fraud_checks'] = checks
                        r['fraud_checks_passed'] = sum(1 for c in checks if c.get('result') == 'pass')
                        r['fraud_checks_failed'] = sum(1 for c in checks if c.get('result') == 'block')
                        r['fraud_checks_total'] = len(checks)
                    else:
                        r['fraud_checks'] = []
                        r['fraud_checks_passed'] = 0
                        r['fraud_checks_failed'] = 0
                        r['fraud_checks_total'] = 0
                except Exception:
                    r['fraud_checks'] = []
                    r['fraud_checks_passed'] = 0
                    r['fraud_checks_failed'] = 0
                    r['fraud_checks_total'] = 0

            return {
                'referrals': referrals,
                'total': total,
                'page': page,
                'per_page': per_page,
                'total_pages': (total + per_page - 1) // per_page
            }, None
        except Exception as e:
            return None, str(e)


    # ─── Fraud Log ───

    def log_fraud_check(self, referral_id, referral_type, checks):
        """Log individual fraud check results"""
        try:
            doc = {
                'referral_id': str(referral_id),
                'referral_type': referral_type,  # 'p1' or 'p2'
                'checks': checks,  # list of {check_name, result, details}
                'created_at': datetime.utcnow()
            }
            self.referral_fraud_log.insert_one(doc)
            return True
        except Exception as e:
            logger.error(f"Error logging fraud check: {e}")
            return False
