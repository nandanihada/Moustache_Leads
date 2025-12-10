"""
VPN Detection Service
Detects VPN, Proxy, and Tor usage using IPHub.info API
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
        
        # IPHub.info API endpoint (free, no auth required)
        self.api_url = "http://v2.api.iphub.info/ip/{ip}"
        
        # Cache duration: 24 hours
        self.cache_duration = timedelta(hours=24)
    
    def check_ip(self, ip_address: str) -> Dict:
        """
        Check if IP address is VPN/Proxy/Tor
        
        Args:
            ip_address: IP address to check
        
        Returns:
            dict: {
                'is_vpn': bool,
                'is_proxy': bool,
                'is_tor': bool,
                'is_datacenter': bool,
                'confidence': str,  # 'low', 'medium', 'high'
                'provider': str,    # ISP/VPN provider name
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
            logger.info(f"🔍 VPN check for {ip_address}: Calling IPHub API...")
            result = self._call_iphub_api(ip_address)
            
            # Cache the result
            if result:
                self._save_to_cache(ip_address, result)
            
            return result
            
        except Exception as e:
            logger.error(f"❌ Error checking IP {ip_address}: {e}", exc_info=True)
            # Return safe default on error
            return self._get_default_result()
    
    def _call_iphub_api(self, ip_address: str) -> Dict:
        """Call IPHub.info API to check IP"""
        try:
            url = self.api_url.format(ip=ip_address)
            
            # Make request with timeout
            response = requests.get(url, timeout=5)
            
            if response.status_code == 200:
                data = response.json()
                
                # IPHub block values:
                # 0 = Residential/Unclassified IP (good)
                # 1 = Non-residential IP (hosting provider, proxy, etc.)
                # 2 = Non-residential & residential IP (warning, may flag innocent people)
                block = data.get('block', 0)
                
                # Get ISP info
                isp = data.get('isp', 'Unknown')
                country_code = data.get('countryCode', 'Unknown')
                
                # ENHANCED: Check ISP name for known VPN providers
                isp_lower = isp.lower()
                known_vpn_keywords = [
                    'vpn', 'proxy', 'browsec', 'zenmate', 'nordvpn', 'expressvpn',
                    'surfshark', 'cyberghost', 'purevpn', 'hidemyass', 'hma',
                    'privatevpn', 'ipvanish', 'tunnelbear', 'windscribe',
                    'protonvpn', 'mullvad', 'private internet access', 'pia',
                    'hotspot shield', 'betternet', 'hola', 'touch vpn',
                    'opera vpn', 'avast secureline', 'avg secure',
                    'anonymous', 'hide.me', 'astrill', 'vypr'
                ]
                
                # Check if ISP name contains VPN keywords
                is_vpn_by_name = any(keyword in isp_lower for keyword in known_vpn_keywords)
                
                # Determine VPN/Proxy likelihood
                is_suspicious = block >= 1 or is_vpn_by_name
                is_datacenter = block == 1
                
                # Determine confidence based on detection method
                if is_vpn_by_name:
                    confidence = 'high'  # VPN detected by name - very reliable
                    is_suspicious = True
                elif block == 0:
                    confidence = 'low'  # Residential IP, low risk
                elif block == 1:
                    confidence = 'high'  # Datacenter/hosting, high risk
                else:  # block == 2
                    confidence = 'medium'  # Mixed, medium risk
                
                result = {
                    'is_vpn': is_suspicious,
                    'is_proxy': is_suspicious,
                    'is_tor': False,  # IPHub doesn't specifically detect Tor
                    'is_datacenter': is_datacenter,
                    'confidence': confidence,
                    'provider': isp,
                    'country_code': country_code,
                    'block_level': block,
                    'detected_by': 'isp_name' if is_vpn_by_name else ('iphub' if block >= 1 else 'none'),
                    'checked_at': datetime.utcnow()
                }
                
                if is_vpn_by_name:
                    logger.info(f"🔴 VPN DETECTED by ISP name for {ip_address}: {isp}")
                else:
                    logger.info(f"✅ IPHub result for {ip_address}: block={block}, ISP={isp}, confidence={confidence}")
                
                return result
            
            elif response.status_code == 429:
                # Rate limit exceeded
                logger.warning(f"⚠️ IPHub rate limit exceeded for {ip_address}")
                return self._get_default_result()
            
            else:
                logger.warning(f"⚠️ IPHub API returned status {response.status_code} for {ip_address}")
                return self._get_default_result()
                
        except requests.Timeout:
            logger.warning(f"⚠️ IPHub API timeout for {ip_address}")
            return self._get_default_result()
        except Exception as e:
            logger.error(f"❌ IPHub API error for {ip_address}: {e}")
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
            'block_level': 0,
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
