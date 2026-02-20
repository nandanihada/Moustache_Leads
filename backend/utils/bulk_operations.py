"""
Optimized Bulk Operations for Large Dataset Processing
Handles bulk inserts, duplicate detection, and inventory checks efficiently
to avoid Render/Gunicorn worker timeouts (30 second limit)
"""

import logging
from datetime import datetime
from typing import Dict, List, Tuple, Any, Optional
from bson import ObjectId

logger = logging.getLogger(__name__)

BATCH_SIZE = 100

__all__ = [
    'BulkOfferProcessor',
    'BulkInventoryChecker',
    'get_bulk_offer_processor',
    'get_bulk_inventory_checker',
    'BATCH_SIZE'
]


class BulkOfferProcessor:
    """Optimized processor for bulk offer operations."""
    
    def __init__(self, db_instance):
        self.db = db_instance.get_db()
        self.offers_collection = self.db['offers'] if self.db is not None else None
    
    def bulk_check_duplicates(self, offers_data: List[Dict]) -> Dict[str, Dict]:
        """Check duplicates for all offers in ONE query."""
        if self.offers_collection is None or not offers_data:
            return {}
        
        campaign_ids = [o.get('campaign_id') for o in offers_data if o.get('campaign_id')]
        tracking_urls = [o.get('tracking_url') for o in offers_data if o.get('tracking_url')]
        
        or_conditions = []
        if campaign_ids:
            or_conditions.append({'campaign_id': {'$in': campaign_ids}})
        if tracking_urls:
            or_conditions.append({'tracking_url': {'$in': tracking_urls}})
        
        if not or_conditions:
            return {}
        
        try:
            existing_offers = list(self.offers_collection.find(
                {'$or': or_conditions},
                {'_id': 1, 'offer_id': 1, 'name': 1, 'campaign_id': 1, 'tracking_url': 1}
            ))
            
            duplicates = {}
            for existing in existing_offers:
                if existing.get('campaign_id'):
                    duplicates[f"campaign:{existing['campaign_id']}"] = existing
                if existing.get('tracking_url'):
                    duplicates[f"url:{existing['tracking_url']}"] = existing
            
            logger.info(f"Bulk duplicate check: found {len(duplicates)} duplicates")
            return duplicates
        except Exception as e:
            logger.error(f"Error in bulk duplicate check: {e}")
            return {}
    
    def is_duplicate(self, offer_data: Dict, duplicates_map: Dict) -> Tuple[bool, Optional[str], Optional[Dict]]:
        """Check if offer is duplicate using pre-fetched map."""
        if offer_data.get('campaign_id'):
            key = f"campaign:{offer_data['campaign_id']}"
            if key in duplicates_map:
                existing = duplicates_map[key]
                return True, str(existing.get('_id', '')), existing
        
        if offer_data.get('tracking_url'):
            key = f"url:{offer_data['tracking_url']}"
            if key in duplicates_map:
                existing = duplicates_map[key]
                return True, str(existing.get('_id', '')), existing
        
        return False, None, None
    
    def bulk_create_offers_optimized(self, validated_data: List[Dict], created_by: str, duplicate_strategy: str = 'skip') -> Dict[str, Any]:
        """Optimized bulk offer creation."""
        if self.offers_collection is None:
            return {
                'created_ids': [],
                'errors': [{'error': 'Database not connected'}],
                'skipped_duplicates': [],
                'stats': {'total': 0, 'created': 0, 'skipped': 0, 'errors': 0}
            }
        
        start_time = datetime.utcnow()
        duplicates_map = self.bulk_check_duplicates(validated_data)
        
        offers_to_create = []
        skipped_duplicates = []
        errors = []
        
        for offer_data in validated_data:
            row_number = offer_data.pop('_row_number', 'Unknown')
            is_dup, existing_id, _ = self.is_duplicate(offer_data, duplicates_map)
            
            if is_dup and duplicate_strategy == 'skip':
                skipped_duplicates.append({
                    'row': row_number,
                    'reason': 'duplicate',
                    'existing_offer_id': existing_id,
                    'name': offer_data.get('name', 'Unknown')
                })
            else:
                prepared = self._prepare_offer_for_insert(offer_data, created_by, row_number)
                if prepared:
                    offers_to_create.append(prepared)
        
        created_ids = []
        if offers_to_create:
            for i in range(0, len(offers_to_create), BATCH_SIZE):
                batch = offers_to_create[i:i + BATCH_SIZE]
                try:
                    result = self.offers_collection.insert_many(batch, ordered=False)
                    batch_ids = [doc.get('offer_id') for doc in batch]
                    created_ids.extend(batch_ids)
                except Exception as e:
                    logger.error(f"Batch insert error: {e}")
                    for doc in batch:
                        errors.append({
                            'row': doc.get('_source_row', 'Unknown'),
                            'error': str(e),
                            'name': doc.get('name', 'Unknown')
                        })
        
        elapsed = (datetime.utcnow() - start_time).total_seconds()
        
        return {
            'created_ids': created_ids,
            'errors': errors,
            'skipped_duplicates': skipped_duplicates,
            'stats': {
                'total': len(validated_data),
                'created': len(created_ids),
                'skipped': len(skipped_duplicates),
                'errors': len(errors),
                'elapsed_seconds': round(elapsed, 2)
            }
        }
    
    def _prepare_offer_for_insert(self, offer_data: Dict, created_by: str, row_number: Any) -> Optional[Dict]:
        """Prepare offer document for bulk insert."""
        try:
            import random, string
            offer_id = f"ML-{''.join(random.choices(string.digits, k=5))}"
            
            while self.offers_collection.find_one({'offer_id': offer_id}):
                offer_id = f"ML-{''.join(random.choices(string.digits, k=5))}"
            
            doc = {
                **offer_data,
                'offer_id': offer_id,
                'created_at': datetime.utcnow(),
                'updated_at': datetime.utcnow(),
                'created_by': created_by,
                'is_active': offer_data.get('is_active', True),
                'status': offer_data.get('status', 'active'),
                '_source_row': row_number
            }
            
            return {k: v for k, v in doc.items() if v is not None}
        except Exception as e:
            logger.error(f"Error preparing offer: {e}")
            return None


