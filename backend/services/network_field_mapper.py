"""
Network Field Mapper Service
Maps fields from different affiliate networks to database format
"""

import logging
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)


class NetworkFieldMapper:
    """Maps network API fields to database fields"""
    
    # HasOffers field mapping
    HASOFFERS_MAPPING = {
        'id': 'campaign_id',
        'name': 'name',
        'description': 'description',
        'preview_url': 'preview_url',
        'default_payout': 'payout',
        'currency': 'currency',
        'status': 'status',
        'expiration_date': 'expiration_date',
    }
    
    # Status mapping
    STATUS_MAPPING = {
        'active': 'active',
        'paused': 'inactive',
        'pending': 'pending',
        'deleted': 'inactive',
        'expired': 'inactive',
    }
    
    def map_to_db_format(self, offer_data: Dict, network_type: str = 'hasoffers', network_id: str = None) -> Dict[str, Any]:
        """
        Map network offer data to database format
        
        Args:
            offer_data: Raw offer data from network API
            network_type: Type of network ('hasoffers', 'cj', 'shareasale')
            network_id: Network identifier (e.g., 'cpamerchant')
            
        Returns:
            Dictionary with database field names
        """
        try:
            if network_type == 'hasoffers':
                return self._map_hasoffers_offer(offer_data, network_id)
            elif network_type == 'cj':
                return self._map_cj_offer(offer_data, network_id)
            elif network_type == 'shareasale':
                return self._map_shareasale_offer(offer_data, network_id)
            else:
                logger.error(f"Unsupported network type: {network_type}")
                return {}
        except Exception as e:
            logger.error(f"Error mapping offer data: {str(e)}", exc_info=True)
            return {}
    
    def _map_hasoffers_offer(self, offer_data: Dict, network_id: str = None) -> Dict[str, Any]:
        """Map HasOffers offer to database format"""
        try:
            # Extract Offer object
            offer = offer_data.get('Offer', {})
            
            # Use network_id if provided, otherwise default to 'HasOffers'
            network_name = network_id if network_id else 'HasOffers'
            
            # Basic mapping
            mapped = {
                'campaign_id': str(offer.get('id', '')),
                'name': offer.get('name', ''),
                'description': offer.get('description', ''),
                'preview_url': offer.get('preview_url', 'https://www.google.com'),
                'payout': float(offer.get('default_payout', 0)),
                'currency': offer.get('currency') or 'USD',  # Handle null currency
                'status': self._normalize_status(offer.get('status', 'active')),
                'network': network_name,  # Use actual network ID
                'offer_type': 'CPA',
            }
            
            # Handle tracking link - Use preview_url as target_url
            tracking_link = offer.get('preview_url') or 'https://example.com/offer'
            mapped['target_url'] = tracking_link
            
            logger.info(f"🔍 Mapping offer: {mapped['name']}")
            logger.info(f"   Campaign ID: {mapped['campaign_id']}")
            logger.info(f"   Target URL: {mapped['target_url']}")
            logger.info(f"   Payout: {mapped['payout']}")
            
            # Handle expiration date
            expiration = offer.get('expiration_date')
            if expiration and expiration != '0000-00-00':
                mapped['expiration_date'] = expiration
            else:
                # Default to 90 days from now
                mapped['expiration_date'] = (datetime.utcnow() + timedelta(days=90)).strftime('%Y-%m-%d')
            
            # Handle image URL
            thumbnail = offer_data.get('Thumbnail', {})
            if thumbnail and thumbnail.get('url'):
                mapped['image_url'] = thumbnail['url']
            else:
                mapped['image_url'] = ''
            
            # Handle countries
            countries = []
            country_data = offer_data.get('Country', {})
            if isinstance(country_data, dict):
                for country_info in country_data.values():
                    if isinstance(country_info, dict) and country_info.get('code'):
                        countries.append(country_info['code'].upper())
            elif isinstance(country_data, list):
                for country_info in country_data:
                    if isinstance(country_info, dict) and country_info.get('code'):
                        countries.append(country_info['code'].upper())
            
            # If no countries specified, default to US
            mapped['countries'] = countries if countries else ['US']
            
            logger.info(f"   Countries: {mapped['countries']}")
            
            # Set default values
            mapped['vertical'] = 'Lifestyle'  # Default, can be updated based on category
            mapped['device_targeting'] = 'all'
            mapped['affiliates'] = 'all'
            mapped['revenue_share_percent'] = 0
            mapped['incentive_type'] = 'Incent'
            
            # Handle terms and conditions
            if offer.get('terms_and_conditions'):
                mapped['affiliate_terms'] = offer['terms_and_conditions']
            else:
                mapped['affiliate_terms'] = 'Follow network and advertiser rules.'
            
            logger.info(f"✅ Successfully mapped offer: {mapped['name']}")
            
            return mapped
            
        except Exception as e:
            logger.error(f"Error mapping HasOffers offer: {str(e)}", exc_info=True)
            return {}
    
    def _map_cj_offer(self, offer_data: Dict, network_id: str = None) -> Dict[str, Any]:
        """Map CJ offer to database format"""
        # TODO: Implement CJ mapping
        return {}
    
    def _map_shareasale_offer(self, offer_data: Dict, network_id: str = None) -> Dict[str, Any]:
        """Map ShareASale offer to database format"""
        # TODO: Implement ShareASale mapping
        return {}
    
    def _normalize_status(self, status: str) -> str:
        """Normalize status from different networks"""
        status_lower = str(status).lower()
        return self.STATUS_MAPPING.get(status_lower, 'active')
    
    def validate_mapped_offer(self, mapped_offer: Dict) -> tuple[bool, List[str]]:
        """
        Validate mapped offer has all required fields
        
        Returns:
            Tuple of (is_valid, list_of_errors)
        """
        errors = []
        required_fields = ['campaign_id', 'name', 'target_url', 'countries', 'payout', 'network']
        
        for field in required_fields:
            if field not in mapped_offer or not mapped_offer[field]:
                errors.append(f"Missing required field: {field}")
        
        # Validate payout is numeric
        if 'payout' in mapped_offer:
            try:
                float(mapped_offer['payout'])
            except (ValueError, TypeError):
                errors.append(f"Invalid payout value: {mapped_offer['payout']}")
        
        # Validate countries is a list
        if 'countries' in mapped_offer and not isinstance(mapped_offer['countries'], list):
            errors.append("Countries must be a list")
        
        return len(errors) == 0, errors


# Singleton instance
network_field_mapper = NetworkFieldMapper()
