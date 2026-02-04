"""
Traffic Source Rules Service

Rule-based traffic source auto-generation for offers.
Uses deterministic mappings based on offer category (vertical).

Business Rules:
- Traffic sources must never be empty
- Each offer belongs to ONE predefined offer category (vertical)
- Each category has default traffic source rules
- Advertisers can override defaults manually
- Overrides take precedence over defaults
"""

from typing import Dict, List, Optional, Tuple
from datetime import datetime


# ==================== TRAFFIC SOURCE DEFINITIONS ====================

# All available traffic sources in the system
ALL_TRAFFIC_SOURCES = [
    'Email',
    'Search',
    'Display',
    'Push',
    'Native',
    'Social',
    'Video',
    'Mobile',
    'Desktop',
    'Contextual',
    'Affiliate',
    'Influencer',
    'SMS',
    'Pop',
    'Redirect',
    'Toolbar',
    'Adult',
    'Incentivized',
    'Brand Bidding',
    'Spam',
    'Fraud'
]

# Traffic sources that are ALWAYS disallowed (compliance)
ALWAYS_DISALLOWED = ['Fraud', 'Spam']


# ==================== CATEGORY → TRAFFIC SOURCE MAPPINGS ====================

# Static lookup table: category → traffic source rules
# Each category defines:
#   - allowed: Safe traffic sources for this category
#   - risky: Traffic sources that need caution/monitoring
#   - disallowed: Traffic sources not permitted for this category

CATEGORY_TRAFFIC_RULES: Dict[str, Dict[str, List[str]]] = {
    'HEALTH': {
        'allowed': ['Search', 'Display', 'Native', 'Contextual', 'Email'],
        'risky': ['Social', 'Video', 'Affiliate', 'Mobile'],
        'disallowed': ['Adult', 'Incentivized', 'Pop', 'Redirect', 'Push', 'SMS', 'Brand Bidding']
    },
    'SURVEY': {
        'allowed': ['Email', 'Display', 'Social', 'Native', 'Mobile', 'Desktop', 'Push'],
        'risky': ['Affiliate', 'Video', 'Contextual', 'Influencer'],
        'disallowed': ['Adult', 'Pop', 'Redirect', 'Toolbar', 'Brand Bidding']
    },
    'EDUCATION': {
        'allowed': ['Search', 'Display', 'Email', 'Native', 'Contextual', 'Social', 'Desktop'],
        'risky': ['Video', 'Affiliate', 'Mobile', 'Influencer'],
        'disallowed': ['Adult', 'Incentivized', 'Pop', 'Redirect', 'Push', 'SMS', 'Brand Bidding']
    },
    'INSURANCE': {
        'allowed': ['Search', 'Display', 'Native', 'Contextual', 'Email', 'Desktop'],
        'risky': ['Social', 'Affiliate', 'Mobile', 'Push'],
        'disallowed': ['Adult', 'Incentivized', 'Pop', 'Redirect', 'Toolbar', 'SMS', 'Brand Bidding', 'Video']
    },
    'LOAN': {
        'allowed': ['Search', 'Display', 'Native', 'Contextual', 'Desktop'],
        'risky': ['Email', 'Social', 'Affiliate', 'Mobile'],
        'disallowed': ['Adult', 'Incentivized', 'Pop', 'Redirect', 'Toolbar', 'SMS', 'Brand Bidding', 'Push', 'Video']
    },
    'FINANCE': {
        'allowed': ['Search', 'Display', 'Native', 'Contextual', 'Email', 'Desktop'],
        'risky': ['Social', 'Affiliate', 'Mobile', 'Push'],
        'disallowed': ['Adult', 'Incentivized', 'Pop', 'Redirect', 'Toolbar', 'SMS', 'Brand Bidding']
    },
    'DATING': {
        'allowed': ['Display', 'Social', 'Native', 'Mobile', 'Push', 'Video'],
        'risky': ['Email', 'Affiliate', 'Influencer', 'Contextual'],
        'disallowed': ['Incentivized', 'Pop', 'Redirect', 'Toolbar', 'Brand Bidding', 'SMS']
    },
    'FREE_TRIAL': {
        'allowed': ['Email', 'Search', 'Display', 'Social', 'Native', 'Mobile', 'Desktop'],
        'risky': ['Push', 'Video', 'Affiliate', 'Influencer'],
        'disallowed': ['Adult', 'Pop', 'Redirect', 'Toolbar', 'Brand Bidding', 'SMS']
    },
    'INSTALLS': {
        'allowed': ['Display', 'Social', 'Mobile', 'Push', 'Native', 'Video', 'Influencer'],
        'risky': ['Email', 'Affiliate', 'Contextual', 'Search'],
        'disallowed': ['Adult', 'Pop', 'Redirect', 'Toolbar', 'Brand Bidding']
    },
    'GAMES_INSTALL': {
        'allowed': ['Display', 'Social', 'Video', 'Mobile', 'Influencer', 'Push', 'Native', 'Incentivized'],
        'risky': ['Email', 'Affiliate', 'Pop', 'Contextual'],
        'disallowed': ['Adult', 'Brand Bidding', 'Toolbar', 'Redirect']
    },
    'OTHER': {
        'allowed': ['Email', 'Search', 'Display', 'Native', 'Contextual', 'Social'],
        'risky': ['Video', 'Affiliate', 'Mobile', 'Push', 'Influencer'],
        'disallowed': ['Adult', 'Incentivized', 'Pop', 'Redirect', 'Toolbar', 'Brand Bidding']
    }
}

