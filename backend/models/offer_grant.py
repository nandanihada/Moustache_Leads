"""
Offer Grant Model — Per-user offer visibility grants.
When admin recommends inactive offers to a specific user, a grant is created
so that user can see the offer even though it's globally inactive.
Grants expire after 30 days if the user hasn't clicked the offer.
"""
from datetime import datetime, timedelta
from bson import ObjectId
from database import db_instance
import logging

logger = logging.getLogger(__name__)

GRANT_DURATION_DAYS = 30


class OfferGrant:
    def __init__(self):
        self.collection = db_instance.get_collection('offer_grants')

    def grant_offers_to_user(self, user_id: str, offer_ids: list, source: str = 'admin', granted_by: str = 'admin'):
        """Create grants for a user to see specific offers."""
        if self.collection is None:
            return []
        grants = []
        now = datetime.utcnow()
        expires = now + timedelta(days=GRANT_DURATION_DAYS)
        for oid in offer_ids:
            # Upsert — don't create duplicates, just refresh expiry
            self.collection.update_one(
                {'user_id': user_id, 'offer_id': oid},
                {'$set': {
                    'user_id': user_id,
                    'offer_id': oid,
                    'source': source,
                    'granted_by': granted_by,
                    'granted_at': now,
                    'expires_at': expires,
                    'clicked': False,
                    'click_date': None,
                    'is_active': True,
                }, '$setOnInsert': {
                    'created_at': now,
                }},
                upsert=True
            )
            grants.append({'user_id': user_id, 'offer_id': oid})
        logger.info(f"✅ Granted {len(grants)} offers to user {user_id} (source: {source}, expires: {expires})")
        return grants

    def get_granted_offer_ids(self, user_id: str):
        """Get all active, non-expired offer IDs granted to a user."""
        if self.collection is None:
            return []
        now = datetime.utcnow()
        grants = self.collection.find({
            'user_id': user_id,
            'is_active': True,
            '$or': [
                {'clicked': True},  # Clicked grants never expire
                {'expires_at': {'$gt': now}},  # Non-clicked grants must not be expired
            ]
        }, {'offer_id': 1})
        return [g['offer_id'] for g in grants]

    def mark_clicked(self, user_id: str, offer_id: str):
        """Mark a grant as clicked — it will never expire."""
        if self.collection is None:
            return
        self.collection.update_one(
            {'user_id': user_id, 'offer_id': offer_id, 'is_active': True},
            {'$set': {'clicked': True, 'click_date': datetime.utcnow()}}
        )

    def expire_stale_grants(self):
        """Deactivate grants that are expired and never clicked. Run periodically."""
        if self.collection is None:
            return 0
        now = datetime.utcnow()
        result = self.collection.update_many(
            {
                'is_active': True,
                'clicked': False,
                'expires_at': {'$lt': now},
            },
            {'$set': {'is_active': False, 'expired_at': now}}
        )
        if result.modified_count > 0:
            logger.info(f"🕐 Expired {result.modified_count} stale offer grants")
        return result.modified_count

    def get_user_grants(self, user_id: str):
        """Get all grants for a user (for admin view)."""
        if self.collection is None:
            return []
        grants = list(self.collection.find({'user_id': user_id}).sort('granted_at', -1))
        for g in grants:
            g['_id'] = str(g['_id'])
        return grants
