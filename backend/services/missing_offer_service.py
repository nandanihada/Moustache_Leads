"""
Missing Offer Service - Inventory Gap Detection
Detects offers that DON'T EXIST in our inventory based on match key:
Match Key = Name + Country + Platform (iOS/Android/Web) + Payout Model
"""

import logging
import re
from datetime import datetime, timedelta
from typing import Dict, List, Tuple, Any, Optional

from database import db_instance
from models.missing_offer import MissingOffer

logger = logging.getLogger(__name__)


class MissingOfferService:
    """Service for detecting inventory gaps - offers we don't have"""
    
    # Platform detection patterns (case-insensitive)
    PLATFORM_PATTERNS = {
        'iOS': [
            r'\bios\b', r'\biphone\b', r'\bipad\b', r'\bapple\b', 
            r'\bapp store\b', r'\bappstore\b'
        ],
        'Android': [
            r'\bandroid\b', r'\bgoogle play\b', r'\bplay store\b', 
            r'\bplaystore\b', r'\bapk\b'
        ],
        'Web': [
            r'\bweb\b', r'\bwebsite\b', r'\bdesktop\b', r'\bbrowser\b',
            r'\bonline\b', r'\bpc\b', r'\bmac\b', r'\bwindows\b'
        ]
    }
    
    @classmethod
    def detect_platform(cls, name: str) -> str:
        """
        Detect platform from offer name.
        
        Args:
            name: Offer name/title
            
        Returns:
            Platform string: 'iOS', 'Android', 'Web', or 'All'
        """
        if not name:
            return 'All'
        
        name_lower = name.lower()
        
        # Check each platform's patterns
        for platform, patterns in cls.PLATFORM_PATTERNS.items():
            for pattern in patterns:
                if re.search(pattern, name_lower, re.IGNORECASE):
                    return platform
        
        # Default to 'All' if no platform detected
        return 'All'
    
    @classmethod
    def normalize_country(cls, country: Any) -> str:
        """
        Normalize country value to uppercase code.
        
        Args:
            country: Country value (string or list)
            
        Returns:
            Normalized country string (e.g., 'US', 'UK', 'GLOBAL')
        """
        if not country:
            return 'GLOBAL'
        
        if isinstance(country, list):
            if len(country) == 0:
                return 'GLOBAL'
            elif len(country) == 1:
                return str(country[0]).strip().upper()
            else:
                # Multiple countries - sort and join
                return ','.join(sorted([str(c).strip().upper() for c in country]))
        
        return str(country).strip().upper()
    
    @classmethod
    def normalize_payout_model(cls, payout_model: str) -> str:
        """
        Normalize payout model to standard format.
        
        Args:
            payout_model: Payout model string
            
        Returns:
            Normalized payout model (CPA, CPI, CPL, CPS, CPM, RevShare, Unknown)
        """
        if not payout_model:
            return 'Unknown'
        
        model_upper = str(payout_model).strip().upper()
        
        # Map common variations
        model_map = {
            'CPA': 'CPA',
            'CPI': 'CPI',
            'CPL': 'CPL',
            'CPS': 'CPS',
            'CPM': 'CPM',
            'REVSHARE': 'RevShare',
            'REV SHARE': 'RevShare',
            'REVENUE SHARE': 'RevShare',
            'PERCENTAGE': 'RevShare',
            'PERCENT': 'RevShare',
            'COST PER ACTION': 'CPA',
            'COST PER INSTALL': 'CPI',
            'COST PER LEAD': 'CPL',
            'COST PER SALE': 'CPS',
            'COST PER MILLE': 'CPM'
        }
        
        return model_map.get(model_upper, 'Unknown')
    
    @classmethod
    def generate_match_key(cls, offer_data: Dict[str, Any]) -> str:
        """
        Generate unique match key for inventory comparison.
        Match Key = Name + Country + Platform + Payout Model
        
        Args:
            offer_data: Dictionary containing offer data
            
        Returns:
            Match key string (e.g., "Candy Crush | US | iOS | CPI")
        """
        # Get name
        name = offer_data.get('name') or offer_data.get('title') or ''
        name = str(name).strip()
        
        # Get country
        country = offer_data.get('countries') or offer_data.get('country') or offer_data.get('geo') or []
        country_str = cls.normalize_country(country)
        
        # Detect platform from name
        platform = cls.detect_platform(name)
        
        # Get payout model
        payout_model = offer_data.get('payout_model') or offer_data.get('model') or ''
        payout_model_str = cls.normalize_payout_model(payout_model)
        
        # Generate match key
        match_key = f"{name} | {country_str} | {platform} | {payout_model_str}"
        
        return match_key
    
    @classmethod
    def check_inventory_exists(cls, match_key: str) -> Tuple[bool, Optional[Dict]]:
        """
        Check if an offer with this match key exists in our inventory.
        
        Args:
            match_key: The match key to search for
            
        Returns:
            Tuple of (exists: bool, existing_offer: dict or None)
        """
        db = db_instance.get_db()
        if db is None:
            logger.error("Database not connected")
            return False, None
        
        offers_collection = db['offers']
        
        # Parse match key components
        parts = match_key.split(' | ')
        if len(parts) != 4:
            # Skip invalid match keys silently (old data format)
            return False, None
        
        name, country_str, platform, payout_model = parts
        
        # Build query to find matching offer
        # We need to match: name + country + platform (from name) + payout_model
        query = {
            'name': {'$regex': f'^{re.escape(name)}$', '$options': 'i'}  # Case-insensitive exact match
        }
        
        # Add country filter
        if country_str and country_str != 'GLOBAL':
            if ',' in country_str:
                # Multiple countries
                countries = country_str.split(',')
                query['countries'] = {'$all': countries}
            else:
                query['countries'] = country_str
        
        # Add payout model filter if specified
        if payout_model and payout_model != 'Unknown':
            query['payout_model'] = {'$regex': f'^{re.escape(payout_model)}$', '$options': 'i'}
        
        try:
            existing_offer = offers_collection.find_one(query)
            
            if existing_offer:
                # Verify platform matches (detected from name)
                existing_platform = cls.detect_platform(existing_offer.get('name', ''))
                if platform == 'All' or existing_platform == 'All' or platform == existing_platform:
                    return True, existing_offer
            
            return False, None
            
        except Exception as e:
            logger.error(f"Error checking inventory: {e}")
            return False, None
    
    @classmethod
    def process_offer_for_inventory_gap(cls, offer_data: Dict[str, Any],
                                         source: str = 'sheet_upload',
                                         network: str = None,
                                         upload_batch_id: str = None) -> Dict[str, Any]:
        """
        Process an offer and check if it's an inventory gap.
        If the offer doesn't exist in our inventory, store it as a missing offer.
        Also detects price mismatches when offer exists but with different payout.
        
        Args:
            offer_data: Dictionary containing offer data
            source: Source of the offer (sheet_upload, api_fetch, manual)
            network: Partner network name
            upload_batch_id: Batch ID for bulk uploads
            
        Returns:
            Dictionary with:
            - in_inventory: bool (True if offer exists)
            - match_key: str
            - missing_offer_id: str (if stored as missing)
            - price_mismatch: dict (if price differs from existing offer)
        """
        # Generate match key
        match_key = cls.generate_match_key(offer_data)
        
        # Check if exists in inventory
        exists, existing_offer = cls.check_inventory_exists(match_key)
        
        result = {
            'in_inventory': exists,
            'match_key': match_key,
            'missing_offer_id': None,
            'existing_offer_id': str(existing_offer.get('_id')) if existing_offer else None,
            'price_mismatch': None
        }
        
        # Check for price mismatch if offer exists
        if exists and existing_offer:
            try:
                # Get new payout from uploaded data
                new_payout = float(offer_data.get('payout', 0) or 0)
                existing_payout = float(existing_offer.get('payout', 0) or 0)
                
                # Check if prices differ (with small tolerance for floating point)
                if abs(new_payout - existing_payout) > 0.01:
                    price_diff = new_payout - existing_payout
                    price_change_type = 'increase' if price_diff > 0 else 'decrease'
                    
                    price_mismatch_data = {
                        'offer_id': existing_offer.get('offer_id'),
                        'offer_name': existing_offer.get('name'),
                        'existing_payout': existing_payout,
                        'new_payout': new_payout,
                        'price_difference': round(price_diff, 2),
                        'price_change_type': price_change_type,
                        'percent_change': round((price_diff / existing_payout * 100), 2) if existing_payout > 0 else 0,
                        'source': source,
                        'network': network,
                        'upload_batch_id': upload_batch_id,
                        'detected_at': datetime.utcnow(),
                        'status': 'pending',  # pending, acknowledged, updated
                        'category': existing_offer.get('category', ''),
                        'image_url': existing_offer.get('image_url', ''),
                        'countries': existing_offer.get('countries', [])
                    }
                    
                    # Store price mismatch in database
                    cls._store_price_mismatch(price_mismatch_data)
                    result['price_mismatch'] = price_mismatch_data
                    logger.info(f"Price mismatch detected: {existing_offer.get('name')} - ${existing_payout} -> ${new_payout}")
                    
            except Exception as e:
                logger.error(f"Error checking price mismatch: {e}")
        
        if not exists:
            # Store as missing offer (inventory gap)
            try:
                # Extract components from match key
                parts = match_key.split(' | ')
                name = parts[0] if len(parts) > 0 else offer_data.get('name', 'Unknown')
                country = parts[1] if len(parts) > 1 else 'GLOBAL'
                platform = parts[2] if len(parts) > 2 else 'All'
                payout_model = parts[3] if len(parts) > 3 else 'Unknown'
                
                missing_offer = MissingOffer.create(
                    offer_data=offer_data,
                    match_key=match_key,
                    name=name,
                    country=country,
                    platform=platform,
                    payout_model=payout_model,
                    source=source,
                    network=network,
                    upload_batch_id=upload_batch_id
                )
                
                if missing_offer:
                    result['missing_offer_id'] = str(missing_offer.get('_id'))
                    logger.info(f"Stored inventory gap: {match_key}")
                    
            except Exception as e:
                logger.error(f"Failed to store missing offer: {e}")
        
        return result
    
    @classmethod
    def process_bulk_upload_for_gaps(cls, offers: List[Dict[str, Any]],
                                      source: str = 'sheet_upload',
                                      network: str = None) -> Dict[str, Any]:
        """
        Process a bulk upload and identify inventory gaps.
        
        Args:
            offers: List of offer dictionaries
            source: Source of the upload
            network: Partner network name
            
        Returns:
            Dictionary with:
            - existing_offers: list of offers already in inventory
            - missing_offers: list of inventory gaps
            - stats: summary statistics
        """
        import uuid
        
        upload_batch_id = f"batch_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:8]}"
        
        existing_offers = []
        missing_offers = []
        
        for offer_data in offers:
            result = cls.process_offer_for_inventory_gap(
                offer_data=offer_data,
                source=source,
                network=network,
                upload_batch_id=upload_batch_id
            )
            
            if result['in_inventory']:
                existing_offers.append({
                    'offer_data': offer_data,
                    'match_key': result['match_key'],
                    'existing_offer_id': result['existing_offer_id']
                })
            else:
                missing_offers.append({
                    'offer_data': offer_data,
                    'match_key': result['match_key'],
                    'missing_offer_id': result['missing_offer_id']
                })
        
        return {
            'existing_offers': existing_offers,
            'missing_offers': missing_offers,
            'stats': {
                'total': len(offers),
                'in_inventory': len(existing_offers),
                'not_in_inventory': len(missing_offers),
                'upload_batch_id': upload_batch_id
            }
        }
    
    @classmethod
    def _store_price_mismatch(cls, price_mismatch_data: Dict[str, Any]) -> Optional[Dict]:
        """
        Store a price mismatch record in the database.
        
        Args:
            price_mismatch_data: Dictionary containing price mismatch details
            
        Returns:
            The stored document or None if failed
        """
        try:
            db = db_instance.get_db()
            if db is None:
                logger.error("Database not connected")
                return None
            
            price_mismatches_collection = db['price_mismatches']
            
            # Check if this mismatch already exists (same offer, same new price, pending status)
            existing = price_mismatches_collection.find_one({
                'offer_id': price_mismatch_data['offer_id'],
                'new_payout': price_mismatch_data['new_payout'],
                'status': 'pending'
            })
            
            if existing:
                # Update the existing record with new detection time
                price_mismatches_collection.update_one(
                    {'_id': existing['_id']},
                    {'$set': {'detected_at': datetime.utcnow(), 'detection_count': existing.get('detection_count', 1) + 1}}
                )
                return existing
            
            # Add detection count
            price_mismatch_data['detection_count'] = 1
            price_mismatch_data['created_at'] = datetime.utcnow()
            
            result = price_mismatches_collection.insert_one(price_mismatch_data)
            price_mismatch_data['_id'] = result.inserted_id
            
            return price_mismatch_data
            
        except Exception as e:
            logger.error(f"Error storing price mismatch: {e}")
            return None
    
    @classmethod
    def get_price_mismatches(cls, status: str = None, days: int = 30, limit: int = 100) -> List[Dict]:
        """
        Get price mismatch records from the database.
        
        Args:
            status: Filter by status (pending, acknowledged, updated)
            days: Number of days to look back
            limit: Maximum number of records to return
            
        Returns:
            List of price mismatch records
        """
        try:
            db = db_instance.get_db()
            if db is None:
                return []
            
            price_mismatches_collection = db['price_mismatches']
            
            query = {}
            if status:
                query['status'] = status
            
            if days:
                start_date = datetime.utcnow() - timedelta(days=days)
                query['detected_at'] = {'$gte': start_date}
            
            results = list(price_mismatches_collection.find(query)
                          .sort('detected_at', -1)
                          .limit(limit))
            
            # Convert ObjectId to string
            for r in results:
                r['_id'] = str(r['_id'])
            
            return results
            
        except Exception as e:
            logger.error(f"Error getting price mismatches: {e}")
            return []
    
    @classmethod
    def update_price_mismatch_status(cls, mismatch_id: str, status: str, updated_by: str = None) -> bool:
        """
        Update the status of a price mismatch record.
        
        Args:
            mismatch_id: The _id of the price mismatch record
            status: New status (acknowledged, updated)
            updated_by: Username of who updated it
            
        Returns:
            True if updated successfully
        """
        try:
            from bson import ObjectId
            
            db = db_instance.get_db()
            if db is None:
                return False
            
            price_mismatches_collection = db['price_mismatches']
            
            result = price_mismatches_collection.update_one(
                {'_id': ObjectId(mismatch_id)},
                {'$set': {
                    'status': status,
                    'updated_at': datetime.utcnow(),
                    'updated_by': updated_by
                }}
            )
            
            return result.modified_count > 0
            
        except Exception as e:
            logger.error(f"Error updating price mismatch status: {e}")
            return False


# Singleton instance
missing_offer_service = MissingOfferService()
