"""
HTML Cleaner Utility
Cleans HTML from descriptions and formats beautifully
"""

import re
from html import unescape


def clean_html_description(html_text):
    """
    Clean HTML from description and format beautifully
    
    - Remove HTML tags
    - Convert <br> to newlines
    - Unescape HTML entities
    - Remove extra whitespace
    - Preserve paragraph breaks
    
    Args:
        html_text: HTML text to clean
        
    Returns:
        Clean, formatted text
    """
    if not html_text:
        return ''
    
    # Convert <br> and <p> to newlines
    text = re.sub(r'<br\s*/?>', '\n', html_text, flags=re.IGNORECASE)
    text = re.sub(r'</p>', '\n\n', text, flags=re.IGNORECASE)
    text = re.sub(r'<p[^>]*>', '', text, flags=re.IGNORECASE)
    
    # Remove all HTML tags
    text = re.sub(r'<[^>]+>', '', text)
    
    # Unescape HTML entities (&nbsp; → space, &amp; → &)
    text = unescape(text)
    
    # Replace &nbsp; with regular space (in case unescape didn't catch all)
    text = text.replace('\xa0', ' ')
    
    # Remove extra whitespace
    text = re.sub(r'\n\s*\n\s*\n+', '\n\n', text)  # Max 2 newlines
    text = re.sub(r' +', ' ', text)  # Multiple spaces to single
    text = text.strip()
    
    return text


def format_offer_name(name):
    """
    Format offer name for better readability
    
    - Replace underscores with spaces
    - Replace multiple spaces with single space
    - Format "Incent" properly
    - Remove country codes from name (US, CA, UK, etc.)
    - Remove common suffixes like CPL, CPA, CPI
    
    Examples:
        Papa_Survey_Router_ Incent UK/DE/AU/US → Papa Survey Router - Incent
        iSurveyWorld_DOI_non Incent US → iSurveyWorld DOI - Non Incent
        ezCater - Food Delivery CPL US CA - Incent Allowed → ezCater - Food Delivery - Incent Allowed
    
    Args:
        name: Offer name to format
        
    Returns:
        Formatted offer name
    """
    if not name:
        return ''
    
    # Replace underscores with spaces
    name = name.replace('_', ' ')
    
    # Remove extra spaces
    name = re.sub(r'\s+', ' ', name)
    
    # List of country codes to remove (2-letter ISO codes)
    country_codes = [
        'US', 'UK', 'GB', 'CA', 'AU', 'DE', 'FR', 'IT', 'ES', 'NL', 'BE', 'AT', 'CH',
        'SE', 'NO', 'DK', 'FI', 'PL', 'IE', 'PT', 'GR', 'CZ', 'HU', 'RO', 'BG', 'HR',
        'SK', 'SI', 'LT', 'LV', 'EE', 'JP', 'CN', 'KR', 'IN', 'SG', 'HK', 'TW', 'TH',
        'MY', 'ID', 'PH', 'VN', 'NZ', 'BR', 'MX', 'AR', 'CL', 'CO', 'PE', 'ZA', 'IL',
        'TR', 'AE', 'SA', 'EG', 'RU', 'UA'
    ]
    
    # Remove country codes that appear as standalone words (with word boundaries)
    # This handles formats like "US CA", "US/CA", "US, CA", etc.
    for code in country_codes:
        # Remove country code with various separators
        name = re.sub(rf'\b{code}\b[,/\s]*', '', name, flags=re.IGNORECASE)
    
    # Remove common payout type suffixes (CPL, CPA, CPI, CPS, CPM, CPC)
    name = re.sub(r'\b(CPL|CPA|CPI|CPS|CPM|CPC|DOI|SOI)\b[,/\s]*', '', name, flags=re.IGNORECASE)
    
    # Clean up multiple dashes and spaces
    name = re.sub(r'\s*-\s*-\s*', ' - ', name)  # Multiple dashes to single
    name = re.sub(r'\s+', ' ', name)  # Multiple spaces to single
    name = re.sub(r'\s*-\s*$', '', name)  # Remove trailing dash
    name = re.sub(r'^\s*-\s*', '', name)  # Remove leading dash
    
    # Replace space before Incent/Non with dash
    name = re.sub(r'\s+(Incent|Non Incent|non incent)', r' - \1', name, flags=re.IGNORECASE)
    
    # Capitalize "non incent" properly
    name = re.sub(r'non incent', 'Non Incent', name, flags=re.IGNORECASE)
    
    # Clean up
    name = name.strip()
    
    # Remove trailing dash if present
    name = re.sub(r'\s*-\s*$', '', name)
    
    return name
