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
                'limit': 100  # Get more for accurate count
            }
            
            print("="*80)
            print(f"🔍 TESTING HASOFFERS CONNECTION")
            print(f"   URL: {url}")
            print(f"   Network ID: {network_id}")
            print("="*80)
            
            response = self.session.get(url, params=params, timeout=self.timeout)
            response.raise_for_status()
            
            print(f"✅ HTTP Status: {response.status_code}")
            
            data = response.json()
            
            print(f"📦 Response structure:")
            print(f"   Top-level keys: {list(data.keys())}")
            print(f"   Response status: {data.get('response', {}).get('status')}")
            
            # Check if response is successful
            if data.get('response', {}).get('status') == 1:
                # Get actual offer data - HasOffers has nested data structure
                response_data = data.get('response', {}).get('data', {})
                
                print(f"📊 Response data structure:")
                print(f"   Type: {type(response_data)}")
                print(f"   Keys: {list(response_data.keys()) if isinstance(response_data, dict) else 'N/A'}")
                
                # Check if there's a nested 'data' key (pagination structure)
                if isinstance(response_data, dict) and 'data' in response_data:
                    print(f"   ✅ Found nested 'data' key (paginated response)")
                    offer_data = response_data.get('data', {})
                else:
                    print(f"   Using direct data structure")
                    offer_data = response_data
                
                print(f"📊 Offer data:")
                print(f"   Type: {type(offer_data)}")
                print(f"   Is dict: {isinstance(offer_data, dict)}")
                
                # Count actual offers
                if isinstance(offer_data, dict):
                    print(f"   Number of keys: {len(offer_data)}")
                    offer_count = len([v for v in offer_data.values() if isinstance(v, dict) and 'Offer' in v])
                    print(f"   Offers with 'Offer' key: {offer_count}")
                else:
                    offer_count = 0
                    print(f"   ⚠️ Not a dict, count = 0")
                
                print(f"✅ Test connection successful: {offer_count} offers found")
                print("="*80)
                
                return True, offer_count, None
            else:
                error_msg = data.get('response', {}).get('errorMessage', 'Unknown error')
                print(f"❌ API Error: {error_msg}")
                print("="*80)
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
        """Fetch offers from HasOffers API"""
        try:
            url = f"https://{network_id}.api.hasoffers.com/Apiv3/json"
            
            params = {
                'NetworkId': network_id,
                'Target': 'Affiliate_Offer',
                'Method': 'findMyOffers',
                'api_key': api_key,
                'limit': limit or 1000  # Default to 1000 if not specified
            }
            
            # Add filters if provided
            if filters:
                if filters.get('status'):
                    params['filters[status]'] = filters['status']
                if filters.get('countries'):
                    params['filters[countries]'] = filters['countries']
            
            print("="*80)
            print(f"🌐 FETCHING HASOFFERS OFFERS")
            print(f"   URL: {url}")
            print(f"   Network ID: {network_id}")
            print(f"   Limit: {limit or 1000}")
            print("="*80)
            
            response = self.session.get(url, params=params, timeout=self.timeout)
            response.raise_for_status()
            
            print(f"✅ HTTP Status: {response.status_code}")
            
            data = response.json()
            
            print(f"📦 Response structure:")
            print(f"   Top-level keys: {list(data.keys())}")
            print(f"   Response status: {data.get('response', {}).get('status')}")
            
            if data.get('response', {}).get('status') != 1:
                error_msg = data.get('response', {}).get('errorMessage', 'Unknown error')
                print(f"❌ API Error: {error_msg}")
                return [], f"API Error: {error_msg}"
            
            # Parse offers from response - HasOffers has nested data structure
            response_data = data.get('response', {}).get('data', {})
            
            print(f"📊 Response data structure:")
            print(f"   Type: {type(response_data)}")
            print(f"   Keys: {list(response_data.keys()) if isinstance(response_data, dict) else 'N/A'}")
            
            # Check if there's a nested 'data' key (pagination structure)
            if isinstance(response_data, dict) and 'data' in response_data:
                print(f"   ✅ Found nested 'data' key (paginated response)")
                offers_data = response_data.get('data', {})
            else:
                print(f"   Using direct data structure")
                offers_data = response_data
            
            offers = []
            
            print(f"📊 Offers data:")
            print(f"   Type: {type(offers_data)}")
            print(f"   Is dict: {isinstance(offers_data, dict)}")
            
            if isinstance(offers_data, dict):
                print(f"   Number of offer keys: {len(offers_data)}")
                print(f"   First 3 keys: {list(offers_data.keys())[:3]}")
                
                for offer_id, offer_info in offers_data.items():
                    print(f"\n   Processing offer ID: {offer_id}")
                    print(f"      Type: {type(offer_info)}")
                    print(f"      Is dict: {isinstance(offer_info, dict)}")
                    
                    if isinstance(offer_info, dict):
                        print(f"      Keys: {list(offer_info.keys())[:5]}")
                        print(f"      Has 'Offer': {'Offer' in offer_info}")
                        
                        if 'Offer' in offer_info:
                            offer_name = offer_info.get('Offer', {}).get('name', 'Unknown')
                            print(f"      ✅ Adding offer: {offer_name}")
                            offers.append(offer_info)
                        else:
                            print(f"      ⚠️ No 'Offer' key found")
                    else:
                        print(f"      ⚠️ Not a dict, skipping")
            else:
                print(f"   ⚠️ offers_data is not a dict!")
            
            print(f"\n✅ Total offers collected: {len(offers)}")
            print("="*80)
            
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
