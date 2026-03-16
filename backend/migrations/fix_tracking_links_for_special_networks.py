"""
Migration: Replace Partner URL Params on Existing Offer Tracking Links

This migration:
1. Strips OLD partner-injected params from the offer target_url
2. Re-injects the CURRENT partner offer_url_params

This handles the case where partner params were updated and old (possibly empty)
params need to be replaced with the new configuration.

Networks affected: leadads, cpamerchant, chameleonads

Run: python migrations/fix_tracking_links_for_special_networks.py
"""

import sys
import os
from datetime import datetime
from urllib.parse import urlparse, parse_qs, urlunparse

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


def get_partner_param_info(partner):
    """Extract param keys AND macro values from a partner's config."""
    keys = set()
    macro_values = set()
    params = partner.get('offer_url_params', [])
    if not params:
        mapping = partner.get('parameter_mapping', {})
        if mapping:
            params = [{'our_field': v, 'their_param': k} for k, v in mapping.items() if k and v]
    for p in params:
        k = p.get('their_param', '').strip()
        v = p.get('our_field', '').strip()
        if k:
            keys.add(k)
        if v:
            macro_values.add(f'{{{v}}}')
    return keys, macro_values


def get_base_url_params(network_name):
    """Get the param keys that are part of the base tracking template (not injected)."""
    from services.tracking_link_generator import NETWORK_TRACKING_TEMPLATES
    normalized = normalize_network_name(network_name)
    template_info = NETWORK_TRACKING_TEMPLATES.get(normalized)
    if not template_info:
        return set()
    template = template_info.get('template', '')
    try:
        parsed = urlparse(template)
        base_params = parse_qs(parsed.query, keep_blank_values=True)
        return set(base_params.keys())
    except Exception:
        return set()


def strip_partner_params(url, param_keys_to_remove, macro_values_to_reassign, base_param_keys):
    """
    Remove query parameters from a URL that were injected by partner config.
    
    Strips a param if:
    - Its key is in param_keys_to_remove (current partner config keys), OR
    - Its value is a macro that will be re-assigned (e.g. {user_id} moving from subid to aff_sub)
    
    Never strips base template params (offer_id, aff_id, etc.)
    """
    if not url:
        return url
    try:
        parsed = urlparse(url)
        existing = parse_qs(parsed.query, keep_blank_values=True)

        cleaned = {}
        for k, v_list in existing.items():
            # Never strip base template params
            if k in base_param_keys:
                cleaned[k] = v_list
                continue
            # Strip if key matches current partner config
            if k in param_keys_to_remove:
                continue
            # Strip if value is a macro that's being re-assigned to a different param
            val = v_list[0] if v_list else ''
            if val.strip() in macro_values_to_reassign:
                continue
            cleaned[k] = v_list

        # Rebuild query string preserving macro braces
        parts = []
        for k, v in cleaned.items():
            for item in (v if isinstance(v, list) else [v]):
                parts.append(f"{k}={item}")
        new_query = '&'.join(parts)

        return urlunparse(parsed._replace(query=new_query))
    except Exception as e:
        logger.error(f"Error stripping params: {e}")
        return url


def fix_tracking_links():
    offers_collection = db_instance.get_collection('offers')

    target_networks = ['leadads', 'cpamerchant', 'chameleonads']
    network_variations = []
    for n in target_networks:
        network_variations.extend([n, n.replace('ads', '_ads'), n.replace('merchant', '_merchant')])

    logger.info("=" * 80)
    logger.info("REPLACING PARTNER URL PARAMS ON EXISTING OFFER TRACKING LINKS")
    logger.info("=" * 80)

    # Pre-load partner configs
    partner_cache = {}
    partner_keys_cache = {}
    partner_macros_cache = {}
    for network in target_networks:
        normalized = normalize_network_name(network)
        partner = get_partner_by_name(normalized)
        if partner:
            partner_cache[normalized] = partner
            keys, macros = get_partner_param_info(partner)
            partner_keys_cache[normalized] = keys
            partner_macros_cache[normalized] = macros
            logger.info(f"  Partner '{partner.get('partner_name')}': keys={keys}, macros={macros}")
        else:
            logger.warning(f"  No partner config found for '{network}'")

    # Find offers
    query = {
        '$or': [
            {'network': {'$regex': nv, '$options': 'i'}}
            for nv in set(network_variations)
        ]
    }

    offers = list(offers_collection.find(query))
    logger.info(f"\nFound {len(offers)} offers from target networks\n")

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
                logger.info(f"  SKIP {offer.get('offer_id')} — no partner config")
                skipped += 1
                continue

            # Get current partner param keys and macro values
            keys_to_strip, _ = get_partner_param_info(partner)
            _, macros_to_reassign = get_partner_param_info(partner)

            # Get base template params (never strip these)
            base_keys = get_base_url_params(network)

            # Get new params to inject
            params = partner.get('offer_url_params', [])
            if not params:
                mapping = partner.get('parameter_mapping', {})
                if mapping:
                    params = [{'our_field': v, 'their_param': k} for k, v in mapping.items() if k and v]

            if not params:
                skipped += 1
                continue

            # Step 1: Strip old partner params + duplicate macros from URL
            stripped_url = strip_partner_params(old_url, keys_to_strip, macros_to_reassign, base_keys)

            # Step 2: Inject fresh params from current partner config
            new_url = inject_offer_url_params(stripped_url, params)

            if old_url == new_url:
                skipped += 1
                continue

            result = offers_collection.update_one(
                {'_id': offer['_id']},
                {'$set': {'target_url': new_url, 'updated_at': datetime.utcnow()}}
            )

            if result.modified_count > 0:
                logger.info(f"  UPDATED {offer.get('offer_id')} ({offer.get('name', '')[:40]})")
                logger.info(f"    Old: {old_url[:120]}")
                logger.info(f"    New: {new_url[:120]}")
                updated += 1
            else:
                errors += 1

        except Exception as e:
            logger.error(f"  ERROR on offer {offer.get('_id')}: {e}")
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
