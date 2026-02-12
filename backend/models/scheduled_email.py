"""
Scheduled Email Model
Stores scheduled emails for partner notifications about missing offers.
"""

from datetime import datetime
from bson import ObjectId
from database import db_instance

class ScheduledEmail:
    """Model for managing scheduled emails to partners"""
    
    COLLECTION_NAME = 'scheduled_emails'
    
    # Email status options
    STATUS_PENDING = 'pending'
    STATUS_SENT = 'sent'
    STATUS_FAILED = 'failed'
    STATUS_CANCELLED = 'cancelled'
    
    @classmethod
    def get_collection(cls):
        db = db_instance.get_db()
        if db is None:
            return None
        return db[cls.COLLECTION_NAME]
    
    @classmethod
    def create(cls, subject: str, body: str, recipients: list, 
               scheduled_at: datetime, created_by: str,
               related_offer_ids: list = None, network: str = None,
               email_type: str = 'missing_offers') -> dict:
        """
        Create a new scheduled email.
        
        Args:
            subject: Email subject
            body: Email body (HTML supported)
            recipients: List of email addresses
            scheduled_at: When to send the email
            created_by: User ID who created this
            related_offer_ids: List of missing offer IDs this email is about
            network: Partner network name
            email_type: Type of email (missing_offers, reminder, etc.)
        """
        collection = cls.get_collection()
        if collection is None:
            return None
        
        now = datetime.utcnow()
        
        scheduled_email = {
            'subject': subject,
            'body': body,
            'recipients': recipients,
            'scheduled_at': scheduled_at,
            'email_type': email_type,
            'network': network,
            
            # Related data
            'related_offer_ids': related_offer_ids or [],
            'offer_count': len(related_offer_ids) if related_offer_ids else 0,
            
            # Status tracking
            'status': cls.STATUS_PENDING,
            'sent_at': None,
            'error_message': None,
            'retry_count': 0,
            
            # Audit
            'created_by': created_by,
            'created_at': now,
            'updated_at': now,
            'cancelled_at': None,
            'cancelled_by': None
        }
        
        result = collection.insert_one(scheduled_email)
        scheduled_email['_id'] = result.inserted_id
        return scheduled_email
    
    @classmethod
    def get_all(cls, status: str = None, network: str = None,
                page: int = 1, per_page: int = 20,
                include_past: bool = True) -> dict:
        """
        Get all scheduled emails with filtering and pagination.
        """
        collection = cls.get_collection()
        if collection is None:
            return {'emails': [], 'total': 0, 'page': page, 'per_page': per_page}
        
        # Build query
        query = {}
        if status:
            query['status'] = status
        if network:
            query['network'] = network
        if not include_past:
            query['scheduled_at'] = {'$gte': datetime.utcnow()}
        
        # Get total count
        total = collection.count_documents(query)
        
        # Get paginated results
        skip = (page - 1) * per_page
        cursor = collection.find(query).sort('scheduled_at', 1).skip(skip).limit(per_page)
        
        emails = []
        for doc in cursor:
            doc['_id'] = str(doc['_id'])
            emails.append(doc)
        
        return {
            'emails': emails,
            'total': total,
            'page': page,
            'per_page': per_page,
            'pages': (total + per_page - 1) // per_page
        }
    
    @classmethod
    def get_pending_to_send(cls) -> list:
        """
        Get all pending emails that are due to be sent.
        """
        collection = cls.get_collection()
        if collection is None:
            return []
        
        now = datetime.utcnow()
        cursor = collection.find({
            'status': cls.STATUS_PENDING,
            'scheduled_at': {'$lte': now}
        }).sort('scheduled_at', 1)
        
        emails = []
        for doc in cursor:
            doc['_id'] = str(doc['_id'])
            emails.append(doc)
        return emails
    
    @classmethod
    def get_due_emails(cls) -> list:
        """
        Alias for get_pending_to_send - Get all pending emails that are due to be sent.
        Used by the scheduled email service.
        """
        return cls.get_pending_to_send()
    
    @classmethod
    def get_by_id(cls, email_id: str) -> dict:
        """
        Get a single scheduled email by ID.
        """
        collection = cls.get_collection()
        if collection is None:
            return None
        
        doc = collection.find_one({'_id': ObjectId(email_id)})
        if doc:
            doc['_id'] = str(doc['_id'])
        return doc
    
    @classmethod
    def update(cls, email_id: str, updates: dict) -> bool:
        """
        Update a scheduled email.
        """
        collection = cls.get_collection()
        if collection is None:
            return False
        
        updates['updated_at'] = datetime.utcnow()
        
        result = collection.update_one(
            {'_id': ObjectId(email_id)},
            {'$set': updates}
        )
        return result.modified_count > 0
    
    @classmethod
    def mark_sent(cls, email_id: str) -> bool:
        """
        Mark an email as sent.
        """
        collection = cls.get_collection()
        if collection is None:
            return False
        
        result = collection.update_one(
            {'_id': ObjectId(email_id)},
            {'$set': {
                'status': cls.STATUS_SENT,
                'sent_at': datetime.utcnow(),
                'updated_at': datetime.utcnow()
            }}
        )
        return result.modified_count > 0
    
    @classmethod
    def mark_failed(cls, email_id: str, error_message: str) -> bool:
        """
        Mark an email as failed.
        """
        collection = cls.get_collection()
        if collection is None:
            return False
        
        result = collection.update_one(
            {'_id': ObjectId(email_id)},
            {
                '$set': {
                    'status': cls.STATUS_FAILED,
                    'error_message': error_message,
                    'updated_at': datetime.utcnow()
                },
                '$inc': {'retry_count': 1}
            }
        )
        return result.modified_count > 0
    
    @classmethod
    def cancel(cls, email_id: str, cancelled_by: str) -> bool:
        """
        Cancel a scheduled email.
        """
        collection = cls.get_collection()
        if collection is None:
            return False
        
        result = collection.update_one(
            {'_id': ObjectId(email_id), 'status': cls.STATUS_PENDING},
            {'$set': {
                'status': cls.STATUS_CANCELLED,
                'cancelled_at': datetime.utcnow(),
                'cancelled_by': cancelled_by,
                'updated_at': datetime.utcnow()
            }}
        )
        return result.modified_count > 0
    
    @classmethod
    def delete(cls, email_id: str) -> bool:
        """
        Delete a scheduled email.
        """
        collection = cls.get_collection()
        if collection is None:
            return False
        
        result = collection.delete_one({'_id': ObjectId(email_id)})
        return result.deleted_count > 0
    
    @classmethod
    def get_stats(cls) -> dict:
        """
        Get statistics about scheduled emails.
        """
        collection = cls.get_collection()
        if collection is None:
            return {}
        
        now = datetime.utcnow()
        
        return {
            'total': collection.count_documents({}),
            'pending': collection.count_documents({'status': cls.STATUS_PENDING}),
            'sent': collection.count_documents({'status': cls.STATUS_SENT}),
            'failed': collection.count_documents({'status': cls.STATUS_FAILED}),
            'cancelled': collection.count_documents({'status': cls.STATUS_CANCELLED}),
            'upcoming': collection.count_documents({
                'status': cls.STATUS_PENDING,
                'scheduled_at': {'$gt': now}
            }),
            'overdue': collection.count_documents({
                'status': cls.STATUS_PENDING,
                'scheduled_at': {'$lte': now}
            })
        }
