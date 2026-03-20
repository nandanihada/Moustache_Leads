"""
One-time migration: Backfill geo data for clicks that have ip_address but no country.
Covers: clicks, offerwall_clicks_detailed, offerwall_clicks, dashboard_clicks, received_postbacks, conversions

Usage:
    cd Moustache_Leads/backend
    python migrations/backfill_geo_data.py
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from database import db_instance
from services.ipinfo_service import get_ipinfo_service
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
logger = logging.getLogger(__name__)


def backfill_collection(collection_name, ip_field='ip_address', country_field='country',
                        city_field='city', region_field='region', nested_geo=False):
    """Backfill geo data for a single collection."""
    col = db_instance.get_collection(collection_name)
    if col is None:
        logger.warning(f"Collection '{collection_name}' not found, skipping")
        return 0

    ipinfo_svc = get_ipinfo_service()

    # Build query for rows missing country
    if nested_geo:
        # dashboard_clicks uses geo.country
        query = {
            'network.ip_address': {'$exists': True, '$ne': ''},
            '$or': [
                {'geo.country': {'$exists': False}},
                {'geo.country': None},
                {'geo.country': ''},
                {'geo.country': 'Unknown'},
                {'geo.country': 'unknown'},
            ]
        }
    else:
        query = {
            ip_field: {'$exists': True, '$ne': ''},
            '$or': [
                {country_field: {'$exists': False}},
                {country_field: None},
                {country_field: ''},
                {country_field: 'Unknown'},
                {country_field: 'unknown'},
            ]
        }

    total = col.count_documents(query)
    logger.info(f"📊 {collection_name}: {total} rows need geo backfill")

    if total == 0:
        return 0

    updated = 0
    # Process in batches of 100
    cursor = col.find(query, {ip_field: 1, 'network.ip_address': 1}).limit(5000)

    for doc in cursor:
        ip = doc.get(ip_field) or (doc.get('network', {}).get('ip_address') if nested_geo else '')
        if not ip:
            continue

        try:
            ip_data = ipinfo_svc.lookup_ip(ip)
            if not ip_data:
                continue

            country = ip_data.get('country', '')
            if not country or country in ('Unknown', 'unknown', 'XX'):
                continue

            if nested_geo:
                update = {
                    '$set': {
                        'geo.country': country,
                        'geo.country_code': ip_data.get('country_code', ''),
                        'geo.city': ip_data.get('city', ''),
                        'geo.region': ip_data.get('region', ''),
                    }
                }
            else:
                update = {
                    '$set': {
                        country_field: country,
                        'country_code': ip_data.get('country_code', ''),
                        city_field: ip_data.get('city', ''),
                        region_field: ip_data.get('region', ''),
                    }
                }

            col.update_one({'_id': doc['_id']}, update)
            updated += 1

            if updated % 50 == 0:
                logger.info(f"   {collection_name}: {updated}/{total} updated...")

        except Exception as e:
            logger.warning(f"   Failed for {ip}: {e}")
            continue

    logger.info(f"✅ {collection_name}: backfilled {updated}/{total} rows")
    return updated


def main():
    logger.info("=" * 60)
    logger.info("🌍 GEO DATA BACKFILL MIGRATION")
    logger.info("=" * 60)

    total_updated = 0

    # 1. clicks (flat fields)
    total_updated += backfill_collection('clicks')

    # 2. offerwall_clicks_detailed (flat fields)
    total_updated += backfill_collection('offerwall_clicks_detailed')

    # 3. offerwall_clicks (flat fields)
    total_updated += backfill_collection('offerwall_clicks')

    # 4. dashboard_clicks (nested: geo.country, network.ip_address)
    total_updated += backfill_collection('dashboard_clicks', nested_geo=True)

    # 5. received_postbacks
    total_updated += backfill_collection('received_postbacks')

    # 6. conversions
    total_updated += backfill_collection('conversions')

    logger.info("=" * 60)
    logger.info(f"🎉 MIGRATION COMPLETE: {total_updated} total rows backfilled")
    logger.info("=" * 60)


if __name__ == '__main__':
    main()
