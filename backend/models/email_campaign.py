"""
Email Campaign Model
Stores campaign batches and individual campaign emails for the Smart Email Campaign system.
"""

from datetime import datetime
from bson import ObjectId
from database import db_instance
import logging

logger = logging.getLogger(__name__)


class EmailCampaign:
    """Model for managing email campaign batches"""
    
    COLLECTION_NAME = 'email_campaigns'
    EMAILS_COLLECTION = 'campaign_emails'
    OFFER_SENDS_COLLECTION = 'offer_sends_tracking'
    
    # Campaign statuses
    STATUS_DRAFT = 'draft'
    STATUS_QUEUED = 'queued'
    STATUS_SENDING = 'sending'
    STATUS_PAUSED = 'paused'
    STATUS_COMPLETED = 'completed'
    STATUS_FAILED = 'failed'
    STATUS_CANCELLED = 'cancelled'
    
    # Individual email statuses
    EMAIL_PENDING = 'pending'
    EMAIL_READY = 'ready'
    EMAIL_SENDING = 'sending'
    EMAIL_SENT = 'sent'
    EMAIL_FAILED = 'failed'
    EMAIL_CANCELLED = 'cancelled'
    
    @classmethod
    def get_collection(cls):
        db = db_instance.get_db()
        if db is None:
            return None
        return db[cls.COLLECTION_NAME]
    
    @classmethod
    def get_emails_collection(cls):
        db = db_instance.get_db()
        if db is None:
            return None
        return db[cls.EMAILS_COLLECTION]
    
    @classmethod
    def get_sends_collection(cls):
        db = db_instance.get_db()
        if db is None:
            return None
        return db[cls.OFFER_SENDS_COLLECTION]
    
    @classmethod
    def create_campaign(cls, data: dict) -> dict:
        """Create a new email campaign batch"""
        collection = cls.get_collection()
        if collection is None:
            return None
        
        now = datetime.utcnow()
        campaign = {
            'batch_name': data.get('batch_name', f'Campaign {now.strftime("%b %d %H:%M")}'),
            'source_tab': data.get('source_tab', 'all'),
            'status': cls.STATUS_QUEUED,
            
            # User selection
            'user_ids': data.get('user_ids', []),
            'user_count': len(data.get('user_ids', [])),
            
            # Campaign settings
            'total_offers_per_user': data.get('total_offers_per_user', 3),
            'offers_per_email': data.get('offers_per_email', 1),
            'cooldown_days': data.get('cooldown_days', 1),
            'price_percentage': data.get('price_percentage', 80),  # % of admin price
            
            # Email content
            'subject': data.get('subject', ''),
            'message_body': data.get('message_body', ''),
            'email_settings': data.get('email_settings', {}),
            
            # Schedule
            'send_type': data.get('send_type', 'send_now'),  # send_now, schedule
            'scheduled_at': data.get('scheduled_at'),
            'interval_hours': data.get('interval_hours', 24),  # hours between emails to same user
            
            # Progress tracking
            'total_emails': 0,
            'sent_count': 0,
            'failed_count': 0,
            'pending_count': 0,
            
            # Tracking
            'total_opens': 0,
            'total_clicks': 0,
            
            # Audit
            'created_by': data.get('created_by', ''),
            'created_by_username': data.get('created_by_username', ''),
            'created_at': now,
            'updated_at': now,
            'started_at': None,
            'completed_at': None,
            'paused_at': None,
        }
        
        result = collection.insert_one(campaign)
        campaign['_id'] = result.inserted_id
        return campaign
    
    @classmethod
    def create_campaign_email(cls, data: dict) -> dict:
        """Create an individual email entry in a campaign"""
        collection = cls.get_emails_collection()
        if collection is None:
            return None
        
        now = datetime.utcnow()
        email = {
            'campaign_id': data.get('campaign_id'),
            'user_id': data.get('user_id'),
            'username': data.get('username', ''),
            'email': data.get('email', ''),
            'email_number': data.get('email_number', 1),  # 1st, 2nd, 3rd email to this user
            
            # Offers in this email
            'offer_ids': data.get('offer_ids', []),
            'offer_names': data.get('offer_names', []),
            'offer_count': len(data.get('offer_ids', [])),
            
            # Status
            'status': cls.EMAIL_PENDING,
            'scheduled_at': data.get('scheduled_at'),
            'sent_at': None,
            'error_message': None,
            'retry_count': 0,
            
            # Tracking
            'opened': False,
            'opened_at': None,
            'clicked': False,
            'clicked_at': None,
            'click_count': 0,
            
            # Content (stored for retry)
            'subject': data.get('subject', ''),
            'html_body': data.get('html_body', ''),
            
            # Audit
            'created_at': now,
            'updated_at': now,
        }
        
        result = collection.insert_one(email)
        email['_id'] = result.inserted_id
        return email
    
    @classmethod
    def track_offer_sent(cls, user_id: str, offer_ids: list, campaign_id: str = None):
        """Track that offers were sent to a user (for never-repeat logic)"""
        collection = cls.get_sends_collection()
        if collection is None:
            return
        
        now = datetime.utcnow()
        docs = []
        for oid in offer_ids:
            docs.append({
                'user_id': user_id,
                'offer_id': oid,
                'campaign_id': str(campaign_id) if campaign_id else None,
                'sent_at': now,
            })
        
        if docs:
            collection.insert_many(docs)
    
    @classmethod
    def get_sent_offer_ids(cls, user_id: str) -> set:
        """Get all offer IDs previously sent to a user"""
        collection = cls.get_sends_collection()
        if collection is None:
            return set()
        
        docs = collection.find({'user_id': user_id}, {'offer_id': 1})
        return {d['offer_id'] for d in docs}
    
    @classmethod
    def get_campaign(cls, campaign_id: str) -> dict:
        """Get a campaign by ID"""
        collection = cls.get_collection()
        if collection is None:
            return None
        try:
            return collection.find_one({'_id': ObjectId(campaign_id)})
        except:
            return None
    
    @classmethod
    def update_campaign(cls, campaign_id: str, updates: dict):
        """Update campaign fields"""
        collection = cls.get_collection()
        if collection is None:
            return False
        updates['updated_at'] = datetime.utcnow()
        try:
            collection.update_one({'_id': ObjectId(campaign_id)}, {'$set': updates})
            return True
        except:
            return False
    
    @classmethod
    def get_campaigns(cls, page: int = 1, per_page: int = 20, status: str = None) -> dict:
        """Get paginated campaigns list"""
        collection = cls.get_collection()
        if collection is None:
            return {'campaigns': [], 'total': 0}
        
        query = {}
        if status and status != 'all':
            query['status'] = status
        
        total = collection.count_documents(query)
        campaigns = list(
            collection.find(query)
            .sort('created_at', -1)
            .skip((page - 1) * per_page)
            .limit(per_page)
        )
        
        # Convert ObjectId to string for JSON serialization
        for c in campaigns:
            if '_id' in c:
                c['_id'] = str(c['_id'])
        
        return {'campaigns': campaigns, 'total': total}
    
    @classmethod
    def get_campaign_emails(cls, campaign_id: str, status: str = None) -> list:
        """Get all emails for a campaign"""
        collection = cls.get_emails_collection()
        if collection is None:
            return []
        
        query = {'campaign_id': str(campaign_id)}
        if status and status != 'all':
            query['status'] = status
        
        return list(collection.find(query).sort('scheduled_at', 1))
    
    @classmethod
    def get_due_emails(cls, limit: int = 50) -> list:
        """Get emails that are due to be sent. Uses atomic find_and_modify to prevent duplicates."""
        collection = cls.get_emails_collection()
        if collection is None:
            return []
        
        from pymongo import ReturnDocument
        now = datetime.utcnow()
        claimed = []
        
        # Atomically claim emails one by one to prevent race conditions
        for _ in range(limit):
            doc = collection.find_one_and_update(
                {
                    'status': {'$in': [cls.EMAIL_PENDING, cls.EMAIL_READY]},
                    'scheduled_at': {'$lte': now}
                },
                {
                    '$set': {
                        'status': cls.EMAIL_SENDING,
                        'updated_at': now
                    }
                },
                sort=[('scheduled_at', 1)],
                return_document=ReturnDocument.AFTER
            )
            if doc is None:
                break
            claimed.append(doc)
        
        return claimed
    
    @classmethod
    def update_email_status(cls, email_id, status: str, extra: dict = None):
        """Update individual email status"""
        collection = cls.get_emails_collection()
        if collection is None:
            return
        
        updates = {'status': status, 'updated_at': datetime.utcnow()}
        if extra:
            updates.update(extra)
        
        try:
            collection.update_one({'_id': ObjectId(str(email_id))}, {'$set': updates})
        except:
            pass
    
    @classmethod
    def update_campaign_progress(cls, campaign_id: str):
        """Recalculate campaign progress from its emails"""
        collection = cls.get_collection()
        emails_col = cls.get_emails_collection()
        if collection is None:
            return
        if emails_col is None:
            return
        
        cid = str(campaign_id)
        pipeline = [
            {'$match': {'campaign_id': cid}},
            {'$group': {
                '_id': '$status',
                'count': {'$sum': 1}
            }}
        ]
        
        status_counts = {}
        for doc in emails_col.aggregate(pipeline):
            status_counts[doc['_id']] = doc['count']
        
        total = sum(status_counts.values())
        sent = status_counts.get(cls.EMAIL_SENT, 0)
        failed = status_counts.get(cls.EMAIL_FAILED, 0)
        pending = status_counts.get(cls.EMAIL_PENDING, 0) + status_counts.get(cls.EMAIL_READY, 0)
        
        updates = {
            'total_emails': total,
            'sent_count': sent,
            'failed_count': failed,
            'pending_count': pending,
            'updated_at': datetime.utcnow(),
        }
        
        # Auto-complete if all done
        if pending == 0 and total > 0:
            updates['status'] = cls.STATUS_COMPLETED
            updates['completed_at'] = datetime.utcnow()
        
        try:
            collection.update_one({'_id': ObjectId(cid)}, {'$set': updates})
        except:
            pass
