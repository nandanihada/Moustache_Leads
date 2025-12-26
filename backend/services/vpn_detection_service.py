"""
VPN Detection Service - UPDATED
Uses multiple free APIs for better VPN detection
"""

import requests
import logging
from datetime import datetime, timedelta
from typing import Dict, Optional

logger = logging.getLogger(__name__)

class VPNDetectionService:
    """Service to detect VPN/Proxy/Tor usage from IP addresses"""
    
    def __init__(self, db_instance=None):
        self.db = db_instance
        self.cache_collection = None
        if db_instance and db_instance.is_connected():
            self.cache_collection = db_instance.get_collection('vpn_detection_cache')
            # Create TTL index for automatic cache expiration (24 hours)
            try:
                self.cache_collection.create_index('expires_at', expireAfterSeconds=0)
                self.cache_collection.create_index('ip_address', unique=True)
            except Exception as e:
                logger.warning(f"Could not create indexes: {e}")
        
        # Cache duration: 24 hours
        self.cache_duration = timedelta(hours=24)
    
    def check_ip(self, ip_address: str) -> Dict:
        """
        Check if IP address is VPN/Proxy/Tor
        
        Returns:
            dict: {
                'is_vpn': bool,
                'is_proxy': bool,
                'is_tor': bool,
                'is_datacenter': bool,
                'confidence': str,
                'provider': str,
                'country_code': str,
                'checked_at': datetime
            }
        """
        try:
            # Check cache first
            cached = self._get_from_cache(ip_address)
            if cached:
                logger.info(f"✅ VPN check for {ip_address}: Using cached result")
                return cached
            
            # Make API request
            logger.info(f"🔍 VPN check for {ip_address}: Calling VPN detection API...")
            result = self._check_vpn_api(ip_address)
            
            # Cache the result
            if result:
                self._save_to_cache(ip_address, result)
            
            return result
            
        except Exception as e:
            logger.error(f"❌ Error checking IP {ip_address}: {e}", exc_info=True)
            return self._get_default_result()
    
    def _check_vpn_api(self, ip_address: str) -> Dict:
        """
        Check IP using multiple methods:
        1. IP-API.com (free, no key required, has proxy detection)
        2. ISP name matching for known VPN providers
        """
        try:
            # Use IP-API.com (free tier: 45 requests/minute)
            url = f"http://ip-api.com/json/{ip_address}?fields=status,message,country,countryCode,isp,org,as,proxy,hosting"
            
            response = requests.get(url, timeout=5)
            
            if response.status_code == 200:
                data = response.json()
                
                if data.get('status') == 'success':
                    # Get ISP and organization info
                    isp = data.get('isp', 'Unknown')
                    org = data.get('org', '')
                    country_code = data.get('countryCode', 'Unknown')
                    
                    # IP-API provides proxy and hosting flags
                    is_proxy_api = data.get('proxy', False)
                    is_hosting = data.get('hosting', False)
                    
                    # Check ISP/Org name for VPN keywords
                    text_to_check = f"{isp} {org}".lower()
                    
                    known_vpn_keywords = [
                        'vpn', 'proxy', 'browsec', 'zenmate', 'nordvpn', 'expressvpn',
                        'surfshark', 'cyberghost', 'purevpn', 'hidemyass', 'hma',
                        'privatevpn', 'ipvanish', 'tunnelbear', 'windscribe',
                        'protonvpn', 'mullvad', 'private internet access', 'pia',
                        'hotspot shield', 'betternet', 'hola', 'touch vpn',
                        'opera vpn', 'avast secureline', 'avg secure',
                        'anonymous', 'hide.me', 'astrill', 'vypr', 'torguard'
                    ]
                    
                    is_vpn_by_name = any(keyword in text_to_check for keyword in known_vpn_keywords)
                    
                    # Determine if suspicious
                    is_suspicious = is_proxy_api or is_hosting or is_vpn_by_name
                    
                    # Determine confidence
                    if is_vpn_by_name:
                        confidence = 'high'
                        detected_by = 'isp_name'
                    elif is_proxy_api:
                        confidence = 'high'
                        detected_by = 'ip_api_proxy'
                    elif is_hosting:
                        confidence = 'medium'
                        detected_by = 'ip_api_hosting'
                    else:
                        confidence = 'low'
                        detected_by = 'none'
                    
                    result = {
                        'is_vpn': is_suspicious,
                        'is_proxy': is_proxy_api or is_vpn_by_name,
                        'is_tor': False,  # IP-API doesn't detect Tor specifically
                        'is_datacenter': is_hosting,
                        'confidence': confidence,
                        'provider': isp,
                        'country_code': country_code,
                        'detected_by': detected_by,
                        'checked_at': datetime.utcnow()
                    }
                    
                    if is_suspicious:
                        logger.info(f"🔴 VPN/PROXY DETECTED for {ip_address}: {isp} (detected_by: {detected_by})")
                    else:
                        logger.info(f"✅ Clean IP {ip_address}: {isp}")
                    
                    return result
                else:
                    logger.warning(f"⚠️ IP-API returned error: {data.get('message')}")
                    return self._get_default_result()
            else:
                logger.warning(f"⚠️ IP-API returned status {response.status_code}")
                return self._get_default_result()
                
        except requests.Timeout:
            logger.warning(f"⚠️ IP-API timeout for {ip_address}")
            return self._get_default_result()
        except Exception as e:
            logger.error(f"❌ IP-API error for {ip_address}: {e}")
            return self._get_default_result()
    
    def _get_from_cache(self, ip_address: str) -> Optional[Dict]:
        """Get cached VPN detection result"""
        if not self.cache_collection:
            return None
        
        try:
            cached = self.cache_collection.find_one({
                'ip_address': ip_address,
                'expires_at': {'$gt': datetime.utcnow()}
            })
            
            if cached:
                # Remove MongoDB-specific fields
                cached.pop('_id', None)
                cached.pop('expires_at', None)
                return cached
            
        except Exception as e:
            logger.error(f"Error reading from cache: {e}")
        
        return None
    
    def _save_to_cache(self, ip_address: str, result: Dict):
        """Save VPN detection result to cache"""
        if not self.cache_collection:
            return
        
        try:
            cache_doc = {
                'ip_address': ip_address,
                **result,
                'expires_at': datetime.utcnow() + self.cache_duration
            }
            
            # Upsert (update if exists, insert if not)
            self.cache_collection.update_one(
                {'ip_address': ip_address},
                {'$set': cache_doc},
                upsert=True
            )
            
            logger.info(f"💾 Cached VPN result for {ip_address}")
            
        except Exception as e:
            logger.error(f"Error saving to cache: {e}")
    
    def _get_default_result(self) -> Dict:
        """Return default result when API fails"""
        return {
            'is_vpn': False,
            'is_proxy': False,
            'is_tor': False,
            'is_datacenter': False,
            'confidence': 'low',
            'provider': 'Unknown',
            'country_code': 'Unknown',
            'detected_by': 'none',
            'checked_at': datetime.utcnow()
        }


# Singleton instance
_vpn_detection_service = None

def get_vpn_detection_service(db_instance=None):
    """Get singleton instance of VPN detection service"""
    global _vpn_detection_service
    if _vpn_detection_service is None:
        _vpn_detection_service = VPNDetectionService(db_instance)
    return _vpn_detection_service
