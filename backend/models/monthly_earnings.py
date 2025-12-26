"""
Monthly Earnings Model
Handles monthly earnings tracking and locking
"""

from datetime import datetime, timedelta
from bson import ObjectId
from database import db_instance
import logging

logger = logging.getLogger(__name__)


class MonthlyEarnings:
    def __init__(self):
        self.collection = db_instance.get_collection('monthly_earnings')
        self.forwarded_postbacks = db_instance.get_collection('forwarded_postbacks')

    def get_current_month_earnings(self, user_id: str):
        """Get current month earnings (not locked yet)"""
        try:
            # Get current month start and end
            now = datetime.utcnow()
            month_start = datetime(now.year, now.month, 1)
            
            # Calculate next month start
            if now.month == 12:
                month_end = datetime(now.year + 1, 1, 1)
            else:
                month_end = datetime(now.year, now.month + 1, 1)

            # Aggregate earnings from forwarded_postbacks for current month
            pipeline = [
                {
                    '$match': {
                        'publisher_id': user_id,
                        'timestamp': {
                            '$gte': month_start,
                            '$lt': month_end
                        }
                    }
                },
                {
                    '$group': {
                        '_id': None,
                        'total': {'$sum': '$points'}
                    }
                }
            ]

            result = list(self.forwarded_postbacks.aggregate(pipeline))
            total = result[0]['total'] if result else 0

            return {
                'month': f"{now.year}-{now.month:02d}",
                'amount': total,
                'status': 'accumulating',
                'is_locked': False
            }, None

        except Exception as e:
            logger.error(f"Error getting current month earnings: {e}")
            return None, str(e)

    def get_pending_earnings(self, user_id: str):
        """Get all pending earnings (locked but not paid)"""
        try:
            pipeline = [
                {
                    '$match': {
                        'user_id': ObjectId(user_id),
                        'status': {'$in': ['pending', 'processing']}
                    }
                },
                {
                    '$group': {
                        '_id': None,
                        'total': {'$sum': '$amount'}
                    }
                }
            ]

            result = list(self.collection.aggregate(pipeline))
            total = result[0]['total'] if result else 0

            return total, None

        except Exception as e:
            logger.error(f"Error getting pending earnings: {e}")
            return 0, str(e)

    def get_monthly_earnings_history(self, user_id: str, limit: int = 12):
        """Get monthly earnings history"""
        try:
            earnings = list(self.collection.find(
                {'user_id': ObjectId(user_id)}
            ).sort('created_at', -1).limit(limit))

            # Format response
            formatted = []
            for earning in earnings:
                formatted.append({
                    'id': str(earning['_id']),
                    'month': earning['month'],
                    'year': earning['year'],
                    'amount': earning['amount'],
                    'status': earning['status'],
                    'payment_date': earning.get('payment_date').isoformat() if earning.get('payment_date') else None,
                    'transaction_id': earning.get('transaction_id'),
                    'created_at': earning['created_at'].isoformat()
                })

            return formatted, None

        except Exception as e:
            logger.error(f"Error getting earnings history: {e}")
            return [], str(e)

    def lock_month_earnings(self, user_id: str, year: int, month: int):
        """Lock earnings for a specific month"""
        try:
            # Get month range
            month_start = datetime(year, month, 1)
            if month == 12:
                month_end = datetime(year + 1, 1, 1)
            else:
                month_end = datetime(year, month + 1, 1)

            # Calculate total points from forwarded_postbacks
            pipeline = [
                {
                    '$match': {
                        'publisher_id': user_id,
                        'timestamp': {
                            '$gte': month_start,
                            '$lt': month_end
                        }
                    }
                },
                {
                    '$group': {
                        '_id': None,
                        'total': {'$sum': '$points'}
                    }
                }
            ]

            result = list(self.forwarded_postbacks.aggregate(pipeline))
            total = result[0]['total'] if result else 0

            # Only lock if there are earnings
            if total > 0:
                # Create monthly earnings record
                doc = {
                    'user_id': ObjectId(user_id),
                    'month': f"{year}-{month:02d}",
                    'year': year,
                    'amount': total,
                    'status': 'pending',  # Will check threshold later
                    'created_at': datetime.utcnow(),
                    'updated_at': datetime.utcnow()
                }

                result = self.collection.insert_one(doc)
                return str(result.inserted_id), None

            return None, "No earnings to lock"

        except Exception as e:
            logger.error(f"Error locking month earnings: {e}")
            return None, str(e)

    def update_earnings_status(self, earning_id: str, status: str, payment_date=None, transaction_id=None):
        """Update earnings status"""
        try:
            update_doc = {
                'status': status,
                'updated_at': datetime.utcnow()
            }

            if payment_date:
                update_doc['payment_date'] = payment_date
            if transaction_id:
                update_doc['transaction_id'] = transaction_id

            result = self.collection.update_one(
                {'_id': ObjectId(earning_id)},
                {'$set': update_doc}
            )

            return result.modified_count > 0, None

        except Exception as e:
            logger.error(f"Error updating earnings status: {e}")
            return False, str(e)

    def calculate_next_payment_date(self, locked_date: datetime):
        """Calculate next payment date (Net-30)"""
        return locked_date + timedelta(days=30)
