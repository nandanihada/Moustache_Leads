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
    
    Examples:
        Papa_Survey_Router_ Incent UK/DE/AU/US → Papa Survey Router - Incent UK/DE/AU/US
        iSurveyWorld_DOI_non Incent US → iSurveyWorld DOI - Non Incent US
    
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
    
    # Replace space before Incent/Non with dash
    name = re.sub(r'\s+(Incent|Non Incent|non incent)', r' - \1', name, flags=re.IGNORECASE)
    
    # Capitalize "non incent" properly
    name = re.sub(r'non incent', 'Non Incent', name, flags=re.IGNORECASE)
    
    # Clean up
    name = name.strip()
    
    return name
