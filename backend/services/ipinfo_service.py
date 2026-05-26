"""
IPinfo.io Service
Provides superior IP intelligence including VPN/proxy detection, ISP identification, and fraud scoring
"""

import requests
import logging
import threading
from datetime import datetime, timedelta
import os

logger = logging.getLogger(__name__)

class IPinfoService:
    def __init__(self):
        self.api_token = os.environ.get('IPINFO_API_TOKEN', '')
        self.api_url = 'https://ipinfo.io'
        self.cache_ttl = int(os.environ.get('IPINFO_CACHE_TTL', 86400))  # 24 hours default
        self.timeout = int(os.environ.get('IPINFO_TIMEOUT', 5))  # 5 seconds default
        self.cache = {}  # In-memory cache (use Redis in production)
        self._lock = threading.Lock()
        self.enabled = bool(self.api_token)
        
        # ISO Country Code to Name mapping
        self.country_names = {
            'BD': 'Bangladesh', 'IN': 'India', 'US': 'United States', 'GB': 'United Kingdom', 
            'AU': 'Australia', 'CA': 'Canada', 'DE': 'Germany', 'FR': 'France', 'IT': 'Italy', 
            'ES': 'Spain', 'BR': 'Brazil', 'RU': 'Russia', 'CN': 'China', 'JP': 'Japan', 
            'PK': 'Pakistan', 'AE': 'United Arab Emirates', 'SA': 'Saudi Arabia', 'MY': 'Malaysia', 
            'ID': 'Indonesia', 'SG': 'Singapore', 'TH': 'Thailand', 'VN': 'Vietnam', 'PH': 'Philippines',
            'HK': 'Hong Kong', 'TW': 'Taiwan', 'KR': 'South Korea', 'NL': 'Netherlands', 'CH': 'Switzerland',
            'SE': 'Sweden', 'NO': 'Norway', 'DK': 'Denmark', 'FI': 'Finland', 'IE': 'Ireland',
            'MX': 'Mexico', 'AR': 'Argentina', 'CO': 'Colombia', 'CL': 'Chile', 'PE': 'Peru',
            'ZA': 'South Africa', 'EG': 'Egypt', 'NG': 'Nigeria', 'KE': 'Kenya', 'MA': 'Morocco'
        }
        
        if not self.enabled:
            logger.warning("⚠️ IPinfo API token not configured. IP intelligence features will be limited to free ip-api.com fallback.")
        else:
            logger.info("✅ IPinfo service initialized")
    
    def lookup_ip(self, ip_address):
        """
        Lookup comprehensive IP data from IPinfo.io
        
        Args:
            ip_address (str): IP address to lookup
            
        Returns:
            dict: IP intelligence data or None if lookup fails
        """
        # Normalize: take first IP from X-Forwarded-For chain
        if not ip_address:
            ip_address = '127.0.0.1'
        ip_address = ip_address.split(',')[0].strip()
        
        # Check cache first
        cached_data = self._get_from_cache(ip_address)
        if cached_data:
            return cached_data
            
        is_private = self._is_private_ip(ip_address) or ip_address in ('invalid', 'unknown', '')
        if is_private:
            logger.info(f"Private/local IP address {ip_address} detected. Will fallback to host public IP.")
        
        # Prevent duplicate concurrent lookups for same IP
        with self._lock:
            # Re-check cache (another thread may have populated it while we waited)
            cached_data = self._get_from_cache(ip_address)
            if cached_data:
                return cached_data
        
        if not self.enabled:
            logger.debug("IPinfo token not found, falling back to free ip-api.com")
            return self._lookup_ip_api_fallback(ip_address)
            
        try:
            # If IP is private/local, query without specifying IP to get host public IP
            query_ip = "" if is_private else ip_address
            
            # Make API request
            if query_ip:
                url = f"{self.api_url}/{query_ip}/json"
            else:
                url = f"{self.api_url}/json"
                
            headers = {
                'Accept': 'application/json'
            }
            if self.api_token:
                headers['Authorization'] = f'Bearer {self.api_token}'
            
            logger.info(f"🔍 Looking up IP {ip_address} (query: {query_ip or 'host public IP'}) via IPinfo API")
            response = requests.get(url, headers=headers, timeout=self.timeout)
            
            if response.status_code == 200:
                data = response.json()
                
                # Check for API errors
                if 'error' in data:
                    logger.error(f"❌ IPinfo API error: {data['error']}")
                    return self._lookup_ip_api_fallback(ip_address)
                
                # Parse and structure the data (map to the original ip_address)
                ip_data = self._parse_response(data, ip_address)
                
                # Cache the result under original ip_address
                self._save_to_cache(ip_address, ip_data)
                
                logger.debug(f"✅ IP lookup successful for {ip_address}")
                return ip_data
            elif response.status_code == 429:
                logger.error(f"⚠️ IPinfo API rate limit exceeded")
                return self._lookup_ip_api_fallback(ip_address)
            else:
                logger.error(f"❌ IPinfo API returned status {response.status_code}")
                return self._lookup_ip_api_fallback(ip_address)
                
        except requests.exceptions.Timeout:
            logger.error(f"⏱️ IPinfo API timeout for {ip_address}")
            return self._lookup_ip_api_fallback(ip_address)
        except Exception as e:
            logger.error(f"❌ IPinfo lookup failed: {str(e)}", exc_info=True)
            return self._lookup_ip_api_fallback(ip_address)
    
    def detect_vpn_proxy(self, ip_address):
        """
        Specific VPN/proxy detection
        
        Args:
            ip_address (str): IP address to check
            
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
                'is_relay': False,
                'provider': None,
                'service': None,
                'confidence': 'unknown'
            }
        
        return ip_data.get('vpn_detection', {})
    
    def calculate_fraud_score(self, ip_data):
        """
        Calculate fraud risk score based on IP data
        
        Args:
            ip_data (dict): IP data from lookup
            
        Returns:
            int: Fraud score 0-100
        """
        if not ip_data:
            return 0
        
        score = 0
        vpn_detection = ip_data.get('vpn_detection', {})
        
        # Weight different privacy indicators
        if vpn_detection.get('is_tor'):
            score += 45  # Tor is highest risk
        if vpn_detection.get('is_proxy'):
            score += 35  # Proxies are high risk
        if vpn_detection.get('is_vpn'):
            score += 30  # VPNs are moderate-high risk
        if vpn_detection.get('is_datacenter'):
            score += 25  # Datacenter IPs are moderate risk
        if vpn_detection.get('is_relay'):
            score += 20  # Relays are moderate risk
        if vpn_detection.get('service'):
            score += 10  # Known service adds risk
        
        # Company type can indicate risk
        company = ip_data.get('company', {})
        if company.get('type') == 'hosting':
            score += 15
        
        return min(score, 100)
    
    def _lookup_ip_api_fallback(self, ip_address):
        """Fallback to various free IP geolocation services if IPinfo fails."""
        if not ip_address:
            ip_address = '127.0.0.1'
        ip_address = ip_address.split(',')[0].strip()
        
        # Check cache first
        cached_data = self._get_from_cache(ip_address)
        if cached_data:
            return cached_data
            
        query_ip = ip_address
        is_private = self._is_private_ip(ip_address) or ip_address in ('invalid', 'unknown', '')
        if is_private:
            query_ip = "" # Allow fallback providers to use host IP if supported
            
        providers = [
            self._try_freeipapi,
            self._try_ipwhois,
            self._try_ipapico,
            self._try_ip_api_com
        ]
        
        for provider in providers:
            try:
                ip_data = provider(query_ip)
                if ip_data:
                    # Make sure the original IP is preserved in the response
                    ip_data['ip_address'] = ip_address
                    if ip_data.get('ip') == query_ip:
                        ip_data['ip'] = ip_address
                    self._save_to_cache(ip_address, ip_data)
                    return ip_data
            except Exception as e:
                logger.warning(f"Fallback provider {provider.__name__} failed for {ip_address}: {e}")
                
        return self._get_default_data(ip_address)

    def _try_freeipapi(self, ip_address):
        logger.info(f"🔍 Trying freeipapi.com lookup for IP: {ip_address}")
        url = f"https://freeipapi.com/api/json/{ip_address}"
        response = requests.get(url, timeout=3)
        if response.status_code == 200:
            data = response.json()
            if data.get('cityName') or data.get('countryName'):
                country_code = data.get('countryCode')
                country = self.country_names.get(country_code, data.get('countryName'))
                vpn_detection = {
                    'is_vpn': False,
                    'is_proxy': False,
                    'is_tor': False,
                    'is_datacenter': False,
                    'is_relay': False,
                    'provider': None,
                    'service': None,
                    'confidence': 'low',
                    'isp': 'Unknown'
                }
                return {
                    'ip_address': ip_address,
                    'hostname': None,
                    'country': country,
                    'country_code': country_code,
                    'region': data.get('regionName'),
                    'city': data.get('cityName'),
                    'latitude': data.get('latitude', 0),
                    'longitude': data.get('longitude', 0),
                    'zip_code': data.get('zipCode', ''),
                    'time_zone': data.get('timeZone', ''),
                    'isp': 'Unknown',
                    'domain': '',
                    'asn': '',
                    'org': '',
                    'vpn_detection': vpn_detection,
                    'fraud_score': 0,
                    'risk_level': 'low',
                    'company': {},
                    'carrier': {},
                    'abuse': {}
                }
        return None

    def _try_ipwhois(self, ip_address):
        logger.info(f"🔍 Trying ipwho.is lookup for IP: {ip_address}")
        url = f"https://ipwho.is/{ip_address}"
        response = requests.get(url, timeout=3)
        if response.status_code == 200:
            data = response.json()
            if data.get('success'):
                country_code = data.get('country_code')
                country = self.country_names.get(country_code, data.get('country'))
                vpn_detection = {
                    'is_vpn': False,
                    'is_proxy': False,
                    'is_tor': False,
                    'is_datacenter': False,
                    'is_relay': False,
                    'provider': None,
                    'service': None,
                    'confidence': 'low',
                    'isp': data.get('connection', {}).get('isp', 'Unknown')
                }
                return {
                    'ip_address': ip_address,
                    'hostname': None,
                    'country': country,
                    'country_code': country_code,
                    'region': data.get('region'),
                    'city': data.get('city'),
                    'latitude': data.get('latitude', 0),
                    'longitude': data.get('longitude', 0),
                    'zip_code': data.get('postal', ''),
                    'time_zone': data.get('timezone', {}).get('id', ''),
                    'isp': data.get('connection', {}).get('isp', 'Unknown'),
                    'domain': '',
                    'asn': str(data.get('connection', {}).get('asn', '')),
                    'org': data.get('connection', {}).get('org', ''),
                    'vpn_detection': vpn_detection,
                    'fraud_score': 0,
                    'risk_level': 'low',
                    'company': {},
                    'carrier': {},
                    'abuse': {}
                }
        return None

    def _try_ipapico(self, ip_address):
        logger.info(f"🔍 Trying ipapi.co lookup for IP: {ip_address}")
        url = f"https://ipapi.co/{ip_address}/json/"
        headers = {'User-Agent': 'Mozilla/5.0'}
        response = requests.get(url, headers=headers, timeout=3)
        if response.status_code == 200:
            data = response.json()
            if 'error' not in data and (data.get('city') or data.get('country_name')):
                country_code = data.get('country_code')
                country = self.country_names.get(country_code, data.get('country_name'))
                vpn_detection = {
                    'is_vpn': False,
                    'is_proxy': False,
                    'is_tor': False,
                    'is_datacenter': False,
                    'is_relay': False,
                    'provider': None,
                    'service': None,
                    'confidence': 'low',
                    'isp': data.get('org', 'Unknown')
                }
                return {
                    'ip_address': ip_address,
                    'hostname': None,
                    'country': country,
                    'country_code': country_code,
                    'region': data.get('region'),
                    'city': data.get('city'),
                    'latitude': data.get('latitude', 0),
                    'longitude': data.get('longitude', 0),
                    'zip_code': data.get('postal', ''),
                    'time_zone': data.get('timezone', ''),
                    'isp': data.get('org', 'Unknown'),
                    'domain': '',
                    'asn': data.get('asn', ''),
                    'org': data.get('org', ''),
                    'vpn_detection': vpn_detection,
                    'fraud_score': 0,
                    'risk_level': 'low',
                    'company': {},
                    'carrier': {},
                    'abuse': {}
                }
        return None

    def _try_ip_api_com(self, ip_address):
        logger.info(f"🔍 Trying ip-api.com lookup for IP: {ip_address}")
        url = f'http://ip-api.com/json/{ip_address}?fields=status,country,countryCode,regionName,city,zip,lat,lon,isp,org,as,asname,proxy,vpn,hosting'
        response = requests.get(url, timeout=3)
        if response.status_code == 200:
            data = response.json()
            if data.get('status') == 'success':
                country_code = data.get('countryCode')
                country = self.country_names.get(country_code, data.get('country'))
                vpn_detection = {
                    'is_vpn': data.get('vpn', False),
                    'is_proxy': data.get('proxy', False),
                    'is_tor': False,
                    'is_datacenter': data.get('hosting', False),
                    'is_relay': False,
                    'provider': None,
                    'service': None,
                    'confidence': 'high' if (data.get('vpn') or data.get('proxy') or data.get('hosting')) else 'low',
                    'isp': data.get('isp', 'Unknown')
                }
                return {
                    'ip_address': ip_address,
                    'hostname': None,
                    'country': country,
                    'country_code': country_code,
                    'region': data.get('regionName'),
                    'city': data.get('city'),
                    'latitude': data.get('lat', 0),
                    'longitude': data.get('lon', 0),
                    'zip_code': data.get('zip', ''),
                    'time_zone': '',
                    'isp': data.get('isp', 'Unknown'),
                    'domain': '',
                    'asn': data.get('as', ''),
                    'org': data.get('org', ''),
                    'vpn_detection': vpn_detection,
                    'fraud_score': self.calculate_fraud_score({'vpn_detection': vpn_detection}),
                    'risk_level': 'low',
                    'company': {},
                    'carrier': {},
                    'abuse': {}
                }
        return None

    def _parse_response(self, data, ip_address):
        """Parse IPinfo API response into structured format"""
        
        # Extract privacy data
        privacy = data.get('privacy', {})
        
        # Map privacy flags
        vpn_detection = {
            'is_vpn': privacy.get('vpn', False),
            'is_proxy': privacy.get('proxy', False),
            'is_tor': privacy.get('tor', False),
            'is_datacenter': privacy.get('hosting', False),
            'is_relay': privacy.get('relay', False),
            'provider': None,  # IPinfo doesn't always provide this
            'service': privacy.get('service'),  # VPN/proxy service name
            'confidence': 'high' if any([
                privacy.get('vpn'),
                privacy.get('proxy'),
                privacy.get('tor'),
                privacy.get('hosting'),
                privacy.get('relay')
            ]) else 'low',
            'isp': data.get('org', 'Unknown')
        }
        
        # Calculate fraud score
        fraud_score = self.calculate_fraud_score({'vpn_detection': vpn_detection, 'company': data.get('company', {})})
        
        # Determine risk level
        if fraud_score >= 76:
            risk_level = 'critical'
        elif fraud_score >= 51:
            risk_level = 'high'
        elif fraud_score >= 26:
            risk_level = 'medium'
        else:
            risk_level = 'low'
        
        # Parse location
        loc = data.get('loc', '0,0').split(',')
        latitude = float(loc[0]) if len(loc) > 0 else 0
        longitude = float(loc[1]) if len(loc) > 1 else 0
        
        # Extract ASN from org field (format: "AS15169 Google LLC")
        org = data.get('org', '')
        asn = ''
        if org.startswith('AS'):
            parts = org.split(' ', 1)
            if len(parts) > 0:
                asn = parts[0]
        
        return {
            'ip_address': ip_address,
            'hostname': data.get('hostname'),
            'country': self.country_names.get(data.get('country'), data.get('country')),
            'country_code': data.get('country'),
            'region': data.get('region'),
            'city': data.get('city'),
            'latitude': latitude,
            'longitude': longitude,
            'zip_code': data.get('postal', ''),
            'time_zone': data.get('timezone', ''),
            'isp': data.get('org', 'Unknown'),
            'domain': data.get('hostname', ''),
            'asn': asn,
            'org': data.get('org', ''),
            'vpn_detection': vpn_detection,
            'fraud_score': fraud_score,
            'risk_level': risk_level,
            'company': data.get('company', {}),
            'carrier': data.get('carrier', {}),
            'abuse': data.get('abuse', {}),
            'raw_data': data  # Store raw response for debugging
        }
    
    def _get_default_data(self, ip_address):
        """Return default data when API is unavailable or for private IPs"""
        return {
            'ip_address': ip_address,
            'hostname': None,
            'country': 'Location Unavailable',
            'country_code': 'XX',
            'region': 'Location Unavailable',
            'city': 'Location Unavailable',
            'latitude': 0,
            'longitude': 0,
            'zip_code': '',
            'time_zone': '',
            'isp': 'Location Unavailable',
            'domain': '',
            'asn': '',
            'org': 'Location Unavailable',
            'vpn_detection': {
                'is_vpn': False,
                'is_proxy': False,
                'is_tor': False,
                'is_datacenter': False,
                'is_relay': False,
                'provider': None,
                'service': None,
                'confidence': 'unknown',
                'isp': 'Location Unavailable'
            },
            'fraud_score': 0,
            'risk_level': 'low',
            'company': {},
            'carrier': {},
            'abuse': {}
        }
    
    def _is_valid_ip(self, ip_address):
        """Check if the string is a valid IP address (IPv4 or IPv6)"""
        import ipaddress as _ipaddress
        if not ip_address or not isinstance(ip_address, str):
            return False
        # Handle X-Forwarded-For with multiple IPs — take the first one
        ip_address = ip_address.split(',')[0].strip()
        if not ip_address:
            return False
        try:
            _ipaddress.ip_address(ip_address)
            return True
        except ValueError:
            return False

    def _is_private_ip(self, ip_address):
        """Check if IP is private/localhost"""
        private_ranges = [
            '127.',  # Localhost
            '10.',   # Private Class A
            '172.16.', '172.17.', '172.18.', '172.19.',  # Private Class B
            '172.20.', '172.21.', '172.22.', '172.23.',
            '172.24.', '172.25.', '172.26.', '172.27.',
            '172.28.', '172.29.', '172.30.', '172.31.',
            '192.168.',  # Private Class C
            '169.254.',  # Link-local
            '::1',  # IPv6 localhost
            'fc00:',  # IPv6 private
            'fd00:',  # IPv6 private
        ]
        
        return any(ip_address.startswith(prefix) for prefix in private_ranges)
    
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
        logger.info("🗑️ IPinfo cache cleared")


# Singleton instance
_ipinfo_service = None

def get_ipinfo_service():
    """Get singleton instance of IPinfo service"""
    global _ipinfo_service
    if _ipinfo_service is None:
        _ipinfo_service = IPinfoService()
    return _ipinfo_service

# Alias for backward compatibility
get_ip2location_service = get_ipinfo_service

