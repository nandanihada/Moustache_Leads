"""
Macro Replacement Service
Handles dynamic parameter replacement in offer URLs for partner tracking
"""

import logging
import time
from urllib.parse import quote
from datetime import datetime

logger = logging.getLogger(__name__)


class MacroReplacementService:
    """Service to replace macros in URLs with actual values"""
    
    # Supported macros
    SUPPORTED_MACROS = {
        'user_id': 'MongoDB user ID',
        'username': 'User username',
        'user_email': 'User email address',
        'click_id': 'Unique click identifier',
        'session_id': 'Offerwall session ID',
        'placement_id': 'Offerwall placement ID',
        'publisher_id': 'Publisher ID',
        'timestamp': 'Current Unix timestamp',
        'country': 'User country code',
        'device_type': 'Device type (mobile/desktop/tablet)',
        'ip_address': 'User IP address',
        'offer_id': 'Offer ID',
    }
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
    
    def replace_macros(self, url: str, context: dict) -> str:
        """
        Replace all macros in URL with actual values from context
        
        Args:
            url: URL template with macros (e.g., "https://partner.com?uid={user_id}")
            context: Dictionary with values for macro replacement
                {
                    'user_id': '507f1f77bcf86cd799439011',
                    'username': 'john123',
                    'click_id': 'CLK-ABC123',
                    'session_id': 'sess-xyz789',
                    'placement_id': 'wall-001',
                    'publisher_id': 'pub-123',
                    'country': 'US',
                    'device_type': 'mobile',
                    'ip_address': '192.168.1.1',
                    'offer_id': 'OFFER-123',
                    'user_email': 'user@example.com'
                }
        
        Returns:
            URL with all macros replaced
        """
        if not url:
            return url
        
        original_url = url
        replacements_made = {}
        
        # Build replacement map
        macro_values = {
            '{user_id}': str(context.get('user_id', '')),
            '{username}': str(context.get('username', '')),
            '{user_email}': str(context.get('user_email', '')),
            '{click_id}': str(context.get('click_id', '')),
            '{session_id}': str(context.get('session_id', '')),
            '{placement_id}': str(context.get('placement_id', '')),
            '{publisher_id}': str(context.get('publisher_id', '')),
            '{timestamp}': str(int(time.time())),
            '{country}': str(context.get('country', '')),
            '{device_type}': str(context.get('device_type', '')),
            '{ip_address}': str(context.get('ip_address', '')),
            '{offer_id}': str(context.get('offer_id', '')),
        }
        
        # Replace each macro
        for macro, value in macro_values.items():
            if macro in url:
                # URL-encode the value to prevent injection
                encoded_value = quote(value, safe='')
                url = url.replace(macro, encoded_value)
                replacements_made[macro] = value
        
        # Log replacements for debugging
        if replacements_made:
            self.logger.info(f"🔄 Macro replacements in URL:")
            for macro, value in replacements_made.items():
                self.logger.info(f"   {macro} → {value}")
            self.logger.debug(f"   Original: {original_url}")
            self.logger.debug(f"   Final: {url}")
        
        # Check for unreplaced macros (potential typos)
        import re
        unreplaced = re.findall(r'\{([^}]+)\}', url)
        if unreplaced:
            self.logger.warning(f"⚠️ Unreplaced macros found in URL: {unreplaced}")
            self.logger.warning(f"   URL: {url}")
        
        return url
    
    def has_macros(self, url: str) -> bool:
        """
        Check if URL contains any macros
        
        Args:
            url: URL to check
        
        Returns:
            True if URL contains macros, False otherwise
        """
        if not url:
            return False
        
        import re
        return bool(re.search(r'\{[^}]+\}', url))
    
    def extract_macros(self, url: str) -> list:
        """
        Extract all macros from URL
        
        Args:
            url: URL to extract macros from
        
        Returns:
            List of macro names (without braces)
        """
        if not url:
            return []
        
        import re
        macros = re.findall(r'\{([^}]+)\}', url)
        return macros
    
    def validate_macros(self, url: str) -> tuple:
        """
        Validate that all macros in URL are supported
        
        Args:
            url: URL to validate
        
        Returns:
            Tuple of (is_valid, unsupported_macros)
        """
        if not url:
            return True, []
        
        macros = self.extract_macros(url)
        unsupported = [m for m in macros if m not in self.SUPPORTED_MACROS]
        
        return len(unsupported) == 0, unsupported
    
    def get_supported_macros(self) -> dict:
        """
        Get list of supported macros with descriptions
        
        Returns:
            Dictionary of macro names and descriptions
        """
        return self.SUPPORTED_MACROS.copy()


# Global instance
macro_service = MacroReplacementService()
