"""
Network API Service
Handles API calls to different affiliate networks (HasOffers, CJ, ShareASale, etc.)
"""

import requests
import logging
from typing import Dict, List, Tuple, Optional, Any
from datetime import datetime

logger = logging.getLogger(__name__)


class NetworkAPIService:
    """Base class for network API integration"""
    
    def __init__(self):
        self.timeout = 30  # 30 seconds timeout
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'MoustacheLeads/1.0',
            'Accept': 'application/json'
        })
    
    def test_connection(self, network_id: str, api_key: str, network_type: str = 'hasoffers') -> Tuple[bool, Optional[int], Optional[str]]:
        """
        Test API connection and return offer count
        
        Args:
            network_id: Network identifier (e.g., 'cpamerchant')
            api_key: API key for authentication
            network_type: Type of network ('hasoffers', 'cj', 'shareasale')
            
        Returns:
            Tuple of (success, offer_count, error_message)
        """
        try:
            if network_type == 'hasoffers':
                return self._test_hasoffers_connection(network_id, api_key)
            elif network_type == 'cj':
                return self._test_cj_connection(network_id, api_key)
            elif network_type == 'shareasale':
                return self._test_shareasale_connection(network_id, api_key)
            else:
                return False, None, f"Unsupported network type: {network_type}"
        except Exception as e:
            logger.error(f"Connection test failed: {str(e)}", exc_info=True)
            return False, None, str(e)
    
    def fetch_offers(self, network_id: str, api_key: str, network_type: str = 'hasoffers', 
                    filters: Optional[Dict] = None, limit: Optional[int] = None) -> Tuple[List[Dict], Optional[str]]:
        """
        Fetch offers from network API
        
        Args:
            network_id: Network identifier
            api_key: API key for authentication
            network_type: Type of network
            filters: Optional filters (status, countries, etc.)
            limit: Optional limit on number of offers
            
        Returns:
            Tuple of (offers_list, error_message)
        """
        try:
            if network_type == 'hasoffers':
                return self._fetch_hasoffers_offers(network_id, api_key, filters, limit)
            elif network_type == 'cj':
                return self._fetch_cj_offers(network_id, api_key, filters, limit)
            elif network_type == 'shareasale':
                return self._fetch_shareasale_offers(network_id, api_key, filters, limit)
            else:
                return [], f"Unsupported network type: {network_type}"
        except Exception as e:
            logger.error(f"Fetch offers failed: {str(e)}", exc_info=True)
            return [], str(e)
    
    # ==================== HasOffers/Tune Implementation ====================
    
    def _test_hasoffers_connection(self, network_id: str, api_key: str) -> Tuple[bool, Optional[int], Optional[str]]:
        """Test HasOffers API connection"""
        try:
            url = f"https://{network_id}.api.hasoffers.com/Apiv3/json"
            params = {
                'NetworkId': network_id,
                'Target': 'Affiliate_Offer',
                'Method': 'findMyOffers',
                'api_key': api_key,
                'limit': 100,
                'contain[]': ['Country', 'Thumbnail']
            }
            
            logger.info(f"Testing HasOffers connection for {network_id}")
            
            response = self.session.get(url, params=params, timeout=self.timeout)
            response.raise_for_status()
            
            data = response.json()
            
            if data.get('response', {}).get('status') == 1:
                response_data = data.get('response', {}).get('data', {})
                
                # Check if there's a nested 'data' key (pagination structure)
                if isinstance(response_data, dict) and 'data' in response_data:
                    offer_data = response_data.get('data', {})
                else:
                    offer_data = response_data
                
                # Count actual offers
                if isinstance(offer_data, dict):
                    offer_count = len([v for v in offer_data.values() if isinstance(v, dict) and 'Offer' in v])
                else:
                    offer_count = 0
                
                logger.info(f"Connection successful: {offer_count} offers found for {network_id}")
                return True, offer_count, None
            else:
                error_msg = data.get('response', {}).get('errorMessage', 'Unknown error')
                return False, None, f"API Error: {error_msg}"
                
        except requests.exceptions.Timeout:
            return False, None, "Connection timeout. Please try again."
        except requests.exceptions.ConnectionError:
            return False, None, "Unable to connect to API. Check network ID."
        except requests.exceptions.HTTPError as e:
            return False, None, f"HTTP Error: {e.response.status_code}"
        except Exception as e:
            return False, None, f"Error: {str(e)}"
    
    def _fetch_hasoffers_offers(self, network_id: str, api_key: str, 
                               filters: Optional[Dict] = None, 
                               limit: Optional[int] = None) -> Tuple[List[Dict], Optional[str]]:
        """Fetch offers from HasOffers API — resilient per-offer parsing"""
        try:
            url = f"https://{network_id}.api.hasoffers.com/Apiv3/json"

            params = {
                'NetworkId': network_id,
                'Target': 'Affiliate_Offer',
                'Method': 'findMyOffers',
                'api_key': api_key,
                'limit': limit or 1000,
                'contain[]': ['Country', 'Thumbnail']
            }

            if filters:
                if filters.get('status'):
                    params['filters[status]'] = filters['status']
                if filters.get('countries'):
                    params['filters[countries]'] = filters['countries']

            logger.info(f"Fetching HasOffers offers from {network_id} (limit: {limit or 1000})")

            response = self.session.get(url, params=params, timeout=self.timeout)
            response.raise_for_status()

            data = response.json()

            if data.get('response', {}).get('status') != 1:
                error_msg = data.get('response', {}).get('errorMessage', 'Unknown error')
                return [], f"API Error: {error_msg}"

            # Parse offers from response — HasOffers has nested data structure
            response_data = data.get('response', {}).get('data', {})

            # Check if there's a nested 'data' key (pagination structure)
            if isinstance(response_data, dict) and 'data' in response_data:
                offers_data = response_data.get('data', {})
            else:
                offers_data = response_data

            offers = []
            skipped = 0

            if isinstance(offers_data, dict):
                for offer_id, offer_info in offers_data.items():
                    try:
                        if isinstance(offer_info, dict) and 'Offer' in offer_info:
                            offers.append(offer_info)
                        else:
                            skipped += 1
                            logger.debug(f"Skipped offer {offer_id}: missing 'Offer' key or not a dict")
                    except Exception as e:
                        skipped += 1
                        logger.warning(f"Error parsing offer {offer_id}: {e}")

            logger.info(f"Fetched {len(offers)} offers from {network_id} ({skipped} skipped)")

            return offers, None

        except requests.exceptions.Timeout:
            return [], "Connection timeout. Please try again."
        except requests.exceptions.ConnectionError:
            return [], "Unable to connect to API. Check network ID."
        except requests.exceptions.HTTPError as e:
            return [], f"HTTP Error: {e.response.status_code}"
        except Exception as e:
            logger.error(f"Error fetching HasOffers offers: {str(e)}", exc_info=True)
            return [], f"Error: {str(e)}"

    
    # ==================== Commission Junction Implementation ====================
    
    def _test_cj_connection(self, network_id: str, api_key: str) -> Tuple[bool, Optional[int], Optional[str]]:
        """Test CJ API connection"""
        # TODO: Implement CJ API connection test
        return False, None, "CJ integration coming soon"
    
    def _fetch_cj_offers(self, network_id: str, api_key: str, 
                        filters: Optional[Dict] = None, 
                        limit: Optional[int] = None) -> Tuple[List[Dict], Optional[str]]:
        """Fetch offers from CJ API"""
        # TODO: Implement CJ API integration
        return [], "CJ integration coming soon"
    
    # ==================== ShareASale Implementation ====================
    
    def _test_shareasale_connection(self, network_id: str, api_key: str) -> Tuple[bool, Optional[int], Optional[str]]:
        """Test ShareASale API connection"""
        # TODO: Implement ShareASale API connection test
        return False, None, "ShareASale integration coming soon"
    
    def _fetch_shareasale_offers(self, network_id: str, api_key: str, 
                                filters: Optional[Dict] = None, 
                                limit: Optional[int] = None) -> Tuple[List[Dict], Optional[str]]:
        """Fetch offers from ShareASale API"""
        # TODO: Implement ShareASale API integration
        return [], "ShareASale integration coming soon"


# Singleton instance
network_api_service = NetworkAPIService()
