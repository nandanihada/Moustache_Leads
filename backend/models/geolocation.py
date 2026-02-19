"""
Geolocation and IP Intelligence Service
Provides IP-based geolocation, ISP, ASN, and fraud detection
"""
import requests
import logging
from typing import Dict, Optional
from functools import lru_cache
import json

logger = logging.getLogger(__name__)


class GeolocationService:
    """
    Get geolocation, ISP, ASN, and fraud indicators from IP address
    Uses multiple free/paid APIs
    """
    
    def __init__(self):
        self.cache = {}
    
    @lru_cache(maxsize=1000)
    def get_ip_info(self, ip_address: str) -> Dict:
        """
        Get comprehensive IP information
        Returns: country, region, city, postal_code, coordinates, isp, asn, organization
        """
        # Handle empty, None, or local IPs
        if not ip_address or ip_address in ['127.0.0.1', 'localhost', '::1', '']:
            return self._get_default_info()
        
        # Strip whitespace
        ip_address = ip_address.strip()
        
        # Check cache first
        if ip_address in self.cache:
            return self.cache[ip_address]
        
        try:
            # Try ip-api.com (free tier)
            info = self._get_from_ip_api(ip_address)
            if info:
                self.cache[ip_address] = info
                return info
        except Exception as e:
            logger.warning(f"Error getting IP info from ip-api: {e}")
        
        try:
            # Fallback to ipapi.co
            info = self._get_from_ipapi_co(ip_address)
            if info:
                self.cache[ip_address] = info
                return info
        except Exception as e:
            logger.warning(f"Error getting IP info from ipapi.co: {e}")
        
        # Return default if all APIs fail
        return self._get_default_info()
    
    def _get_from_ip_api(self, ip_address: str) -> Optional[Dict]:
        """Get info from ip-api.com"""
        try:
            response = requests.get(
                f'http://ip-api.com/json/{ip_address}?fields=status,country,countryCode,region,regionName,city,zip,lat,lon,isp,org,as,asname,proxy,vpn,tor,hosting',
                timeout=3
            )
            
            if response.status_code == 200:
                data = response.json()
                
                if data.get('status') == 'success':
                    return {
                        'country': data.get('country'),
                        'country_code': data.get('countryCode'),
                        'region': data.get('regionName'),
                        'city': data.get('city'),
                        'postal_code': data.get('zip'),
                        'latitude': data.get('lat'),
                        'longitude': data.get('lon'),
                        'isp': data.get('isp'),
                        'organization': data.get('org'),
                        'asn': data.get('as'),
                        'asn_name': data.get('asname'),
                        'vpn_detected': data.get('vpn', False),
                        'proxy_detected': data.get('proxy', False),
                        'tor_detected': data.get('tor', False),
                        'hosting_detected': data.get('hosting', False),
                    }
        except Exception as e:
            logger.warning(f"Error from ip-api: {e}")
        
        return None
    
    def _get_from_ipapi_co(self, ip_address: str) -> Optional[Dict]:
        """Get info from ipapi.co"""
        try:
            response = requests.get(
                f'https://ipapi.co/{ip_address}/json/',
                timeout=3
            )
            
            if response.status_code == 200:
                data = response.json()
                
                return {
                    'country': data.get('country_name'),
                    'country_code': data.get('country_code'),
                    'region': data.get('region'),
                    'city': data.get('city'),
                    'postal_code': data.get('postal'),
                    'latitude': data.get('latitude'),
                    'longitude': data.get('longitude'),
                    'isp': data.get('isp'),
                    'organization': data.get('org'),
                    'asn': data.get('asn'),
                    'asn_name': data.get('asn_name'),
                    'vpn_detected': False,  # Not available in free tier
                    'proxy_detected': False,
                    'tor_detected': False,
                    'hosting_detected': False,
                }
        except Exception as e:
            logger.warning(f"Error from ipapi.co: {e}")
        
        return None
    
    def _get_default_info(self) -> Dict:
        """Return default/unknown info"""
        return {
            'country': 'Unknown',
            'country_code': 'XX',
            'region': 'Unknown',
            'city': 'Unknown',
            'postal_code': 'Unknown',
            'latitude': None,
            'longitude': None,
            'isp': 'Unknown',
            'organization': 'Unknown',
            'asn': 'Unknown',
            'asn_name': 'Unknown',
            'vpn_detected': False,
            'proxy_detected': False,
            'tor_detected': False,
            'hosting_detected': False,
        }


class FraudDetectionService:
    """
    Detect fraudulent clicks based on various indicators
    """
    
    def __init__(self, db_instance):
        self.db = db_instance
        self.clicks_col = db_instance.get_collection('offerwall_clicks_detailed')
        self.sessions_col = db_instance.get_collection('offerwall_sessions_detailed')
    
    def detect_fraud(self, click_data: Dict) -> Dict:
        """
        Analyze click for fraud indicators
        Returns: fraud_score, fraud_status, indicators
        """
        fraud_indicators = {
            'duplicate_click': False,
            'fast_click': False,
            'bot_like': False,
            'vpn_detected': click_data.get('vpn_detected', False),
            'proxy_detected': click_data.get('proxy_detected', False),
            'tor_detected': click_data.get('tor_detected', False),
            'hosting_detected': click_data.get('hosting_detected', False),
        }
        
        fraud_score = 0
        
        # Check for duplicate clicks (same user, offer, placement within 5 minutes)
        try:
            recent_clicks = list(self.clicks_col.find({
                'user_id': click_data.get('user_id'),
                'offer_id': click_data.get('offer_id'),
                'placement_id': click_data.get('placement_id'),
                'timestamp': {
                    '$gte': __import__('datetime').datetime.utcnow() - __import__('datetime').timedelta(minutes=5)
                }
            }).limit(1))
            
            if recent_clicks:
                fraud_indicators['duplicate_click'] = True
                fraud_score += 30
        except Exception as e:
            logger.warning(f"Error checking duplicate clicks: {e}")
        
        # Check for fast clicks (time_to_click < 500ms is suspicious)
        # Note: Normal users click within 500ms-5000ms range
        # Less than 500ms might indicate bot/automation
        time_to_click = click_data.get('time_to_click', 0)
        if time_to_click and time_to_click < 500:
            fraud_indicators['fast_click'] = True
            fraud_score += 20
        
        # Check for bot-like behavior
        user_agent = click_data.get('user_agent', '').lower()
        bot_keywords = ['bot', 'crawler', 'spider', 'scraper', 'curl', 'wget', 'python', 'java']
        if any(keyword in user_agent for keyword in bot_keywords):
            fraud_indicators['bot_like'] = True
            fraud_score += 25
        
        # VPN/Proxy/Tor detection
        if fraud_indicators['vpn_detected']:
            fraud_score += 15
        if fraud_indicators['proxy_detected']:
            fraud_score += 15
        if fraud_indicators['tor_detected']:
            fraud_score += 25
        if fraud_indicators['hosting_detected']:
            fraud_score += 10
        
        # Determine fraud status
        if fraud_score >= 50:
            fraud_status = 'High Risk'
        elif fraud_score >= 30:
            fraud_status = 'Medium Risk'
        elif fraud_score >= 15:
            fraud_status = 'Low Risk'
        else:
            fraud_status = 'Clean'
        
        # Only flag as fraud if score >= 15 (Low Risk or higher)
        is_fraud = fraud_score >= 15
        
        return {
            'fraud_score': fraud_score,
            'fraud_status': fraud_status,
            'is_fraud': is_fraud,
            'indicators': fraud_indicators,
        }