# Default rules for unknown categories (fallback)
DEFAULT_TRAFFIC_RULES = {
    'allowed': ['Email', 'Search', 'Display', 'Native', 'Contextual'],
    'risky': ['Social', 'Video', 'Affiliate', 'Mobile', 'Push'],
    'disallowed': ['Adult', 'Incentivized', 'Pop', 'Redirect', 'Toolbar', 'Brand Bidding']
}


# ==================== COUNTRY-SPECIFIC ADJUSTMENTS ====================

# Optional country-specific rule adjustments
# Only applied if country is provided and has specific rules
COUNTRY_ADJUSTMENTS: Dict[str, Dict[str, List[str]]] = {
    'DE': {  # Germany - stricter email rules
        'move_to_risky': ['Email'],
        'move_to_disallowed': []
    },
    'FR': {  # France - stricter cookie/tracking rules
        'move_to_risky': ['Push', 'Pop'],
        'move_to_disallowed': []
    },
    'US': {  # USA - standard rules, no adjustments
        'move_to_risky': [],
        'move_to_disallowed': []
    }
}


class TrafficSourceRulesService:
    """
    Service for managing traffic source rules based on offer category.
    
    Provides deterministic, rule-based traffic source generation.
    No ML, heuristics, or pattern matching - pure static lookups.
    """
    
    @staticmethod
    def get_available_categories() -> List[str]:
        """Get list of all valid offer categories (verticals)."""
        return list(CATEGORY_TRAFFIC_RULES.keys())
    
    @staticmethod
    def get_all_traffic_sources() -> List[str]:
        """Get list of all available traffic sources."""
        return ALL_TRAFFIC_SOURCES.copy()
    
    @staticmethod
    def get_default_rules_for_category(category: str) -> Dict[str, List[str]]:
        """
        Get default traffic source rules for a category.
        
        Args:
            category: Offer category (e.g., 'HEALTH', 'SURVEY', 'LOAN')
            
        Returns:
            Dict with 'allowed', 'risky', 'disallowed' lists
        """
        # Normalize category name to uppercase
        normalized = category.strip().upper() if category else 'OTHER'
        
        # Get rules from lookup table
        rules = CATEGORY_TRAFFIC_RULES.get(normalized, DEFAULT_TRAFFIC_RULES)
        
        # Return a copy to prevent mutation
        return {
            'allowed': rules['allowed'].copy(),
            'risky': rules['risky'].copy(),
            'disallowed': rules['disallowed'].copy() + ALWAYS_DISALLOWED
        }
    
    @staticmethod
    def apply_country_adjustments(
        rules: Dict[str, List[str]], 
        country: Optional[str]
    ) -> Dict[str, List[str]]:
        """
        Apply country-specific adjustments to traffic rules.
        
        Args:
            rules: Base traffic rules dict
            country: ISO country code (e.g., 'US', 'DE')
            
        Returns:
            Adjusted rules dict
        """
        if not country:
            return rules
        
        country_upper = country.upper().strip()
        adjustments = COUNTRY_ADJUSTMENTS.get(country_upper)
        
        if not adjustments:
            return rules
        
        # Create copies to avoid mutation
        result = {
            'allowed': rules['allowed'].copy(),
            'risky': rules['risky'].copy(),
            'disallowed': rules['disallowed'].copy()
        }
        
        # Move sources to risky
        for source in adjustments.get('move_to_risky', []):
            if source in result['allowed']:
                result['allowed'].remove(source)
                if source not in result['risky']:
                    result['risky'].append(source)
        
        # Move sources to disallowed
        for source in adjustments.get('move_to_disallowed', []):
            if source in result['allowed']:
                result['allowed'].remove(source)
            if source in result['risky']:
                result['risky'].remove(source)
            if source not in result['disallowed']:
                result['disallowed'].append(source)
        
        return result
    
    @staticmethod
    def generate_traffic_sources(
        category: str,
        country: Optional[str] = None,
        overrides: Optional[Dict[str, List[str]]] = None
    ) -> Dict[str, List[str]]:
        """
        Generate traffic source rules for an offer.
        
        This is the main entry point for traffic source generation.
        
        Args:
            category: Offer category/vertical (required)
            country: ISO country code (optional)
            overrides: Manual overrides from advertiser (optional)
                       Format: {'allowed': [...], 'risky': [...], 'disallowed': [...]}
        
        Returns:
            Dict with 'allowed', 'risky', 'disallowed' lists
            
        Rules:
            1. Start with category defaults
            2. Apply country adjustments if provided
            3. Apply manual overrides if provided (overrides take precedence)
            4. Ensure no empty states - always have at least defaults
        """
        # Step 1: Get category defaults
        rules = TrafficSourceRulesService.get_default_rules_for_category(category)
        
        # Step 2: Apply country adjustments
        if country:
            rules = TrafficSourceRulesService.apply_country_adjustments(rules, country)
        
        # Step 3: Apply manual overrides (if provided)
        if overrides:
            rules = TrafficSourceRulesService.apply_overrides(rules, overrides)
        
        # Step 4: Ensure no empty states
        rules = TrafficSourceRulesService.ensure_no_empty_states(rules, category)
        
        # Step 5: Remove duplicates and ensure ALWAYS_DISALLOWED are in disallowed
        rules = TrafficSourceRulesService.cleanup_rules(rules)
        
        return rules
    
    @staticmethod
    def apply_overrides(
        rules: Dict[str, List[str]], 
        overrides: Dict[str, List[str]]
    ) -> Dict[str, List[str]]:
        """
        Apply manual overrides to traffic rules.
        
        Overrides completely replace the corresponding list if provided.
        
        Args:
            rules: Base traffic rules
            overrides: Override rules from advertiser
            
        Returns:
            Rules with overrides applied
        """
        result = {
            'allowed': rules['allowed'].copy(),
            'risky': rules['risky'].copy(),
            'disallowed': rules['disallowed'].copy()
        }
        
        # Apply overrides - only if the override list is provided and non-empty
        if overrides.get('allowed') is not None:
            result['allowed'] = overrides['allowed'].copy()
        
        if overrides.get('risky') is not None:
            result['risky'] = overrides['risky'].copy()
        
        if overrides.get('disallowed') is not None:
            result['disallowed'] = overrides['disallowed'].copy()
        
        return result
    
    @staticmethod
    def ensure_no_empty_states(
        rules: Dict[str, List[str]], 
        category: str
    ) -> Dict[str, List[str]]:
        """
        Ensure no traffic source list is empty.
        
        If a list is empty, fall back to category defaults.
        
        Args:
            rules: Traffic rules to check
            category: Category for fallback defaults
            
        Returns:
            Rules with no empty lists
        """
        defaults = TrafficSourceRulesService.get_default_rules_for_category(category)
        
        result = {
            'allowed': rules['allowed'] if rules['allowed'] else defaults['allowed'],
            'risky': rules['risky'] if rules['risky'] else defaults['risky'],
            'disallowed': rules['disallowed'] if rules['disallowed'] else defaults['disallowed']
        }
        
        return result
    
    @staticmethod
    def cleanup_rules(rules: Dict[str, List[str]]) -> Dict[str, List[str]]:
        """
        Clean up rules: remove duplicates, ensure compliance.
        
        Args:
            rules: Traffic rules to clean
            
        Returns:
            Cleaned rules
        """
        # Remove duplicates while preserving order
        allowed = list(dict.fromkeys(rules['allowed']))
        risky = list(dict.fromkeys(rules['risky']))
        disallowed = list(dict.fromkeys(rules['disallowed']))
        
        # Ensure ALWAYS_DISALLOWED are in disallowed
        for source in ALWAYS_DISALLOWED:
            if source not in disallowed:
                disallowed.append(source)
            # Remove from allowed/risky if present
            if source in allowed:
                allowed.remove(source)
            if source in risky:
                risky.remove(source)
        
        # Ensure no source appears in multiple lists (priority: disallowed > risky > allowed)
        for source in disallowed:
            if source in risky:
                risky.remove(source)
            if source in allowed:
                allowed.remove(source)
        
        for source in risky:
            if source in allowed:
                allowed.remove(source)
        
        return {
            'allowed': allowed,
            'risky': risky,
            'disallowed': disallowed
        }
    
    @staticmethod
    def validate_traffic_sources(
        allowed: List[str],
        risky: List[str],
        disallowed: List[str]
    ) -> Tuple[bool, Optional[str]]:
        """
        Validate traffic source lists.
        
        Args:
            allowed: List of allowed sources
            risky: List of risky sources
            disallowed: List of disallowed sources
            
        Returns:
            Tuple of (is_valid, error_message)
        """
        all_sources = set(ALL_TRAFFIC_SOURCES)
        
        # Check for invalid sources
        for source in allowed + risky + disallowed:
            if source not in all_sources:
                return False, f"Invalid traffic source: '{source}'"
        
        # Check for duplicates across lists
        all_provided = allowed + risky + disallowed
        if len(all_provided) != len(set(all_provided)):
            return False, "Duplicate traffic sources found across lists"
        
        # Check that ALWAYS_DISALLOWED are in disallowed
        for source in ALWAYS_DISALLOWED:
            if source in allowed or source in risky:
                return False, f"'{source}' must be in disallowed list"
        
        return True, None
    
    @staticmethod
    def has_overrides(offer_data: dict) -> bool:
        """
        Check if offer has manual traffic source overrides.
        
        Args:
            offer_data: Offer document
            
        Returns:
            True if overrides exist
        """
        overrides = offer_data.get('traffic_source_overrides', {})
        return bool(
            overrides.get('allowed') or 
            overrides.get('risky') or 
            overrides.get('disallowed')
        )
    
    @staticmethod
    def get_traffic_sources_for_offer(offer_data: dict) -> Dict[str, List[str]]:
        """
        Get traffic sources for an existing offer.
        
        Checks for overrides first, then falls back to category defaults.
        
        Args:
            offer_data: Offer document from database
            
        Returns:
            Traffic source rules dict
        """
        category = offer_data.get('vertical') or offer_data.get('category', 'Lifestyle')
        country = None
        
        # Get primary country if available
        countries = offer_data.get('allowed_countries', []) or offer_data.get('countries', [])
        if countries and len(countries) == 1:
            country = countries[0]
        
        # Check for manual overrides
        overrides = offer_data.get('traffic_source_overrides')
        
        return TrafficSourceRulesService.generate_traffic_sources(
            category=category,
            country=country,
            overrides=overrides
        )


# ==================== HELPER FUNCTIONS ====================

def get_traffic_sources_for_category(category: str) -> Dict[str, List[str]]:
    """
    Convenience function to get traffic sources for a category.
    
    Args:
        category: Offer category/vertical
        
    Returns:
        Traffic source rules dict
    """
    return TrafficSourceRulesService.generate_traffic_sources(category)


def get_all_categories() -> List[str]:
    """Get all valid offer categories."""
    return TrafficSourceRulesService.get_available_categories()


def get_all_sources() -> List[str]:
    """Get all available traffic sources."""
    return TrafficSourceRulesService.get_all_traffic_sources()
