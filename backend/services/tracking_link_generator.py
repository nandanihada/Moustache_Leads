"""
Tracking Link Generator Service

Generates proper tracking links for networks that don't provide them in their API/data.
Currently supports: CPA Merchant, ChameleonAds, LeadAds

Also handles automatic offer URL parameter injection based on Upward Partner network_domain config.
"""

from typing import Optional, Dict, List
import logging
from urllib.parse import urlparse, urlencode, parse_qs, urlunparse

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


def get_partner_by_domain(offer_url: str) -> Optional[Dict]:
    """
    Look up an Upward Partner by matching the offer URL domain against network_domain.

    Args:
        offer_url: The raw offer URL (e.g. https://www.adtogametrkk.com/...)

    Returns:
        Partner document dict if found, else None
    """
    if not offer_url:
        return None

    try:
        from database import db_instance
        parsed = urlparse(offer_url)
        # Strip www. prefix for matching
        hostname = parsed.hostname or ''
        hostname = hostname.lstrip('www.')

        if not hostname:
            return None

        partners_collection = db_instance.get_collection('partners')
        # Match if stored network_domain is contained in the hostname or vice versa
        partners = list(partners_collection.find({
            'status': 'active',
            'network_domain': {'$ne': ''},
            'offer_url_params': {'$exists': True, '$ne': []}
        }))

        for partner in partners:
            domain = partner.get('network_domain', '').lstrip('www.')
            if domain and (domain in hostname or hostname in domain):
                return partner

        return None
    except Exception as e:
        logger.error(f"Error looking up partner by domain: {str(e)}")
        return None


def inject_offer_url_params(offer_url: str, offer_url_params: List[Dict]) -> str:
    """
    Append network-specific parameters to an offer URL.

    offer_url_params is a list of dicts: [{"our_field": "user_id", "their_param": "sub1"}, ...]
    Each entry appends ?their_param={our_field} to the URL.

    Args:
        offer_url: Raw offer URL
        offer_url_params: List of param mapping dicts from the partner config

    Returns:
        URL with params appended (e.g. https://...?sub1={user_id}&payout={payout})
    """
    if not offer_url or not offer_url_params:
        return offer_url

    try:
        parsed = urlparse(offer_url)
        existing_params = parse_qs(parsed.query, keep_blank_values=True)

        new_params = {}
        for mapping in offer_url_params:
            their_param = mapping.get('their_param', '').strip()
            our_field = mapping.get('our_field', '').strip()
            if their_param and our_field:
                # Only add if not already present in the URL
                if their_param not in existing_params:
                    new_params[their_param] = f'{{{our_field}}}'

        if not new_params:
            return offer_url

        # Build new query string preserving existing params
        all_params = {}
        for k, v in existing_params.items():
            all_params[k] = v[0] if len(v) == 1 else v
        all_params.update(new_params)

        new_query = urlencode(all_params)
        new_parsed = parsed._replace(query=new_query)
        result = urlunparse(new_parsed)
        logger.info(f"Injected offer URL params: {list(new_params.keys())} → {result}")
        return result
    except Exception as e:
        logger.error(f"Error injecting offer URL params: {str(e)}")
        return offer_url


def apply_network_offer_params(offer_data: dict) -> dict:
    """
    Auto-detect the Upward Partner for an offer based on its target_url domain,
    then inject the configured offer_url_params into the target_url.

    This is called during bulk import, API import, and manual offer creation.

    Args:
        offer_data: Offer dict with at least 'target_url'

    Returns:
        Updated offer_data with modified target_url if a matching partner was found
    """
    target_url = offer_data.get('target_url', '')
    if not target_url:
        return offer_data

    partner = get_partner_by_domain(target_url)
    if not partner:
        return offer_data

    offer_url_params = partner.get('offer_url_params', [])
    if not offer_url_params:
        return offer_data

    updated_url = inject_offer_url_params(target_url, offer_url_params)
    if updated_url != target_url:
        offer_data['target_url'] = updated_url
        offer_data['_upward_partner_id'] = partner.get('partner_id', '')
        offer_data['_upward_partner_name'] = partner.get('partner_name', '')
        logger.info(
            f"Auto-applied network params for partner '{partner.get('partner_name')}' "
            f"to offer URL: {updated_url}"
        )

    return offer_data
