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
            network_id: Network identifier (e.g., 'cpamerchant') or API URL for Everflow
            api_key: API key for authentication
            network_type: Type of network ('hasoffers', 'everflow', 'mobplus', 'cj', 'shareasale')
            
        Returns:
            Tuple of (success, offer_count, error_message)
        """
        try:
            if network_type == 'hasoffers':
                return self._test_hasoffers_connection(network_id, api_key)
            elif network_type == 'everflow':
                return self._test_everflow_connection(network_id, api_key)
            elif network_type == 'mobplus':
                return self._test_mobplus_connection(network_id, api_key)
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
            elif network_type == 'everflow':
                return self._fetch_everflow_offers(network_id, api_key, filters, limit)
            elif network_type == 'mobplus':
                return self._fetch_mobplus_offers(network_id, api_key, filters, limit)
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

    
    # ==================== Everflow Implementation ====================
    
    def _test_everflow_connection(self, api_url: str, api_key: str) -> Tuple[bool, Optional[int], Optional[str]]:
        """Test Everflow API connection using header-based auth"""
        try:
            # Normalize the API URL
            base_url = api_url.rstrip('/')
            if not base_url.startswith('http'):
                base_url = f"https://{base_url}"
            
            # If user provided just the domain, append the standard endpoint
            if '/v1/' not in base_url:
                base_url = f"{base_url}/v1/affiliates/offersrunnable"
            
            logger.info(f"Testing Everflow connection: {base_url}")
            
            headers = {
                'Content-Type': 'application/json',
                'x-eflow-api-key': api_key
            }
            
            params = {
                'page': 1,
                'page_size': 1  # Just test with 1 to get total count
            }
            
            response = self.session.get(base_url, headers=headers, params=params, timeout=self.timeout)
            
            if response.status_code == 401:
                return False, None, "Invalid API key. Please check your Everflow API key."
            elif response.status_code == 403:
                return False, None, "Access denied. Your API key may not have affiliate permissions."
            
            response.raise_for_status()
            
            data = response.json()
            
            # Everflow returns offers array and pagination info
            # Response format: { "offers": [...], "paging": { "total_count": N, ... } }
            # OR it could be a direct array
            if isinstance(data, dict):
                total_count = 0
                if 'paging' in data:
                    total_count = data['paging'].get('total_count', 0)
                elif 'total_count' in data:
                    total_count = data['total_count']
                elif 'offers' in data:
                    # If no paging info, fetch with larger page to count
                    total_count = len(data.get('offers', []))
                    # Try a larger fetch to get real count
                    params_full = {'page': 1, 'page_size': 100}
                    try:
                        resp_full = self.session.get(base_url, headers=headers, params=params_full, timeout=self.timeout)
                        if resp_full.status_code == 200:
                            full_data = resp_full.json()
                            if isinstance(full_data, dict) and 'paging' in full_data:
                                total_count = full_data['paging'].get('total_count', total_count)
                            elif isinstance(full_data, dict) and 'offers' in full_data:
                                total_count = len(full_data['offers'])
                            elif isinstance(full_data, list):
                                total_count = len(full_data)
                    except:
                        pass
                else:
                    # Maybe the response itself is the offers list at top level
                    total_count = len(data)
            elif isinstance(data, list):
                total_count = len(data)
            else:
                return False, None, "Unexpected API response format"
            
            logger.info(f"Everflow connection successful: {total_count} offers found")
            return True, total_count, None
            
        except requests.exceptions.Timeout:
            return False, None, "Connection timeout. Please check the API URL and try again."
        except requests.exceptions.ConnectionError:
            return False, None, "Unable to connect. Please verify the API URL is correct."
        except requests.exceptions.HTTPError as e:
            return False, None, f"HTTP Error: {e.response.status_code}"
        except Exception as e:
            return False, None, f"Error: {str(e)}"
    
    def _fetch_everflow_offers(self, api_url: str, api_key: str,
                               filters: Optional[Dict] = None,
                               limit: Optional[int] = None) -> Tuple[List[Dict], Optional[str]]:
        """Fetch offers from Everflow API with pagination"""
        try:
            # Normalize the API URL
            base_url = api_url.rstrip('/')
            if not base_url.startswith('http'):
                base_url = f"https://{base_url}"
            
            if '/v1/' not in base_url:
                base_url = f"{base_url}/v1/affiliates/offersrunnable"
            
            headers = {
                'Content-Type': 'application/json',
                'x-eflow-api-key': api_key
            }
            
            page_size = min(limit or 100, 100)  # Everflow max page size is typically 100
            max_offers = limit or 5000  # Safety cap
            
            all_offers = []
            page = 1
            
            logger.info(f"Fetching Everflow offers from {base_url} (limit: {max_offers})")
            
            while len(all_offers) < max_offers:
                params = {
                    'page': page,
                    'page_size': page_size
                }
                
                response = self.session.get(base_url, headers=headers, params=params, timeout=self.timeout)
                
                if response.status_code == 401:
                    return [], "Invalid API key"
                
                response.raise_for_status()
                data = response.json()
                
                # Parse response - handle different Everflow response formats
                offers_batch = []
                has_more = False
                
                if isinstance(data, dict):
                    if 'offers' in data:
                        offers_batch = data['offers']
                    elif 'data' in data:
                        offers_batch = data['data']
                    else:
                        # The dict itself might contain offer-like data
                        offers_batch = [data] if 'offer_id' in data or 'network_offer_id' in data else []
                    
                    # Check pagination
                    paging = data.get('paging', {})
                    total_count = paging.get('total_count', 0)
                    if total_count > 0:
                        has_more = (page * page_size) < total_count
                    else:
                        # No paging info — check if we got a full page (means more might exist)
                        has_more = len(offers_batch) == page_size
                elif isinstance(data, list):
                    offers_batch = data
                    has_more = len(data) == page_size  # If full page, might be more
                
                if not offers_batch:
                    break
                
                all_offers.extend(offers_batch)
                
                if not has_more or len(all_offers) >= max_offers:
                    break
                
                page += 1
            
            # Trim to limit
            if limit and len(all_offers) > limit:
                all_offers = all_offers[:limit]
            
            logger.info(f"Fetched {len(all_offers)} offers from Everflow ({page} pages)")
            return all_offers, None
            
        except requests.exceptions.Timeout:
            return [], "Connection timeout. Please try again."
        except requests.exceptions.ConnectionError:
            return [], "Unable to connect to Everflow API."
        except requests.exceptions.HTTPError as e:
            return [], f"HTTP Error: {e.response.status_code}"
        except Exception as e:
            logger.error(f"Error fetching Everflow offers: {str(e)}", exc_info=True)
            return [], f"Error: {str(e)}"
    
    # ==================== MobPlus Implementation ====================
    
    def _test_mobplus_connection(self, api_url: str, api_key: str) -> Tuple[bool, Optional[int], Optional[str]]:
        """Test MobPlus API connection using POST with form-encoded body"""
        try:
            import json
            
            # Normalize the API URL
            base_url = api_url.rstrip('/')
            if not base_url.startswith('http'):
                base_url = f"http://{base_url}"
            
            # If user provided just the domain, append the standard endpoint
            if '/api/affiliate/offers' not in base_url:
                base_url = f"{base_url}/api/affiliate/offers"
            
            logger.info(f"Testing MobPlus connection: {base_url}")
            
            headers = {
                'Authorization': api_key,
                'Content-Type': 'application/x-www-form-urlencoded'
            }
            
            # First do a small request to verify connection works
            form_data = {
                'q': json.dumps({"page": 1, "pageSize": 1})
            }
            
            response = self.session.post(base_url, headers=headers, data=form_data, timeout=self.timeout)
            
            if response.status_code == 401:
                return False, None, "Invalid API key. Please check your MobPlus Authorization token."
            elif response.status_code == 403:
                return False, None, "Access denied. Your API key may not have affiliate permissions."
            
            response.raise_for_status()
            
            # Connection works — now count total offers by paginating with pageSize=5000
            total_count = 0
            page = 1
            while page <= 20:  # Max 20 pages for counting (100k max)
                form_data_count = {
                    'q': json.dumps({"page": page, "pageSize": 5000})
                }
                resp = self.session.post(base_url, headers=headers, data=form_data_count, timeout=60)
                if resp.status_code != 200:
                    break
                data = resp.json()
                batch_size = 0
                if isinstance(data, list):
                    batch_size = len(data)
                elif isinstance(data, dict) and 'data' in data:
                    batch_size = len(data['data']) if isinstance(data['data'], list) else 0
                elif isinstance(data, dict) and 'offers' in data:
                    batch_size = len(data['offers']) if isinstance(data['offers'], list) else 0
                
                total_count += batch_size
                
                if batch_size < 5000:
                    break  # Last page
                page += 1
            
            logger.info(f"MobPlus connection successful: {total_count} offers found ({page} pages)")
            return True, total_count, None
            
        except requests.exceptions.Timeout:
            return False, None, "Connection timeout. Please check the API URL and try again."
        except requests.exceptions.ConnectionError:
            return False, None, "Unable to connect. Please verify the API URL is correct."
        except requests.exceptions.HTTPError as e:
            return False, None, f"HTTP Error: {e.response.status_code}"
        except Exception as e:
            return False, None, f"Error: {str(e)}"
    
    def _fetch_mobplus_offers(self, api_url: str, api_key: str,
                              filters: Optional[Dict] = None,
                              limit: Optional[int] = None) -> Tuple[List[Dict], Optional[str]]:
        """Fetch offers from MobPlus API using POST with form-encoded body.
        Paginates through all pages with pageSize=5000 to get all offers."""
        try:
            import json
            
            # Normalize the API URL
            base_url = api_url.rstrip('/')
            if not base_url.startswith('http'):
                base_url = f"http://{base_url}"
            
            if '/api/affiliate/offers' not in base_url:
                base_url = f"{base_url}/api/affiliate/offers"
            
            headers = {
                'Authorization': api_key,
                'Content-Type': 'application/x-www-form-urlencoded'
            }
            
            # Use smaller page size for reliable pagination
            page_size = 5000
            max_offers = limit or 50000  # Safety cap at 50k
            max_pages = 20  # Safety: max 20 pages (100k offers max)
            
            logger.info(f"Fetching MobPlus offers from {base_url} (pageSize: {page_size}, max: {max_offers})")
            
            all_offers = []
            page = 1
            
            while page <= max_pages and len(all_offers) < max_offers:
                form_data = {
                    'q': json.dumps({"page": page, "pageSize": page_size})
                }
                
                response = self.session.post(base_url, headers=headers, data=form_data, timeout=90)
                
                if response.status_code == 401:
                    return [], "Invalid API key"
                
                response.raise_for_status()
                data = response.json()
                
                # Parse response — MobPlus returns a direct array of offers
                offers_batch = []
                if isinstance(data, list):
                    offers_batch = data
                elif isinstance(data, dict):
                    if 'data' in data:
                        offers_batch = data['data'] if isinstance(data['data'], list) else []
                    elif 'offers' in data:
                        offers_batch = data['offers'] if isinstance(data['offers'], list) else []
                    else:
                        offers_batch = []
                
                logger.info(f"MobPlus page {page}: got {len(offers_batch)} offers")
                
                if not offers_batch:
                    break
                
                # Filter by status if requested
                if filters and filters.get('status'):
                    status_filter = filters['status'].lower()
                    offers_batch = [o for o in offers_batch if (o.get('status', '') or '').lower() == status_filter]
                
                all_offers.extend(offers_batch)
                
                # If we got fewer than page_size, we've reached the end
                if len(offers_batch) < page_size:
                    break
                
                # If we already have enough
                if limit and len(all_offers) >= limit:
                    break
                
                page += 1
            
            # Trim to limit
            if limit and len(all_offers) > limit:
                all_offers = all_offers[:limit]
            
            logger.info(f"Fetched {len(all_offers)} total offers from MobPlus ({page} page(s))")
            return all_offers, None
            
        except requests.exceptions.Timeout:
            return [], "Connection timeout. MobPlus API may be slow — try again."
        except requests.exceptions.ConnectionError:
            return [], "Unable to connect to MobPlus API."
        except requests.exceptions.HTTPError as e:
            return [], f"HTTP Error: {e.response.status_code}"
        except Exception as e:
            logger.error(f"Error fetching MobPlus offers: {str(e)}", exc_info=True)
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
