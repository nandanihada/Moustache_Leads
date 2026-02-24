"""
Tracking Link Generator Service

Generates proper tracking links for networks that don't provide them in their API/data.
Currently supports: CPA Merchant, ChameleonAds, LeadAds
"""

from typing import Optional, Dict
import logging

logger = logging.getLogger(__name__)

# Network tracking URL templates
# Maps network identifier to tracking URL template
NETWORK_TRACKING_TEMPLATES = {
    'leadads': {
        'template': 'https://leadads.go2jump.org/aff_c?offer_id={offer_id}&aff_id=10843',
        'name': 'LeadAds'
    },
    'cpamerchant': {
        'template': 'https://tracking.cpamerchant.com/aff_c?offer_id={offer_id}&aff_id=3394',
        'name': 'CPA Merchant'
    },
    'chameleonads': {
        'template': 'https://chameleonads.go2cloud.org/aff_c?offer_id={offer_id}&aff_id=5696',
        'name': 'ChameleonAds'
    }
}

# Network ID mapping for API imports
# Maps the networkId parameter to network identifier
NETWORK_ID_MAPPING = {
    'leadads': 'leadads',
    'cpamerchant': 'cpamerchant',
    'chameleonads': 'chameleonads',
    # Add variations if needed
    'lead_ads': 'leadads',
    'cpa_merchant': 'cpamerchant',
    'chameleon_ads': 'chameleonads',
}


def normalize_network_name(network_name: str) -> str:
    """
    Normalize network name to standard identifier
    
    Args:
        network_name: Network name from any source (API, sheet, etc.)
        
    Returns:
        Normalized network identifier or original name if not recognized
    """
    if not network_name:
        return ''
    
    # Convert to lowercase and remove spaces/underscores
    normalized = network_name.lower().strip().replace(' ', '').replace('_', '')
    
    # Check if it matches any known network
    if normalized in NETWORK_TRACKING_TEMPLATES:
        return normalized
    
    # Check network ID mapping
    if normalized in NETWORK_ID_MAPPING:
        return NETWORK_ID_MAPPING[normalized]
    
    return network_name


def requires_generated_tracking_link(network_name: str) -> bool:
    """
    Check if a network requires generated tracking links
    
    Args:
        network_name: Network name or identifier
        
    Returns:
        True if network requires generated tracking link, False otherwise
    """
    normalized = normalize_network_name(network_name)
    return normalized in NETWORK_TRACKING_TEMPLATES


def generate_tracking_link(network_name: str, offer_id: str) -> Optional[str]:
    """
    Generate tracking link for networks that don't provide them
    
    Args:
        network_name: Network name or identifier
        offer_id: Offer ID from the network
        
    Returns:
        Generated tracking link or None if network doesn't require generation
    """
    if not network_name or not offer_id:
        logger.warning(f"Missing network_name or offer_id: network={network_name}, offer_id={offer_id}")
        return None
    
    # Normalize network name
    normalized = normalize_network_name(network_name)
    
    # Check if this network requires generated tracking links
    if normalized not in NETWORK_TRACKING_TEMPLATES:
        return None
    
    # Get template and generate link
    template_data = NETWORK_TRACKING_TEMPLATES[normalized]
    template = template_data['template']
    
    try:
        tracking_link = template.format(offer_id=offer_id)
        logger.info(f"Generated tracking link for {template_data['name']}: offer_id={offer_id}")
        return tracking_link
    except Exception as e:
        logger.error(f"Error generating tracking link for {network_name}: {str(e)}")
        return None


def get_supported_networks() -> Dict[str, str]:
    """
    Get list of networks that support generated tracking links
    
    Returns:
        Dictionary mapping network identifier to display name
    """
    return {key: value['name'] for key, value in NETWORK_TRACKING_TEMPLATES.items()}


def process_offer_tracking_link(offer_data: dict, network_identifier: Optional[str] = None) -> dict:
    """
    Process offer data and generate tracking link if needed
    
    This function checks if the offer's network requires a generated tracking link
    and updates the target_url accordingly.
    
    Args:
        offer_data: Offer dictionary with network and offer_id fields
        network_identifier: Optional network identifier (for API imports where network field might not be set yet)
        
    Returns:
        Updated offer_data dictionary with generated tracking link if applicable
    """
    # Determine which network to check
    network = network_identifier or offer_data.get('network', '')
    
    if not network:
        return offer_data
    
    # Check if this network requires generated tracking links
    if not requires_generated_tracking_link(network):
        return offer_data
    
    # Get offer ID - try multiple fields
    offer_id = (
        offer_data.get('campaign_id') or 
        offer_data.get('external_offer_id') or 
        offer_data.get('offer_id')
    )
    
    if not offer_id:
        logger.warning(f"No offer_id found for network {network} in offer data")
        return offer_data
    
    # Generate tracking link
    tracking_link = generate_tracking_link(network, str(offer_id))
    
    if tracking_link:
        # Update target_url with generated tracking link
        offer_data['target_url'] = tracking_link
        logger.info(f"Updated target_url for offer {offer_id} from network {network}")
    
    return offer_data
