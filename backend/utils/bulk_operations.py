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

# Batch size for bulk operations - optimized for 30 second timeout
BATCH_SIZE = 100

# Explicit exports
__all__ = [
    'BulkOfferProcessor',
    'BulkInventoryChecker',
    'get_bulk_offer_processor',
    'get_bulk_inventory_checker',
    'BATCH_SIZE'
]


class BulkOfferProcessor:
    """
    Optimized processor for bulk offer operations.
    Uses batch queries and bulk inserts to handle 1000+ offers within timeout limits.
    """
    
    def __init__(self, db_instance):
        self.db = db_instance.get_db()
        self.offers_collection = self.db['offers'] if self.db is not None else None
        self.missing_offers_collection = self.db['missing_offers'] if self.db is not None else None
    
    def bulk_check_duplicates(self, offers_data: List[Dict]) -> Dict[str, Dict]:
        """
        Check duplicates for all offers in ONE query instead of per-offer.
        
        Returns:
            Dict mapping offer identifiers to existing offer data (if duplicate)
        """
        if not self.offers_collection or not offers_data:
            return {}
        
        # Collect all possible duplicate identifiers
        campaign_ids = []
        names_networks = []
        tracking_urls = []
        
        for offer in offers_data:
            if offer.get('campaign_id'):
                campaign_ids.append(offer['campaign_id'])
            if offer.get('name') and offer.get('network'):
                names_networks.append({
                    'name': offer['name'],
                    'network': offer['network']
                })
            if offer.get('tracking_url'):
                tracking_urls.append(offer['tracking_url'])
        
        # Build OR query for all potential duplicates
        or_conditions = []
        
        if campaign_ids:
            or_conditions.append({'campaign_id': {'$in': campaign_ids}})
        
        if tracking_urls:
            or_conditions.append({'tracking_url': {'$in': tracking_urls}})
        
        # For name+network, we need individual conditions
        for nn in names_networks[:500]:  # Limit to prevent query size issues
            or_conditions.append({
                'name': {'$regex': f'^{nn["name"]}$', '$options': 'i'},
                'network': {'$regex': f'^{nn["network"]}$', '$options': 'i'}
            })
        
        if not or_conditions:
            return {}
        
        try:
            # Single query to find all potential duplicates
            existing_offers = list(self.offers_collection.find(
                {'$or': or_conditions},
                {'_id': 1, 'offer_id': 1, 'name': 1, 'network': 1, 'campaign_id': 1, 'tracking_url': 1}
            ))
            
            # Build lookup maps
            duplicates = {}
            
            for existing in existing_offers:
                # Map by campaign_id
                if existing.get('campaign_id'):
                    duplicates[f"campaign:{existing['campaign_id']}"] = existing
                
                # Map by name+network (lowercase for case-insensitive matching)
                if existing.get('name') and existing.get('network'):
                    key = f"name_network:{existing['name'].lower()}:{existing['network'].lower()}"
                    duplicates[key] = existing
                
                # Map by tracking_url
                if existing.get('tracking_url'):
                    duplicates[f"url:{existing['tracking_url']}"] = existing
            
            logger.info(f"Bulk duplicate check: found {len(duplicates)} potential duplicates")
            return duplicates
            
        except Exception as e:
            logger.error(f"Error in bulk duplicate check: {e}")
            return {}

    
    def is_duplicate(self, offer_data: Dict, duplicates_map: Dict) -> Tuple[bool, Optional[str], Optional[Dict]]:
        """
        Check if a single offer is a duplicate using pre-fetched duplicates map.
        Much faster than individual queries.
        """
        # Check campaign_id first (most reliable)
        if offer_data.get('campaign_id'):
            key = f"campaign:{offer_data['campaign_id']}"
            if key in duplicates_map:
                existing = duplicates_map[key]
                return True, str(existing.get('_id', existing.get('offer_id', ''))), existing
        
        # Check name+network
        if offer_data.get('name') and offer_data.get('network'):
            key = f"name_network:{offer_data['name'].lower()}:{offer_data['network'].lower()}"
            if key in duplicates_map:
                existing = duplicates_map[key]
                return True, str(existing.get('_id', existing.get('offer_id', ''))), existing
        
        # Check tracking_url
        if offer_data.get('tracking_url'):
            key = f"url:{offer_data['tracking_url']}"
            if key in duplicates_map:
                existing = duplicates_map[key]
                return True, str(existing.get('_id', existing.get('offer_id', ''))), existing
        
        return False, None, None
    
    def bulk_create_offers_optimized(
        self, 
        validated_data: List[Dict], 
        created_by: str,
        duplicate_strategy: str = 'skip'
    ) -> Dict[str, Any]:
        """
        Optimized bulk offer creation using batch operations.
        
        Args:
            validated_data: List of validated offer dictionaries
            created_by: User ID creating the offers
            duplicate_strategy: 'skip', 'update', or 'create_new'
            
        Returns:
            Dict with created_ids, errors, skipped_duplicates, and stats
        """
        if not self.offers_collection:
            return {
                'created_ids': [],
                'errors': [{'error': 'Database not connected'}],
                'skipped_duplicates': [],
                'stats': {'total': 0, 'created': 0, 'skipped': 0, 'errors': 0}
            }
        
        start_time = datetime.utcnow()
        
        # Step 1: Bulk check all duplicates in ONE query
        logger.info(f"Checking duplicates for {len(validated_data)} offers...")
        duplicates_map = self.bulk_check_duplicates(validated_data)
        
        # Step 2: Separate offers into create vs skip
        offers_to_create = []
        skipped_duplicates = []
        errors = []
        
        for offer_data in validated_data:
            row_number = offer_data.pop('_row_number', 'Unknown')
            
            is_dup, existing_id, existing_offer = self.is_duplicate(offer_data, duplicates_map)
            
            if is_dup and duplicate_strategy == 'skip':
                skipped_duplicates.append({
                    'row': row_number,
                    'reason': 'duplicate',
                    'existing_offer_id': existing_id,
                    'name': offer_data.get('name', 'Unknown')
                })
            elif is_dup and duplicate_strategy == 'update':
                # Queue for update (handled separately)
                try:
                    self._update_existing_offer(existing_id, offer_data)
                    skipped_duplicates.append({
                        'row': row_number,
                        'reason': 'updated_existing',
                        'existing_offer_id': existing_id,
                        'name': offer_data.get('name', 'Unknown')
                    })
                except Exception as e:
                    errors.append({
                        'row': row_number,
                        'error': f'Failed to update: {str(e)}',
                        'name': offer_data.get('name', 'Unknown')
                    })
            else:
                # Prepare for bulk insert
                prepared = self._prepare_offer_for_insert(offer_data, created_by, row_number)
                if prepared:
                    offers_to_create.append(prepared)
        
        # Step 3: Bulk insert in batches
        created_ids = []
        
        if offers_to_create:
            logger.info(f"Bulk inserting {len(offers_to_create)} offers in batches of {BATCH_SIZE}...")
            
            for i in range(0, len(offers_to_create), BATCH_SIZE):
                batch = offers_to_create[i:i + BATCH_SIZE]
                batch_num = (i // BATCH_SIZE) + 1
                total_batches = (len(offers_to_create) + BATCH_SIZE - 1) // BATCH_SIZE
                
                try:
                    result = self.offers_collection.insert_many(batch, ordered=False)
                    batch_ids = [doc.get('offer_id') for doc in batch]
                    created_ids.extend(batch_ids)
                    logger.info(f"Batch {batch_num}/{total_batches}: inserted {len(result.inserted_ids)} offers")
                except Exception as e:
                    # Handle partial failures in batch
                    logger.error(f"Batch {batch_num} partial failure: {e}")
                    # Try to identify which succeeded
                    for doc in batch:
                        try:
                            existing = self.offers_collection.find_one({'offer_id': doc['offer_id']})
                            if existing:
                                created_ids.append(doc['offer_id'])
                        except:
                            errors.append({
                                'row': doc.get('_source_row', 'Unknown'),
                                'error': str(e),
                                'name': doc.get('name', 'Unknown')
                            })
        
        elapsed = (datetime.utcnow() - start_time).total_seconds()
        
        result = {
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
        
        logger.info(f"Bulk create complete: {len(created_ids)} created, {len(skipped_duplicates)} skipped, {len(errors)} errors in {elapsed:.2f}s")
        
        return result

    
    def _prepare_offer_for_insert(self, offer_data: Dict, created_by: str, row_number: Any) -> Optional[Dict]:
        """Prepare a single offer document for bulk insert."""
        try:
            # Generate offer_id
            import random
            import string
            offer_id = f"ML-{''.join(random.choices(string.digits, k=5))}"
            
            # Ensure unique offer_id
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
            
            # Remove any None values
            doc = {k: v for k, v in doc.items() if v is not None}
            
            return doc
            
        except Exception as e:
            logger.error(f"Error preparing offer: {e}")
            return None
    
    def _update_existing_offer(self, offer_id: str, new_data: Dict) -> bool:
        """Update an existing offer with new data."""
        try:
            # Remove fields that shouldn't be updated
            update_data = {k: v for k, v in new_data.items() 
                         if k not in ['_id', 'offer_id', 'created_at', 'created_by']}
            update_data['updated_at'] = datetime.utcnow()
            
            result = self.offers_collection.update_one(
                {'$or': [{'_id': ObjectId(offer_id)}, {'offer_id': offer_id}]},
                {'$set': update_data}
            )
            return result.modified_count > 0
        except Exception as e:
            logger.error(f"Error updating offer {offer_id}: {e}")
            raise


class BulkInventoryChecker:
    """
    Optimized inventory gap checker for Missing Offers feature.
    Uses batch queries to check 1000+ offers against inventory quickly.
    """
    
    def __init__(self, db_instance):
        self.db = db_instance.get_db()
        self.offers_collection = self.db['offers'] if self.db is not None else None
        self.missing_offers_collection = self.db['missing_offers'] if self.db is not None else None
    
    def bulk_check_inventory(self, offers_data: List[Dict]) -> Dict[str, Any]:
        """
        Check multiple offers against inventory in optimized batches.
        
        Returns:
            Dict with in_inventory, not_in_inventory lists and stats
        """
        if not self.offers_collection or not offers_data:
            return {
                'in_inventory': [],
                'not_in_inventory': offers_data,
                'stats': {'total': len(offers_data), 'have': 0, 'dont_have': len(offers_data)}
            }
        
        start_time = datetime.utcnow()
        
        # Step 1: Extract all names for batch lookup
        names = [o.get('name', '').strip() for o in offers_data if o.get('name')]
        
        # Step 2: Batch query for existing offers by name
        existing_map = {}
        
        if names:
            # Query in batches to avoid query size limits
            for i in range(0, len(names), 500):
                batch_names = names[i:i + 500]
                
                try:
                    # Use regex for case-insensitive matching
                    regex_conditions = [
                        {'name': {'$regex': f'^{self._escape_regex(n)}$', '$options': 'i'}}
                        for n in batch_names
                    ]
                    
                    existing = list(self.offers_collection.find(
                        {'$or': regex_conditions},
                        {'_id': 1, 'offer_id': 1, 'name': 1, 'payout': 1, 'countries': 1, 'payout_model': 1}
                    ))
                    
                    for offer in existing:
                        key = offer.get('name', '').lower().strip()
                        existing_map[key] = offer
                        
                except Exception as e:
                    logger.error(f"Error in batch inventory check: {e}")
        
        # Step 3: Categorize offers
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
                'country': self._normalize_country(offer_data.get('countries', [])),
                'platform': self._detect_platform(name),
                'payout_model': offer_data.get('payout_model', 'Unknown'),
                'payout': offer_data.get('payout', 0),
                'network': offer_data.get('network', 'Unknown')
            }
            
            if name_lower in existing_map:
                existing = existing_map[name_lower]
                result_item['existing_offer_id'] = str(existing.get('_id', ''))
                
                # Check for price mismatch
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
        
        total = len(offers_data)
        have = len(in_inventory)
        dont_have = len(not_in_inventory)
        
        return {
            'in_inventory': in_inventory,
            'not_in_inventory': not_in_inventory,
            'price_mismatches': price_mismatches,
            'stats': {
                'total': total,
                'have': have,
                'dont_have': dont_have,
                'price_mismatches': len(price_mismatches),
                'have_percent': round(have / total * 100, 1) if total else 0,
                'dont_have_percent': round(dont_have / total * 100, 1) if total else 0,
                'elapsed_seconds': round(elapsed, 2)
            }
        }
    
    def _escape_regex(self, text: str) -> str:
        """Escape special regex characters."""
        import re
        return re.escape(text)
    
    def _normalize_country(self, country: Any) -> str:
        """Normalize country value."""
        if not country:
            return 'GLOBAL'
        if isinstance(country, list):
            if len(country) == 0:
                return 'GLOBAL'
            elif len(country) == 1:
                return str(country[0]).strip().upper()
            else:
                return ','.join(sorted([str(c).strip().upper() for c in country[:5]]))
        return str(country).strip().upper()
    
    def _detect_platform(self, name: str) -> str:
        """Detect platform from offer name."""
        if not name:
            return 'All'
        
        name_lower = name.lower()
        
        if any(p in name_lower for p in ['ios', 'iphone', 'ipad', 'apple']):
            return 'iOS'
        if any(p in name_lower for p in ['android', 'google play', 'apk']):
            return 'Android'
        if any(p in name_lower for p in ['web', 'desktop', 'browser']):
            return 'Web'
        
        return 'All'


def get_bulk_offer_processor(db_instance) -> BulkOfferProcessor:
    """Factory function to get bulk offer processor."""
    return BulkOfferProcessor(db_instance)


def get_bulk_inventory_checker(db_instance) -> BulkInventoryChecker:
    """Factory function to get bulk inventory checker."""
    return BulkInventoryChecker(db_instance)
