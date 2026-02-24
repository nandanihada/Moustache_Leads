"""
Migration: Fix Tracking Links for Special Networks

This migration updates existing offers from networks that don't provide tracking links
(leadads, cpamerchant, chameleonads) to use properly generated tracking links instead
of their preview URLs.

Networks affected:
- LeadAds: https://leadads.go2jump.org/aff_c?offer_id={offer_id}&aff_id=10843
- CPA Merchant: https://tracking.cpamerchant.com/aff_c?offer_id={offer_id}&aff_id=3394
- ChameleonAds: https://chameleonads.go2cloud.org/aff_c?offer_id={offer_id}&aff_id=5696

Run this script: python migrations/fix_tracking_links_for_special_networks.py
"""

import sys
import os
from datetime import datetime

# Add parent directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from database import get_db
from services.tracking_link_generator import (
    generate_tracking_link,
    normalize_network_name,
    requires_generated_tracking_link
)
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def fix_tracking_links():
    """
    Update tracking links for offers from special networks
    """
    db = get_db()
    offers_collection = db['offers']
    
    # Networks that need tracking link generation
    target_networks = ['leadads', 'cpamerchant', 'chameleonads']
    
    # Also check for variations
    network_variations = [
        'leadads', 'lead_ads', 'lead ads',
        'cpamerchant', 'cpa_merchant', 'cpa merchant',
        'chameleonads', 'chameleon_ads', 'chameleon ads'
    ]
    
    logger.info("=" * 80)
    logger.info("FIXING TRACKING LINKS FOR SPECIAL NETWORKS")
    logger.info("=" * 80)
    
    # Find all offers from these networks
    query = {
        '$or': [
            {'network': {'$regex': network, '$options': 'i'}}
            for network in network_variations
        ]
    }
    
    offers = list(offers_collection.find(query))
    logger.info(f"\nFound {len(offers)} offers from special networks")
    
    if len(offers) == 0:
        logger.info("No offers found. Migration complete.")
        return
    
    # Group by network for reporting
    network_counts = {}
    updated_count = 0
    skipped_count = 0
    error_count = 0
    
    for offer in offers:
        try:
            network = offer.get('network', '')
            normalized_network = normalize_network_name(network)
            
            # Track counts
            if normalized_network not in network_counts:
                network_counts[normalized_network] = 0
            network_counts[normalized_network] += 1
            
            # Check if this network requires generated tracking links
            if not requires_generated_tracking_link(normalized_network):
                logger.debug(f"Skipping offer {offer.get('campaign_id')} - network {network} doesn't require generation")
                skipped_count += 1
                continue
            
            # Get offer ID
            offer_id = offer.get('campaign_id') or offer.get('external_offer_id')
            
            if not offer_id:
                logger.warning(f"Skipping offer {offer.get('_id')} - no campaign_id or external_offer_id found")
                skipped_count += 1
                continue
            
            # Generate new tracking link
            new_tracking_link = generate_tracking_link(normalized_network, str(offer_id))
            
            if not new_tracking_link:
                logger.warning(f"Failed to generate tracking link for offer {offer_id} from network {network}")
                error_count += 1
                continue
            
            # Get current target_url for comparison
            current_target_url = offer.get('target_url', '')
            
            # Only update if the tracking link is different
            if current_target_url == new_tracking_link:
                logger.debug(f"Offer {offer_id} already has correct tracking link")
                skipped_count += 1
                continue
            
            # Update the offer
            result = offers_collection.update_one(
                {'_id': offer['_id']},
                {
                    '$set': {
                        'target_url': new_tracking_link,
                        'updated_at': datetime.utcnow()
                    }
                }
            )
            
            if result.modified_count > 0:
                logger.info(f"✓ Updated offer {offer_id} ({offer.get('name', 'Unknown')})")
                logger.info(f"  Network: {network}")
                logger.info(f"  Old URL: {current_target_url[:80]}...")
                logger.info(f"  New URL: {new_tracking_link}")
                updated_count += 1
            else:
                logger.warning(f"Failed to update offer {offer_id}")
                error_count += 1
                
        except Exception as e:
            logger.error(f"Error processing offer {offer.get('_id')}: {str(e)}")
            error_count += 1
    
    # Print summary
    logger.info("\n" + "=" * 80)
    logger.info("MIGRATION SUMMARY")
    logger.info("=" * 80)
    logger.info(f"Total offers found: {len(offers)}")
    logger.info(f"Successfully updated: {updated_count}")
    logger.info(f"Skipped (already correct or not applicable): {skipped_count}")
    logger.info(f"Errors: {error_count}")
    logger.info("\nOffers by network:")
    for network, count in network_counts.items():
        logger.info(f"  {network}: {count}")
    logger.info("=" * 80)


if __name__ == '__main__':
    try:
        fix_tracking_links()
        logger.info("\n✓ Migration completed successfully!")
    except Exception as e:
        logger.error(f"\n✗ Migration failed: {str(e)}", exc_info=True)
        sys.exit(1)
