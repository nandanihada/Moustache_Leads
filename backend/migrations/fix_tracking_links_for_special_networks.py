"""
Migration: Inject Partner URL Params into Existing Offer Tracking Links

This migration takes existing offer target_urls and appends the partner's
configured offer_url_params. It does NOT regenerate the base tracking URL.

Networks affected: leadads, cpamerchant, chameleonads

Run: python migrations/fix_tracking_links_for_special_networks.py
"""

import sys
import os
from datetime import datetime

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from database import db_instance
from services.tracking_link_generator import (
    normalize_network_name,
    get_partner_by_name,
    get_partner_by_domain,
    inject_offer_url_params
)
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def fix_tracking_links():
    db = db_instance
    offers_collection = db.get_collection('offers')

    target_networks = ['leadads', 'cpamerchant', 'chameleonads']
    network_variations = []
    for n in target_networks:
        network_variations.extend([n, n.replace('ads', '_ads'), n.replace('merchant', '_merchant')])

    logger.info("=" * 80)
    logger.info("INJECTING PARTNER URL PARAMS INTO EXISTING OFFER TRACKING LINKS")
    logger.info("=" * 80)

    # Pre-load partner configs
    partner_cache = {}
    for network in target_networks:
        normalized = normalize_network_name(network)
        partner = get_partner_by_name(normalized)
        if partner:
            partner_cache[normalized] = partner
            params = partner.get('offer_url_params', [])
            if not params:
                mapping = partner.get('parameter_mapping', {})
                if mapping:
                    params = [{'our_field': v, 'their_param': k} for k, v in mapping.items() if k and v]
            logger.info(f"✅ Partner '{partner.get('partner_name')}': {len(params)} URL params configured")
        else:
            logger.warning(f"⚠️ No partner config found for {network}")

    # Find offers
    query = {
        '$or': [
            {'network': {'$regex': nv, '$options': 'i'}}
            for nv in set(network_variations)
        ]
    }

    offers = list(offers_collection.find(query))
    logger.info(f"\nFound {len(offers)} offers from target networks")

    if not offers:
        logger.info("No offers found. Done.")
        return

    updated = 0
    skipped = 0
    errors = 0

    for offer in offers:
        try:
            network = offer.get('network', '')
            normalized = normalize_network_name(network)
            old_url = offer.get('target_url', '')

            if not old_url:
                skipped += 1
                continue

            partner = partner_cache.get(normalized)
            if not partner:
                partner = get_partner_by_domain(old_url)

            if not partner:
                skipped += 1
                continue

            params = partner.get('offer_url_params', [])
            if not params:
                mapping = partner.get('parameter_mapping', {})
                if mapping:
                    params = [{'our_field': v, 'their_param': k} for k, v in mapping.items() if k and v]

            if not params:
                skipped += 1
                continue

            new_url = inject_offer_url_params(old_url, params)

            if old_url == new_url:
                skipped += 1
                continue

            result = offers_collection.update_one(
                {'_id': offer['_id']},
                {'$set': {'target_url': new_url, 'updated_at': datetime.utcnow()}}
            )

            if result.modified_count > 0:
                logger.info(f"✓ {offer.get('offer_id')} ({offer.get('name', '')[:40]})")
                logger.info(f"  Old: {old_url[:100]}")
                logger.info(f"  New: {new_url}")
                updated += 1
            else:
                errors += 1

        except Exception as e:
            logger.error(f"Error on offer {offer.get('_id')}: {e}")
            errors += 1

    logger.info("\n" + "=" * 80)
    logger.info(f"DONE — Updated: {updated}, Skipped: {skipped}, Errors: {errors}")
    logger.info("=" * 80)


if __name__ == '__main__':
    try:
        fix_tracking_links()
    except Exception as e:
        logger.error(f"Migration failed: {e}", exc_info=True)
        sys.exit(1)