class BulkInventoryChecker:
    """Optimized inventory gap checker."""
    
    def __init__(self, db_instance):
        self.db = db_instance.get_db()
        self.offers_collection = self.db['offers'] if self.db is not None else None
    
    def bulk_check_inventory(self, offers_data: List[Dict]) -> Dict[str, Any]:
        """Check multiple offers against inventory."""
        if self.offers_collection is None or not offers_data:
            return {
                'in_inventory': [],
                'not_in_inventory': offers_data,
                'price_mismatches': [],
                'stats': {'total': len(offers_data), 'have': 0, 'dont_have': len(offers_data), 'elapsed_seconds': 0}
            }
        
        start_time = datetime.utcnow()
        names = [o.get('name', '').strip() for o in offers_data if o.get('name')]
        
        existing_map = {}
        if names:
            for i in range(0, len(names), 500):
                batch_names = names[i:i + 500]
                try:
                    import re
                    regex_conditions = [
                        {'name': {'$regex': f'^{re.escape(n)}$', '$options': 'i'}}
                        for n in batch_names
                    ]
                    
                    existing = list(self.offers_collection.find(
                        {'$or': regex_conditions},
                        {'_id': 1, 'name': 1, 'payout': 1}
                    ))
                    
                    for offer in existing:
                        key = offer.get('name', '').lower().strip()
                        existing_map[key] = offer
                except Exception as e:
                    logger.error(f"Batch inventory check error: {e}")
        
        in_inventory = []
        not_in_inventory = []
        price_mismatches = []
        
        for idx, offer_data in enumerate(offers_data):
            name = offer_data.get('name', '').strip()
            name_lower = name.lower()
            row_number = offer_data.get('_row_number', idx + 1)
            
            result_item = {
                'row': row_number,
                'name': name,
                'payout': offer_data.get('payout', 0),
                'network': offer_data.get('network', 'Unknown')
            }
            
            if name_lower in existing_map:
                existing = existing_map[name_lower]
                result_item['existing_offer_id'] = str(existing.get('_id', ''))
                
                try:
                    new_payout = float(offer_data.get('payout', 0) or 0)
                    existing_payout = float(existing.get('payout', 0) or 0)
                    
                    if abs(new_payout - existing_payout) > 0.01:
                        result_item['price_mismatch'] = {
                            'existing_payout': existing_payout,
                            'new_payout': new_payout,
                            'difference': round(new_payout - existing_payout, 2)
                        }
                        price_mismatches.append(result_item.copy())
                except:
                    pass
                
                in_inventory.append(result_item)
            else:
                not_in_inventory.append(result_item)
        
        elapsed = (datetime.utcnow() - start_time).total_seconds()
        
        return {
            'in_inventory': in_inventory,
            'not_in_inventory': not_in_inventory,
            'price_mismatches': price_mismatches,
            'stats': {
                'total': len(offers_data),
                'have': len(in_inventory),
                'dont_have': len(not_in_inventory),
                'price_mismatches': len(price_mismatches),
                'elapsed_seconds': round(elapsed, 2)
            }
        }


def get_bulk_offer_processor(db_instance) -> BulkOfferProcessor:
    """Factory function to get bulk offer processor."""
    return BulkOfferProcessor(db_instance)


def get_bulk_inventory_checker(db_instance) -> BulkInventoryChecker:
    """Factory function to get bulk inventory checker."""
    return BulkInventoryChecker(db_instance)
