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
    
    def test_connection(self, network_id: str, api_key: str, network_type: str = 'hasoffers', fetch_mode: str = 'my_offers') -> Tuple[bool, Optional[int], Optional[str]]:
        """
        Test API connection and return offer count
        
        Args:
            network_id: Network identifier (e.g., 'cpamerchant') or API URL for Everflow
            api_key: API key for authentication
            network_type: Type of network ('hasoffers', 'everflow', 'mobplus', 'cj', 'shareasale')
            fetch_mode: 'my_offers' (approved for your account) or 'all_offers' (all network offers)
            
        Returns:
            Tuple of (success, offer_count, error_message)
        """
        try:
            if network_type == 'hasoffers':
                return self._test_hasoffers_connection(network_id, api_key, fetch_mode)
            elif network_type == 'everflow':
                return self._test_everflow_connection(network_id, api_key, fetch_mode)
            elif network_type == 'mobplus':
                return self._test_mobplus_connection(network_id, api_key)
            elif network_type == 'adscendmedia':
                return self._test_adscendmedia_connection(network_id, api_key)
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
                    filters: Optional[Dict] = None, limit: Optional[int] = None,
                    fetch_mode: str = 'my_offers') -> Tuple[List[Dict], Optional[str]]:
        """
        Fetch offers from network API
        
        Args:
            network_id: Network identifier
            api_key: API key for authentication
            network_type: Type of network
            filters: Optional filters (status, countries, etc.)
            limit: Optional limit on number of offers
            fetch_mode: 'my_offers' (approved for your account) or 'all_offers' (all network offers)
            
        Returns:
            Tuple of (offers_list, error_message)
        """
        try:
            if network_type == 'hasoffers':
                return self._fetch_hasoffers_offers(network_id, api_key, filters, limit, fetch_mode)
            elif network_type == 'everflow':
                return self._fetch_everflow_offers(network_id, api_key, filters, limit, fetch_mode)
            elif network_type == 'mobplus':
                return self._fetch_mobplus_offers(network_id, api_key, filters, limit)
            elif network_type == 'adscendmedia':
                return self._fetch_adscendmedia_offers(network_id, api_key, filters, limit)
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
    
    def _test_hasoffers_connection(self, network_id: str, api_key: str, fetch_mode: str = 'my_offers') -> Tuple[bool, Optional[int], Optional[str]]:
        """Test HasOffers API connection"""
        try:
            url = f"https://{network_id}.api.hasoffers.com/Apiv3/json"
            
            # Choose method based on fetch_mode
            if fetch_mode == 'all_offers':
                target = 'Offer'
                method = 'findAll'
            else:
                target = 'Affiliate_Offer'
                method = 'findMyOffers'
            
            params = {
                'NetworkId': network_id,
                'Target': target,
                'Method': method,
                'api_key': api_key,
                'limit': 100,
                'contain[]': ['Country', 'Thumbnail']
            }
            
            logger.info(f"Testing HasOffers connection for {network_id} (mode: {fetch_mode})")
            
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
                               limit: Optional[int] = None,
                               fetch_mode: str = 'my_offers') -> Tuple[List[Dict], Optional[str]]:
        """Fetch offers from HasOffers API — resilient per-offer parsing"""
        try:
            url = f"https://{network_id}.api.hasoffers.com/Apiv3/json"

            # Choose method based on fetch_mode
            if fetch_mode == 'all_offers':
                target = 'Offer'
                method = 'findAll'
            else:
                target = 'Affiliate_Offer'
                method = 'findMyOffers'

            params = {
                'NetworkId': network_id,
                'Target': target,
                'Method': method,
                'api_key': api_key,
                'limit': limit or 1000,
                'contain[]': ['Country', 'Thumbnail']
            }

            if filters:
                if filters.get('status'):
                    params['filters[status]'] = filters['status']
                if filters.get('countries'):
                    params['filters[countries]'] = filters['countries']

            logger.info(f"Fetching HasOffers offers from {network_id} (limit: {limit or 1000}, mode: {fetch_mode})")

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
    
    def _test_everflow_connection(self, api_url: str, api_key: str, fetch_mode: str = 'my_offers') -> Tuple[bool, Optional[int], Optional[str]]:
        """Test Everflow API connection using header-based auth
        Uses offersrunnable (GET) endpoint which returns full relationship data including payouts and geo targeting.
        """
        try:
            # Normalize the API URL
            base_url = api_url.rstrip('/')
            if not base_url.startswith('http'):
                base_url = f"https://{base_url}"
            
            # Use offersrunnable endpoint (GET) which returns full offer data with relationships
            if '/v1/' not in base_url:
                base_url = f"{base_url}/v1/affiliates/offersrunnable"
            
            logger.info(f"Testing Everflow connection: {base_url}")
            
            headers = {
                'Content-Type': 'application/json',
                'x-eflow-api-key': api_key
            }
            
            # offersrunnable uses GET with query params
            params = {
                'page': 1,
                'page_size': 1  # Just test with 1 to get total count
            }
            
            response = self.session.get(base_url, headers=headers, params=params, timeout=self.timeout)
            
            if response.status_code == 401:
                return False, None, "Invalid API key. Please check your Everflow API key."
            elif response.status_code == 403:
                return False, None, "Access denied. Your API key may not have affiliate permissions."
            elif response.status_code == 405:
                # Try POST as fallback (offerstable endpoint)
                fallback_url = base_url.replace('offersrunnable', 'offerstable')
                payload = {
                    'filters': {'affiliate_status': '__all'} if fetch_mode == 'all_offers' else {},
                    'search_terms': []
                }
                response = self.session.post(fallback_url, headers=headers, params=params, json=payload, timeout=self.timeout)
                if response.status_code != 200:
                    return False, None, f"API returned status {response.status_code}. Check your API URL."
            
            response.raise_for_status()
            
            data = response.json()
            
            # offersrunnable returns a direct array of offers
            # OR it could be { "offers": [...], "paging": { "total_count": N } }
            if isinstance(data, dict):
                total_count = 0
                if 'paging' in data:
                    total_count = data['paging'].get('total_count', 0)
                elif 'total_count' in data:
                    total_count = data['total_count']
                elif 'offers' in data:
                    total_count = len(data.get('offers', []))
                else:
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
                               limit: Optional[int] = None,
                               fetch_mode: str = 'my_offers') -> Tuple[List[Dict], Optional[str]]:
        """Fetch offers from Everflow API with pagination.
        Uses offersrunnable (GET) endpoint which returns full offer data with relationship objects
        (payouts, ruleset with countries, category, etc.)
        """
        try:
            # Normalize the API URL
            base_url = api_url.rstrip('/')
            if not base_url.startswith('http'):
                base_url = f"https://{base_url}"
            
            # Use offersrunnable (GET) which returns full relationship data
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
            use_get = True  # offersrunnable uses GET
            
            logger.info(f"Fetching Everflow offers from {base_url} (limit: {max_offers})")
            
            while len(all_offers) < max_offers:
                params = {
                    'page': page,
                    'page_size': page_size
                }
                
                if use_get:
                    response = self.session.get(base_url, headers=headers, params=params, timeout=self.timeout)
                    
                    if response.status_code == 405:
                        # offersrunnable not available, fallback to offerstable (POST)
                        use_get = False
                        fallback_url = base_url.replace('offersrunnable', 'offerstable')
                        logger.info(f"Falling back to offerstable endpoint: {fallback_url}")
                        base_url = fallback_url
                        payload = {
                            'filters': {'affiliate_status': '__all'} if fetch_mode == 'all_offers' else {},
                            'search_terms': []
                        }
                        params['order_field'] = 'id'
                        params['order_direction'] = 'desc'
                        response = self.session.post(base_url, headers=headers, params=params, json=payload, timeout=self.timeout)
                else:
                    # POST to offerstable (fallback)
                    payload = {
                        'filters': {'affiliate_status': '__all'} if fetch_mode == 'all_offers' else {},
                        'search_terms': []
                    }
                    params['order_field'] = 'id'
                    params['order_direction'] = 'desc'
                    response = self.session.post(base_url, headers=headers, params=params, json=payload, timeout=self.timeout)
                
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
                    # offersrunnable returns a direct array
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
    
    # ==================== Adscend Media Implementation ====================
    
    def _test_adscendmedia_connection(self, publisher_id: str, api_key: str) -> Tuple[bool, Optional[int], Optional[str]]:
        """
        Test Adscend Media API connection using Basic Auth.
        
        Args:
            publisher_id: The publisher's ID (numeric) from AdscendMedia dashboard
            api_key: The API key for the publisher account
            
        Returns:
            Tuple of (success, offer_count, error_message)
        """
        try:
            url = f"https://api.adscendmedia.com/v1/publisher/{publisher_id}/offers.json"
            
            logger.info(f"Testing AdscendMedia connection for publisher {publisher_id}")
            
            response = self.session.get(
                url,
                auth=(publisher_id, api_key),
                timeout=self.timeout
            )
            
            if response.status_code == 403:
                return False, None, "Authentication failed: API key doesn't match the Publisher ID"
            elif response.status_code == 401:
                return False, None, f"Invalid credentials. The username should be your publisher ID, while the password should be your API key. (HTTP 401: {response.text[:200]})"
            elif response.status_code == 400:
                return False, None, "Bad request: Publisher ID is required"
            elif response.status_code == 204:
                # No offers available
                return True, 0, None
            elif response.status_code != 200:
                return False, None, f"API returned status {response.status_code}: {response.text[:200]}"
            
            data = response.json()
            offers = data.get('offers', [])
            offer_count = len(offers)
            
            logger.info(f"✅ AdscendMedia connection successful: {offer_count} offers available")
            return True, offer_count, None
            
        except requests.exceptions.Timeout:
            return False, None, "Connection timed out. Please check your network."
        except requests.exceptions.ConnectionError:
            return False, None, "Could not connect to AdscendMedia API. Please check your network."
        except ValueError as e:
            return False, None, f"Invalid JSON response: {str(e)}"
        except Exception as e:
            logger.error(f"AdscendMedia connection test error: {str(e)}", exc_info=True)
            return False, None, f"Connection test failed: {str(e)}"
    
    def _fetch_adscendmedia_offers(self, publisher_id: str, api_key: str,
                                    filters: Optional[Dict] = None,
                                    limit: Optional[int] = None) -> Tuple[List[Dict], Optional[str]]:
        """
        Fetch offers from Adscend Media Offers API v1.
        
        Uses Basic Auth with publisher_id as username and api_key as password.
        Endpoint: GET https://api.adscendmedia.com/v1/publisher/{pubId}/offers.json
        
        Args:
            publisher_id: Publisher ID from AdscendMedia
            api_key: API Key from AdscendMedia
            filters: Optional filters (country, category, platform, etc.)
            limit: Optional limit on number of offers returned
            
        Returns:
            Tuple of (offers_list, error_message)
        """
        try:
            url = f"https://api.adscendmedia.com/v1/publisher/{publisher_id}/offers.json"
            
            # Build query parameters from filters
            params = {}
            if filters:
                # Country filter
                countries = filters.get('countries', [])
                if countries:
                    for country in countries:
                        params.setdefault('country[]', []).append(country) if isinstance(countries, list) else None
                
                # Category filter
                categories = filters.get('categories', [])
                if categories:
                    for cat in categories:
                        params.setdefault('category_id[]', []).append(str(cat))
                
                # Platform filter
                platform = filters.get('platform')
                if platform:
                    params['platform'] = platform
                
                # Minimum payout filter
                min_payout = filters.get('min_payout')
                if min_payout:
                    params['min_payout'] = str(min_payout)
            
            # Limit
            if limit:
                params['limit'] = str(limit)
            
            logger.info(f"Fetching AdscendMedia offers for publisher {publisher_id} with params: {params}")
            
            response = self.session.get(
                url,
                auth=(publisher_id, api_key),
                params=params,
                timeout=60  # Longer timeout for full fetch
            )
            
            if response.status_code == 403:
                return [], "Authentication failed: API key doesn't match the Publisher ID"
            elif response.status_code == 400:
                return [], "Bad request: Publisher ID is required"
            elif response.status_code == 204:
                return [], None  # No offers available, not an error
            elif response.status_code != 200:
                return [], f"API returned status {response.status_code}: {response.text[:200]}"
            
            data = response.json()
            offers = data.get('offers', [])
            
            logger.info(f"✅ Fetched {len(offers)} offers from AdscendMedia")
            
            return offers, None
            
        except requests.exceptions.Timeout:
            return [], "Request timed out fetching offers from AdscendMedia"
        except requests.exceptions.ConnectionError:
            return [], "Could not connect to AdscendMedia API"
        except ValueError as e:
            return [], f"Invalid JSON response from AdscendMedia: {str(e)}"
        except Exception as e:
            logger.error(f"AdscendMedia fetch error: {str(e)}", exc_info=True)
            return [], f"Failed to fetch offers: {str(e)}"
    
    # ==================== CJ Implementation ====================
    
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
