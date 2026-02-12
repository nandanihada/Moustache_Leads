"""
Missing Offers Model - Inventory Gap Detection
Stores offers that DON'T EXIST in our inventory.
Match Key = Name + Country + Platform (iOS/Android/Web) + Payout Model
"""

from datetime import datetime
from bson import ObjectId
from database import db_instance


class MissingOffer:
    """Model for managing inventory gaps - offers we don't have"""
    
    COLLECTION_NAME = 'missing_offers'
    
    @classmethod
    def get_collection(cls):
        db = db_instance.get_db()
        if db is None:
            return None
        return db[cls.COLLECTION_NAME]
    
    @classmethod
    def create(cls, offer_data: dict, match_key: str, name: str, country: str,
               platform: str, payout_model: str, source: str = 'sheet_upload',
               network: str = None, upload_batch_id: str = None) -> dict:
        """
        Create a new missing offer record (inventory gap).
        
        Args:
            offer_data: Original offer data from upload
            match_key: Generated match key (Name | Country | Platform | PayoutModel)
            name: Offer name
            country: Country code(s)
            platform: Platform (iOS/Android/Web/All)
            payout_model: Payout model (CPA/CPI/CPL/etc)
            source: Source of the offer (sheet_upload, api_fetch, manual)
            network: Partner network name
            upload_batch_id: Batch ID for bulk uploads
            
        Returns:
            Created missing offer document
        """
        collection = cls.get_collection()
        if collection is None:
            return None
        
        now = datetime.utcnow()
        
        # Check if this match key already exists (avoid duplicates)
        existing = collection.find_one({'match_key': match_key, 'status': {'$ne': 'resolved'}})
        if existing:
            # Update the existing record with new upload info
            collection.update_one(
                {'_id': existing['_id']},
                {
                    '$set': {
                        'updated_at': now,
                        'last_seen_at': now,
                        'network': network or existing.get('network')
                    },
                    '$inc': {'seen_count': 1}
                }
            )
            existing['_id'] = str(existing['_id'])
            return existing
        
        # Extract payout from offer data
        payout = offer_data.get('payout', 0)
        try:
            payout = float(payout) if payout else 0
        except (ValueError, TypeError):
            payout = 0
        
        missing_offer = {
            # Match key components
            'match_key': match_key,
            'name': name,
            'country': country,
            'platform': platform,
            'payout_model': payout_model,
            
            # Additional offer info
            'payout': payout,
            'description': offer_data.get('description', ''),
            'tracking_url': offer_data.get('tracking_url') or offer_data.get('target_url') or offer_data.get('url', ''),
            'preview_url': offer_data.get('preview_url', ''),
            'vertical': offer_data.get('vertical') or offer_data.get('category', ''),
            
            # Reason for being in missing offers
            'reason': 'not_in_inventory',
            'reason_display': f"Not in inventory: {match_key}",
            
            # Source info
            'source': source,
            'network': network,
            'upload_batch_id': upload_batch_id,
            
            # Status tracking
            'status': 'pending',  # pending, resolved, ignored
            'resolved_at': None,
            'resolved_by': None,
            'resolution_notes': None,
            
            # Email tracking
            'email_sent': False,
            'email_sent_at': None,
            'email_scheduled_id': None,
            
            # Tracking
            'seen_count': 1,
            'last_seen_at': now,
            
            # Original data for reference
            'original_data': offer_data,
            
            # Timestamps
            'created_at': now,
            'updated_at': now
        }
        
        result = collection.insert_one(missing_offer)
        missing_offer['_id'] = result.inserted_id
        return missing_offer
    
    @classmethod
    def get_all(cls, status: str = None, network: str = None, platform: str = None,
                country: str = None, payout_model: str = None,
                page: int = 1, per_page: int = 50, sort_by: str = 'created_at',
                sort_order: int = -1) -> dict:
        """
        Get all missing offers with filtering and pagination.
        """
        collection = cls.get_collection()
        if collection is None:
            return {'offers': [], 'total': 0, 'page': page, 'per_page': per_page}
        
        # Build query
        query = {}
        if status:
            query['status'] = status
        if network:
            query['network'] = network
        if platform:
            query['platform'] = platform
        if country:
            query['country'] = {'$regex': country, '$options': 'i'}
        if payout_model:
            query['payout_model'] = payout_model
        
        # Get total count
        total = collection.count_documents(query)
        
        # Get paginated results
        skip = (page - 1) * per_page
        cursor = collection.find(query).sort(sort_by, sort_order).skip(skip).limit(per_page)
        
        offers = []
        for doc in cursor:
            doc['_id'] = str(doc['_id'])
            offers.append(doc)
        
        return {
            'offers': offers,
            'total': total,
            'page': page,
            'per_page': per_page,
            'pages': (total + per_page - 1) // per_page
        }
    
    @classmethod
    def get_stats(cls) -> dict:
        """
        Get statistics about missing offers (inventory gaps).
        """
        collection = cls.get_collection()
        if collection is None:
            return {}
        
        # Total counts by status (filter out None)
        pipeline = [
            {'$match': {'status': {'$ne': None}}},
            {'$group': {'_id': '$status', 'count': {'$sum': 1}}}
        ]
        status_counts = {}
        for doc in collection.aggregate(pipeline):
            if doc['_id'] is not None:
                status_counts[doc['_id']] = doc['count']
        
        # Counts by platform (filter out None)
        pipeline = [
            {'$match': {'platform': {'$ne': None}}},
            {'$group': {'_id': '$platform', 'count': {'$sum': 1}}}
        ]
        platform_counts = {}
        for doc in collection.aggregate(pipeline):
            if doc['_id'] is not None:
                platform_counts[doc['_id']] = doc['count']
        
        # Counts by payout model (filter out None)
        pipeline = [
            {'$match': {'payout_model': {'$ne': None}}},
            {'$group': {'_id': '$payout_model', 'count': {'$sum': 1}}}
        ]
        payout_model_counts = {}
        for doc in collection.aggregate(pipeline):
            if doc['_id'] is not None:
                payout_model_counts[doc['_id']] = doc['count']
        
        # Counts by network (filter out None and empty)
        pipeline = [
            {'$match': {'network': {'$nin': [None, '']}}},
            {'$group': {'_id': '$network', 'count': {'$sum': 1}}}
        ]
        network_counts = {}
        for doc in collection.aggregate(pipeline):
            if doc['_id'] is not None and doc['_id'] != '':
                network_counts[doc['_id']] = doc['count']
        
        # Top countries (filter out None)
        pipeline = [
            {'$match': {'country': {'$ne': None}}},
            {'$group': {'_id': '$country', 'count': {'$sum': 1}}},
            {'$sort': {'count': -1}},
            {'$limit': 10}
        ]
        top_countries = {}
        for doc in collection.aggregate(pipeline):
            if doc['_id'] is not None:
                top_countries[doc['_id']] = doc['count']
        
        return {
            'total': collection.count_documents({}),
            'by_status': status_counts,
            'by_platform': platform_counts,
            'by_payout_model': payout_model_counts,
            'by_network': network_counts,
            'top_countries': top_countries,
            'pending': status_counts.get('pending', 0),
            'resolved': status_counts.get('resolved', 0),
            'ignored': status_counts.get('ignored', 0)
        }
    
    @classmethod
    def update_status(cls, offer_id: str, status: str, resolved_by: str = None,
                      notes: str = None) -> bool:
        """
        Update the status of a missing offer.
        """
        collection = cls.get_collection()
        if collection is None:
            return False
        
        update_data = {
            'status': status,
            'updated_at': datetime.utcnow()
        }
        
        if status == 'resolved':
            update_data['resolved_at'] = datetime.utcnow()
            update_data['resolved_by'] = resolved_by
            update_data['resolution_notes'] = notes
        
        result = collection.update_one(
            {'_id': ObjectId(offer_id)},
            {'$set': update_data}
        )
        return result.modified_count > 0
    
    @classmethod
    def bulk_update_status(cls, offer_ids: list, status: str, resolved_by: str = None) -> int:
        """
        Bulk update status for multiple offers.
        """
        collection = cls.get_collection()
        if collection is None:
            return 0
        
        object_ids = [ObjectId(oid) for oid in offer_ids]
        
        update_data = {
            'status': status,
            'updated_at': datetime.utcnow()
        }
        
        if status == 'resolved':
            update_data['resolved_at'] = datetime.utcnow()
            update_data['resolved_by'] = resolved_by
        
        result = collection.update_many(
            {'_id': {'$in': object_ids}},
            {'$set': update_data}
        )
        return result.modified_count
    
    @classmethod
    def mark_email_sent(cls, offer_ids: list, scheduled_email_id: str = None) -> int:
        """
        Mark offers as having email sent.
        """
        collection = cls.get_collection()
        if collection is None:
            return 0
        
        object_ids = [ObjectId(oid) for oid in offer_ids]
        
        result = collection.update_many(
            {'_id': {'$in': object_ids}},
            {'$set': {
                'email_sent': True,
                'email_sent_at': datetime.utcnow(),
                'email_scheduled_id': scheduled_email_id,
                'updated_at': datetime.utcnow()
            }}
        )
        return result.modified_count
    
    @classmethod
    def delete(cls, offer_id: str) -> bool:
        """
        Delete a missing offer record.
        """
        collection = cls.get_collection()
        if collection is None:
            return False
        
        result = collection.delete_one({'_id': ObjectId(offer_id)})
        return result.deleted_count > 0
    
    @classmethod
    def get_by_id(cls, offer_id: str) -> dict:
        """
        Get a single missing offer by ID.
        """
        collection = cls.get_collection()
        if collection is None:
            return None
        
        doc = collection.find_one({'_id': ObjectId(offer_id)})
        if doc:
            doc['_id'] = str(doc['_id'])
        return doc
    
    @classmethod
    def get_networks(cls) -> list:
        """
        Get list of unique networks with missing offers.
        """
        collection = cls.get_collection()
        if collection is None:
            return []
        
        return collection.distinct('network', {'network': {'$ne': None}})
    
    @classmethod
    def get_platforms(cls) -> list:
        """
        Get list of unique platforms.
        """
        collection = cls.get_collection()
        if collection is None:
            return []
        
        return collection.distinct('platform')
    
    @classmethod
    def get_payout_models(cls) -> list:
        """
        Get list of unique payout models.
        """
        collection = cls.get_collection()
        if collection is None:
            return []
        
        return collection.distinct('payout_model')
    
    @classmethod
    def get_countries(cls) -> list:
        """
        Get list of unique countries.
        """
        collection = cls.get_collection()
        if collection is None:
            return []
        
        return collection.distinct('country')
    
    @classmethod
    def auto_resolve_if_in_inventory(cls) -> dict:
        """
        Check all pending missing offers against inventory and auto-resolve
        any that now exist in the main offers collection.
        
        Returns:
            Dict with resolved_count and resolved_offers list
        """
        from database import db_instance
        from services.missing_offer_service import MissingOfferService
        
        collection = cls.get_collection()
        if collection is None:
            return {'resolved_count': 0, 'resolved_offers': []}
        
        db = db_instance.get_db()
        if db is None:
            return {'resolved_count': 0, 'resolved_offers': []}
        
        # Get all pending missing offers
        pending_offers = list(collection.find({'status': 'pending'}))
        
        resolved_count = 0
        resolved_offers = []
        
        for missing_offer in pending_offers:
            match_key = missing_offer.get('match_key', '')
            
            # Check if this match key now exists in inventory
            exists, existing_offer = MissingOfferService.check_inventory_exists(match_key)
            
            if exists:
                # Auto-resolve this missing offer
                collection.update_one(
                    {'_id': missing_offer['_id']},
                    {'$set': {
                        'status': 'resolved',
                        'resolved_at': datetime.utcnow(),
                        'resolved_by': 'auto_sync',
                        'resolution_notes': f'Auto-resolved: Found in inventory (offer_id: {existing_offer.get("offer_id", "unknown")})',
                        'updated_at': datetime.utcnow()
                    }}
                )
                resolved_count += 1
                resolved_offers.append({
                    'match_key': match_key,
                    'name': missing_offer.get('name'),
                    'existing_offer_id': existing_offer.get('offer_id')
                })
        
        return {
            'resolved_count': resolved_count,
            'resolved_offers': resolved_offers
        }
