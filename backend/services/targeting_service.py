import re
from user_agents import parse
from datetime import datetime
import logging

class TargetingService:
    """Service to handle offer targeting validation"""
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
    
    def validate_targeting(self, offer, request_data):
        """
        Validate if request matches offer targeting criteria
        
        Args:
            offer: Offer document from database
            request_data: Dict containing user agent, IP, etc.
        
        Returns:
            tuple: (is_valid, reason)
        """
        try:
            # Extract request information
            user_agent = request_data.get('user_agent', '')
            ip_address = request_data.get('ip_address', '')
            country = request_data.get('country', '')
            carrier = request_data.get('carrier', '')
            
            # Parse user agent
            ua = parse(user_agent) if user_agent else None
            
            # 1. Country Targeting
            if not self._validate_country(offer, country):
                return False, f"Country '{country}' not allowed"
            
            # 2. Device Targeting
            if not self._validate_device(offer, ua):
                device_type = self._get_device_type(ua)
                return False, f"Device type '{device_type}' not allowed"
            
            # 3. OS Targeting
            if not self._validate_os(offer, ua):
                os_name = ua.os.family if ua else 'Unknown'
                return False, f"Operating system '{os_name}' not allowed"
            
            # 4. Browser Targeting
            if not self._validate_browser(offer, ua):
                browser_name = ua.browser.family if ua else 'Unknown'
                return False, f"Browser '{browser_name}' not allowed"
            
            # 5. Carrier Targeting
            if not self._validate_carrier(offer, carrier):
                return False, f"Carrier '{carrier}' not allowed"
            
            # 6. Language Targeting (from Accept-Language header)
            languages = request_data.get('languages', [])
            if not self._validate_languages(offer, languages):
                return False, f"Languages {languages} not allowed"
            
            # 7. Connection Type (if available)
            connection_type = request_data.get('connection_type', 'unknown')
            if not self._validate_connection_type(offer, connection_type):
                return False, f"Connection type '{connection_type}' not allowed"
            
            return True, "All targeting criteria met"
            
        except Exception as e:
            self.logger.error(f"Error validating targeting: {str(e)}")
            return False, f"Targeting validation error: {str(e)}"
    
    def _validate_country(self, offer, country):
        """Validate country targeting"""
        allowed_countries = offer.get('countries', [])
        if not allowed_countries:
            return True  # No country restriction
        
        return country.upper() in [c.upper() for c in allowed_countries]
    
    def _validate_device(self, offer, ua):
        """Validate device targeting"""
        device_targeting = offer.get('device_targeting', 'all')
        
        if device_targeting == 'all':
            return True
        
        if not ua:
            return device_targeting == 'all'
        
        device_type = self._get_device_type(ua)
        
        return device_targeting == device_type
    
    def _get_device_type(self, ua):
        """Get device type from user agent"""
        if not ua:
            return 'unknown'
        
        if ua.is_mobile:
            return 'mobile'
        elif ua.is_tablet:
            return 'tablet'
        elif ua.is_pc:
            return 'desktop'
        else:
            return 'unknown'
    
    def _validate_os(self, offer, ua):
        """Validate OS targeting"""
        os_targeting = offer.get('os_targeting', [])
        if not os_targeting:
            return True  # No OS restriction
        
        if not ua:
            return False
        
        os_name = ua.os.family
        
        # Map common OS names
        os_mapping = {
            'iOS': ['iOS'],
            'Android': ['Android'],
            'Windows': ['Windows'],
            'Mac OS X': ['Mac', 'macOS'],
            'Linux': ['Linux']
        }
        
        for target_os in os_targeting:
            for mapped_os, variants in os_mapping.items():
                if target_os in variants and os_name == mapped_os:
                    return True
            # Direct match
            if target_os.lower() in os_name.lower():
                return True
        
        return False
    
    def _validate_browser(self, offer, ua):
        """Validate browser targeting"""
        browser_targeting = offer.get('browser_targeting', [])
        if not browser_targeting:
            return True  # No browser restriction
        
        if not ua:
            return False
        
        browser_name = ua.browser.family
        
        # Map common browser names
        browser_mapping = {
            'Chrome': ['Chrome', 'Chromium'],
            'Safari': ['Safari', 'Mobile Safari'],
            'Firefox': ['Firefox'],
            'Edge': ['Edge', 'Microsoft Edge'],
            'Opera': ['Opera', 'Opera Mini']
        }
        
        for target_browser in browser_targeting:
            for mapped_browser, variants in browser_mapping.items():
                if target_browser in variants and browser_name in variants:
                    return True
            # Direct match
            if target_browser.lower() in browser_name.lower():
                return True
        
        return False
    
    def _validate_carrier(self, offer, carrier):
        """Validate carrier targeting"""
        carrier_targeting = offer.get('carrier_targeting', [])
        if not carrier_targeting:
            return True  # No carrier restriction
        
        if not carrier:
            return True  # Unknown carrier allowed if no restriction
        
        return carrier in carrier_targeting
    
    def _validate_languages(self, offer, languages):
        """Validate language targeting"""
        language_targeting = offer.get('languages', [])
        if not language_targeting:
            return True  # No language restriction
        
        if not languages:
            return True  # Unknown language allowed if no restriction
        
        # Check if any of the user's languages match targeting
        for user_lang in languages:
            lang_code = user_lang.split('-')[0].lower()  # Extract main language code
            if lang_code in [l.lower() for l in language_targeting]:
                return True
        
        return False
    
    def _validate_connection_type(self, offer, connection_type):
        """Validate connection type targeting"""
        connection_targeting = offer.get('connection_type', 'all')
        
        if connection_targeting == 'all':
            return True
        
        return connection_targeting == connection_type
    
    def extract_request_info(self, request):
        """
        Extract targeting information from Flask request
        
        Args:
            request: Flask request object
        
        Returns:
            dict: Extracted request information
        """
        try:
            # Get user agent
            user_agent = request.headers.get('User-Agent', '')
            
            # Get IP address (considering proxies)
            ip_address = request.headers.get('X-Forwarded-For', request.remote_addr)
            if ip_address and ',' in ip_address:
                ip_address = ip_address.split(',')[0].strip()
            
            # Get country (you might want to use a GeoIP service)
            country = request.headers.get('CF-IPCountry', '')  # Cloudflare header
            if not country:
                country = self._get_country_from_ip(ip_address)
            
            # Get languages from Accept-Language header
            languages = []
            accept_language = request.headers.get('Accept-Language', '')
            if accept_language:
                # Parse Accept-Language header
                lang_parts = accept_language.split(',')
                for part in lang_parts:
                    lang = part.split(';')[0].strip()
                    if lang:
                        languages.append(lang)
            
            # Get carrier (would need external service)
            carrier = request.headers.get('X-Carrier', '')
            
            # Get connection type (would need external detection)
            connection_type = 'unknown'
            
            return {
                'user_agent': user_agent,
                'ip_address': ip_address,
                'country': country,
                'carrier': carrier,
                'languages': languages,
                'connection_type': connection_type,
                'timestamp': datetime.utcnow()
            }
            
        except Exception as e:
            self.logger.error(f"Error extracting request info: {str(e)}")
            return {
                'user_agent': '',
                'ip_address': '',
                'country': '',
                'carrier': '',
                'languages': [],
                'connection_type': 'unknown',
                'timestamp': datetime.utcnow()
            }
    
    def _get_country_from_ip(self, ip_address):
        """
        Get country from IP address using GeoIP
        This is a placeholder - you should integrate with a real GeoIP service
        """
        # Placeholder implementation
        # In production, use services like:
        # - MaxMind GeoIP2
        # - ipapi.co
        # - ip-api.com
        
        if not ip_address or ip_address in ['127.0.0.1', 'localhost']:
            return 'US'  # Default for localhost
        
        # For now, return empty - implement actual GeoIP lookup
        return ''
