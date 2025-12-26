"""
IPinfo.io Service
Provides superior IP intelligence including VPN/proxy detection, ISP identification, and fraud scoring
"""

import requests
import logging
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
        self.enabled = bool(self.api_token)
        
        if not self.enabled:
            logger.warning("⚠️ IPinfo API token not configured. IP intelligence features will be disabled.")
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
        if not self.enabled:
            logger.debug("IPinfo disabled, returning default data")
            return self._get_default_data(ip_address)
        
        # Handle localhost and private IPs
        if self._is_private_ip(ip_address):
            logger.debug(f"Private/localhost IP detected: {ip_address}")
            return self._get_default_data(ip_address)
        
        # Check cache first
        cached_data = self._get_from_cache(ip_address)
        if cached_data:
            logger.debug(f"✅ Cache hit for IP {ip_address}")
            return cached_data
        
        try:
            # Make API request
            url = f"{self.api_url}/{ip_address}/json"
            headers = {
                'Authorization': f'Bearer {self.api_token}',
                'Accept': 'application/json'
            }
            
            logger.info(f"🔍 Looking up IP {ip_address} via IPinfo API")
            response = requests.get(url, headers=headers, timeout=self.timeout)
            
            if response.status_code == 200:
                data = response.json()
                
                # Check for API errors
                if 'error' in data:
                    logger.error(f"❌ IPinfo API error: {data['error']}")
                    return self._get_default_data(ip_address)
                
                # Parse and structure the data
                ip_data = self._parse_response(data, ip_address)
                
                # Cache the result
                self._save_to_cache(ip_address, ip_data)
                
                logger.info(f"✅ IP lookup successful for {ip_address}")
                return ip_data
            elif response.status_code == 429:
                logger.error(f"⚠️ IPinfo API rate limit exceeded")
                return self._get_default_data(ip_address)
            else:
                logger.error(f"❌ IPinfo API returned status {response.status_code}")
                return self._get_default_data(ip_address)
                
        except requests.exceptions.Timeout:
            logger.error(f"⏱️ IPinfo API timeout for {ip_address}")
            return self._get_default_data(ip_address)
        except Exception as e:
            logger.error(f"❌ IPinfo lookup failed: {str(e)}", exc_info=True)
            return self._get_default_data(ip_address)
    
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
            'country': data.get('country'),
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
            'org': '',
            'vpn_detection': {
                'is_vpn': False,
                'is_proxy': False,
                'is_tor': False,
                'is_datacenter': False,
                'is_relay': False,
                'provider': None,
                'service': None,
                'confidence': 'unknown',
                'isp': 'Unknown'
            },
            'fraud_score': 0,
            'risk_level': 'low',
            'company': {},
            'carrier': {},
            'abuse': {}
        }
    
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
