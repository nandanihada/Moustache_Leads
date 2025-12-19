"""
IP2Location Service
Provides IP intelligence including VPN/proxy detection, ISP identification, and fraud scoring
"""

import requests
import logging
from datetime import datetime, timedelta
import os

logger = logging.getLogger(__name__)

class IP2LocationService:
    def __init__(self):
        self.api_key = os.environ.get('IP2LOCATION_API_KEY', '')
        self.api_url = os.environ.get('IP2LOCATION_API_URL', 'https://api.ip2location.io/')
        self.cache_ttl = int(os.environ.get('IP2LOCATION_CACHE_TTL', 86400))  # 24 hours default
        self.cache = {}  # In-memory cache (use Redis in production)
        self.enabled = bool(self.api_key)
        
        if not self.enabled:
            logger.warning("⚠️ IP2Location API key not configured. IP intelligence features will be disabled.")
    
    def lookup_ip(self, ip_address):
        """
        Lookup comprehensive IP data from IP2Location
        
        Returns:
            dict: IP intelligence data or None if lookup fails
        """
        if not self.enabled:
            logger.debug("IP2Location disabled, returning default data")
            return self._get_default_data(ip_address)
        
        # Check cache first
        cached_data = self._get_from_cache(ip_address)
        if cached_data:
            logger.debug(f"✅ Cache hit for IP {ip_address}")
            return cached_data
        
        try:
            # Make API request
            params = {
                'key': self.api_key,
                'ip': ip_address,
                'format': 'json'
            }
            
            logger.info(f"🔍 Looking up IP {ip_address} via IP2Location API")
            response = requests.get(self.api_url, params=params, timeout=5)
            
            if response.status_code == 200:
                data = response.json()
                
                # Check for API errors
                if 'error' in data:
                    logger.error(f"❌ IP2Location API error: {data['error']}")
                    return self._get_default_data(ip_address)
                
                # Parse and structure the data
                ip_data = self._parse_response(data, ip_address)
                
                # Cache the result
                self._save_to_cache(ip_address, ip_data)
                
                logger.info(f"✅ IP lookup successful for {ip_address}")
                return ip_data
            else:
                logger.error(f"❌ IP2Location API returned status {response.status_code}")
                return self._get_default_data(ip_address)
                
        except requests.exceptions.Timeout:
            logger.error(f"⏱️ IP2Location API timeout for {ip_address}")
            return self._get_default_data(ip_address)
        except Exception as e:
            logger.error(f"❌ IP2Location lookup failed: {str(e)}", exc_info=True)
            return self._get_default_data(ip_address)
    
    def detect_vpn_proxy(self, ip_address):
        """
        Specific VPN/proxy detection
        
        Returns:
            dict: VPN/proxy detection data
        """
        ip_data = self.lookup_ip(ip_address)
        if not ip_data:
            return {
                'is_vpn': False,
                'is_proxy': False,
                'is_tor': False,
                'is_datacenter': False,
                'provider': None,
                'confidence': 'unknown'
            }
        
        return ip_data.get('vpn_detection', {})
    
    def calculate_fraud_score(self, ip_data):
        """
        Calculate fraud risk score based on IP data
        
        Returns:
            int: Fraud score 0-100
        """
        if not ip_data:
            return 0
        
        # Use IP2Location's fraud score if available
        if 'fraud_score' in ip_data:
            return ip_data['fraud_score']
        
        # Otherwise calculate based on available data
        score = 0
        vpn_detection = ip_data.get('vpn_detection', {})
        
        if vpn_detection.get('is_vpn'):
            score += 30
        if vpn_detection.get('is_proxy'):
            score += 25
        if vpn_detection.get('is_tor'):
            score += 40
        if vpn_detection.get('is_datacenter'):
            score += 20
        
        usage_type = ip_data.get('usage_type', '')
        if usage_type in ['DCH', 'ISP/MOB']:  # Datacenter or ISP/Mobile
            score += 15
        
        return min(score, 100)
    
    def _parse_response(self, data, ip_address):
        """Parse IP2Location API response into structured format"""
        
        # Determine if proxy/VPN
        is_proxy = data.get('is_proxy', False)
        proxy_type = data.get('proxy_type', '')
        
        # Map proxy types
        is_vpn = proxy_type in ['VPN', 'CPN']  # VPN or Consumer Privacy Network
        is_tor = proxy_type == 'TOR'
        is_datacenter = proxy_type in ['DCH', 'SES']  # Datacenter or Search Engine Spider
        is_residential_proxy = proxy_type == 'RES'
        
        vpn_detection = {
            'is_vpn': is_vpn,
            'is_proxy': is_proxy,
            'is_tor': is_tor,
            'is_datacenter': is_datacenter,
            'is_residential_proxy': is_residential_proxy,
            'provider': data.get('provider'),
            'proxy_type': proxy_type,
            'threat_type': data.get('threat'),
            'confidence': 'high' if is_proxy else 'low',
            'isp': data.get('isp', data.get('as', 'Unknown'))
        }
        
        # Get fraud score
        fraud_score = data.get('fraud_score', 0)
        if fraud_score == 0 and is_proxy:
            # Calculate if not provided
            fraud_score = self.calculate_fraud_score({'vpn_detection': vpn_detection})
        
        # Determine risk level
        if fraud_score >= 76:
            risk_level = 'critical'
        elif fraud_score >= 51:
            risk_level = 'high'
        elif fraud_score >= 26:
            risk_level = 'medium'
        else:
            risk_level = 'low'
        
        return {
            'ip_address': ip_address,
            'country': data.get('country_name'),
            'country_code': data.get('country_code'),
            'region': data.get('region_name'),
            'city': data.get('city_name'),
            'latitude': data.get('latitude'),
            'longitude': data.get('longitude'),
            'zip_code': data.get('zip_code'),
            'time_zone': data.get('time_zone'),
            'isp': data.get('isp', data.get('as', 'Unknown')),
            'domain': data.get('domain'),
            'asn': data.get('asn'),
            'usage_type': data.get('usage_type'),
            'vpn_detection': vpn_detection,
            'fraud_score': fraud_score,
            'risk_level': risk_level,
            'threat_type': data.get('threat'),
            'raw_data': data  # Store raw response for debugging
        }
    
    def _get_default_data(self, ip_address):
        """Return default data when API is unavailable"""
        return {
            'ip_address': ip_address,
            'country': 'Unknown',
            'country_code': 'XX',
            'region': 'Unknown',
            'city': 'Unknown',
            'latitude': 0,
            'longitude': 0,
            'zip_code': '',
            'time_zone': '',
            'isp': 'Unknown',
            'domain': '',
            'asn': '',
            'usage_type': 'Unknown',
            'vpn_detection': {
                'is_vpn': False,
                'is_proxy': False,
                'is_tor': False,
                'is_datacenter': False,
                'is_residential_proxy': False,
                'provider': None,
                'proxy_type': '',
                'threat_type': None,
                'confidence': 'unknown',
                'isp': 'Unknown'
            },
            'fraud_score': 0,
            'risk_level': 'low',
            'threat_type': None
        }
    
    def _get_from_cache(self, ip_address):
        """Get IP data from cache"""
        if ip_address in self.cache:
            cached_entry = self.cache[ip_address]
            # Check if cache is still valid
            if datetime.utcnow() < cached_entry['expires_at']:
                return cached_entry['data']
            else:
                # Cache expired, remove it
                del self.cache[ip_address]
        return None
    
    def _save_to_cache(self, ip_address, data):
        """Save IP data to cache"""
        self.cache[ip_address] = {
            'data': data,
            'expires_at': datetime.utcnow() + timedelta(seconds=self.cache_ttl)
        }
        logger.debug(f"💾 Cached IP data for {ip_address} (TTL: {self.cache_ttl}s)")
    
    def clear_cache(self):
        """Clear all cached data"""
        self.cache = {}
        logger.info("🗑️ IP2Location cache cleared")


# Singleton instance
_ip2location_service = None

def get_ip2location_service():
    """Get singleton instance of IP2Location service"""
    global _ip2location_service
    if _ip2location_service is None:
        _ip2location_service = IP2LocationService()
    return _ip2location_service
