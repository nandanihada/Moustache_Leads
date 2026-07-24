"""
Migration: Restore offer images from network APIs.

This script re-fetches thumbnail/image URLs from your networks
for offers that currently have Unsplash stock images (from the broken assign-random-images bug).

It ONLY updates offers that currently have unsplash.com URLs — nothing else is touched.

Run from backend/: python migrations/restore_offer_images.py
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

import logging
import requests
import hashlib
import time
from datetime import datetime
from database import db_instance

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(message)s')
logger = logging.getLogger(__name__)


# ─── HasOffers Networks ───────────────────────────────────────────
HASOFFERS_NETWORKS = [
    {'network_id': 'chameleonads', 'api_key': '0d120fbf45ecceafadc93a0208b3f314c6e901fbad3a2ae613a44338abdca351'},
    {'network_id': 'cpamerchant', 'api_key': 'eeb0f8b62e03dde5844adb2bba29bc6583b941e39bf09e0a94d2ab6e38863a5c'},
    {'network_id': 'quiver', 'api_key': 'dcc775cb3127732d01aba5977fba1b06f9bb3143c6ea8c71a2ad32153584f9b1'},
    {'network_id': 'leadads', 'api_key': 'd94df039d5b629fa1241abcd637015bb323ce8ec85ec1cfdce08c84d8d76de6f'},
]

# ─── Everflow Networks ────────────────────────────────────────────
EVERFLOW_NETWORKS = [
    {'network_name': 'triadmedia', 'api_url': 'https://api.eflow.team/v1/affiliates/offersrunnable', 'api_key': 'mLND6ZqET6GYlUsG5Og6A'},
    {'network_name': 'adtogame', 'api_url': 'https://api.eflow.team/v1/affiliates/offersrunnable', 'api_key': 'P55nWCEMQA6dyYEAgDNXA'},
]

# ─── AdscendMedia ─────────────────────────────────────────────────
ADSCENDMEDIA_CONFIG = {
    'publisher_id': '115620',
    'api_key': 'Qy8AqNh9ANppdP0bZkvB7QjzCmNiDxRlbbiTR3wilrbdeagRDeXBUEeDmLDz',
}


def is_unsplash_or_placeholder(url):
    """Check if an image URL is an unsplash stock photo or placeholder."""
    if not url or not url.strip():
        return True
    lower = url.lower()
    return (
        'unsplash.com' in lower or
        'picsum.photos' in lower or
        'via.placeholder' in lower or
        'placeholder' in lower
    )


def fetch_hasoffers_thumbnails(network_id, api_key):
    """Fetch all offer thumbnails from a HasOffers network."""
    url = f"https://{network_id}.api.hasoffers.com/Apiv3/json"
    params = {
        'NetworkId': network_id,
        'Target': 'Affiliate_Offer',
        'Method': 'findMyOffers',
        'api_key': api_key,
        'limit': 1000,
        'contain[]': ['Thumbnail']
    }

    try:
        logger.info(f"  Fetching from HasOffers API: {network_id}...")
        response = requests.get(url, params=params, timeout=30)
        response.raise_for_status()
        data = response.json()

        if data.get('response', {}).get('status') != 1:
            error = data.get('response', {}).get('errorMessage', 'Unknown')
            logger.error(f"  API error for {network_id}: {error}")
            return {}

        response_data = data.get('response', {}).get('data', {})
        if isinstance(response_data, dict) and 'data' in response_data:
            offers_data = response_data['data']
        else:
            offers_data = response_data

        # Build map: campaign_id -> thumbnail_url
        thumbnails = {}
        if isinstance(offers_data, dict):
            for offer_id, offer_info in offers_data.items():
                if isinstance(offer_info, dict):
                    campaign_id = str(offer_info.get('Offer', {}).get('id', ''))
                    thumbnail = offer_info.get('Thumbnail', {})
                    if thumbnail and thumbnail.get('url'):
                        thumbnails[campaign_id] = thumbnail['url']

        logger.info(f"  Got {len(thumbnails)} thumbnails from {network_id}")
        return thumbnails

    except Exception as e:
        logger.error(f"  Failed to fetch from {network_id}: {e}")
        return {}


def fetch_everflow_thumbnails(network_name, api_url, api_key):
    """Fetch offer images from Everflow API."""
    headers = {
        'Content-Type': 'application/json',
        'x-eflow-api-key': api_key
    }

    try:
        logger.info(f"  Fetching from Everflow API: {network_name}...")
        all_offers = []
        page = 1

        while True:
            params = {'page': page, 'page_size': 100}
            response = requests.get(api_url, headers=headers, params=params, timeout=30)

            if response.status_code == 401:
                logger.error(f"  Invalid API key for {network_name}")
                return {}

            response.raise_for_status()
            data = response.json()

            if isinstance(data, list):
                batch = data
            elif isinstance(data, dict) and 'offers' in data:
                batch = data['offers']
            else:
                batch = []

            if not batch:
                break

            all_offers.extend(batch)
            if len(batch) < 100:
                break
            page += 1

        # Build map: offer_id -> thumbnail_url
        thumbnails = {}
        for offer in all_offers:
            offer_id = str(offer.get('network_offer_id', '') or offer.get('offer_id', '') or offer.get('id', ''))
            # Everflow offers may have thumbnail_url, image_url, or creative_url
            img = (
                offer.get('thumbnail_url') or
                offer.get('image_url') or
                offer.get('offer_image_url') or
                offer.get('creative_url') or
                ''
            )
            if offer_id and img and img.strip():
                thumbnails[offer_id] = img.strip()

        logger.info(f"  Got {len(thumbnails)} thumbnails from {network_name}")
        return thumbnails

    except Exception as e:
        logger.error(f"  Failed to fetch from {network_name}: {e}")
        return {}


def fetch_adscendmedia_thumbnails(publisher_id, api_key):
    """Fetch offer images from AdscendMedia API."""
    url = f"https://api.adscendmedia.com/v1/publisher/{publisher_id}/offers.json"

    try:
        logger.info(f"  Fetching from AdscendMedia API...")
        response = requests.get(url, auth=(publisher_id, api_key), timeout=60)

        if response.status_code != 200:
            logger.error(f"  AdscendMedia returned status {response.status_code}")
            return {}

        data = response.json()
        offers = data.get('offers', [])

        # Build map: offer_id -> image_url
        thumbnails = {}
        for offer in offers:
            offer_id = str(offer.get('offer_id', ''))
            img = offer.get('image_url', '') or offer.get('thumbnail', '') or ''
            if offer_id and img and img.strip():
                thumbnails[offer_id] = img.strip()

        logger.info(f"  Got {len(thumbnails)} thumbnails from AdscendMedia")
        return thumbnails

    except Exception as e:
        logger.error(f"  Failed to fetch from AdscendMedia: {e}")
        return {}


def restore_for_network(offers_col, network_name, thumbnails_map, match_field='campaign_id'):
    """Restore images for a specific network using the thumbnails map."""
    import re

    # Find offers from this network that currently have unsplash/placeholder images
    network_regex = re.compile(f'^{re.escape(network_name)}$', re.IGNORECASE)
    offers = list(offers_col.find(
        {
            'network': network_regex,
            'image_url': {'$regex': 'unsplash\\.com', '$options': 'i'},
            '$or': [{'deleted': {'$exists': False}}, {'deleted': False}]
        },
        {'campaign_id': 1, 'offer_id': 1, 'name': 1, 'image_url': 1, 'network_offer_id': 1}
    ))

    if not offers:
        logger.info(f"  No offers with unsplash images found for {network_name}")
        return 0

    logger.info(f"  Found {len(offers)} offers with unsplash images for {network_name}")

    restored = 0
    for offer in offers:
        # Try campaign_id first, then network_offer_id
        lookup_id = str(offer.get(match_field, '') or offer.get('campaign_id', '') or offer.get('network_offer_id', ''))

        if lookup_id and lookup_id in thumbnails_map:
            new_image = thumbnails_map[lookup_id]
            offers_col.update_one(
                {'_id': offer['_id']},
                {'$set': {
                    'image_url': new_image,
                    'thumbnail_url': new_image,
                    'image_restored_at': datetime.utcnow(),
                    'image_restored_from': 'network_api'
                }}
            )
            restored += 1
            if restored <= 3:
                logger.info(f"    ✅ {offer.get('name', '')[:35]} → {new_image[:60]}...")

    logger.info(f"  Restored {restored}/{len(offers)} images for {network_name}")
    return restored


def main():
    offers_col = db_instance.get_collection('offers')
    if offers_col is None:
        logger.error("Cannot connect to database!")
        return

    # Count affected offers
    affected = offers_col.count_documents({
        'image_url': {'$regex': 'unsplash\\.com', '$options': 'i'},
        '$or': [{'deleted': {'$exists': False}}, {'deleted': False}]
    })
    logger.info(f"\n📊 Total offers with Unsplash images (affected): {affected}\n")

    total_restored = 0

    # ─── Process HasOffers networks ───
    for network in HASOFFERS_NETWORKS:
        logger.info(f"\n{'='*50}")
        logger.info(f"🔄 HasOffers: {network['network_id']}")
        logger.info(f"{'='*50}")
        thumbnails = fetch_hasoffers_thumbnails(network['network_id'], network['api_key'])
        if thumbnails:
            count = restore_for_network(offers_col, network['network_id'], thumbnails, 'campaign_id')
            total_restored += count
        time.sleep(1)  # Rate limit courtesy

    # ─── Process Everflow networks ───
    for network in EVERFLOW_NETWORKS:
        logger.info(f"\n{'='*50}")
        logger.info(f"🔄 Everflow: {network['network_name']}")
        logger.info(f"{'='*50}")
        thumbnails = fetch_everflow_thumbnails(network['network_name'], network['api_url'], network['api_key'])
        if thumbnails:
            count = restore_for_network(offers_col, network['network_name'], thumbnails, 'campaign_id')
            total_restored += count
        time.sleep(1)

    # ─── Process AdscendMedia ───
    logger.info(f"\n{'='*50}")
    logger.info(f"🔄 AdscendMedia")
    logger.info(f"{'='*50}")
    thumbnails = fetch_adscendmedia_thumbnails(
        ADSCENDMEDIA_CONFIG['publisher_id'],
        ADSCENDMEDIA_CONFIG['api_key']
    )
    if thumbnails:
        count = restore_for_network(offers_col, 'adscendmedia', thumbnails, 'campaign_id')
        total_restored += count

    # ─── Summary ───
    remaining = offers_col.count_documents({
        'image_url': {'$regex': 'unsplash\\.com', '$options': 'i'},
        '$or': [{'deleted': {'$exists': False}}, {'deleted': False}]
    })

    logger.info(f"\n{'='*50}")
    logger.info(f"✅ DONE — Restored {total_restored} offer images")
    logger.info(f"📊 Still have unsplash images: {remaining} offers")
    logger.info(f"{'='*50}")

    if remaining > 0:
        logger.info(f"\n💡 {remaining} offers still have stock images.")
        logger.info("   These are likely offers whose networks don't provide thumbnails.")
        logger.info("   You can use Image Rules or the Offerwall Editor to set images manually.")


if __name__ == '__main__':
    logger.info("=" * 60)
    logger.info("  OFFER IMAGE RESTORATION SCRIPT")
    logger.info("  Restores real network images for offers affected by the")
    logger.info("  'Assign Random Images' bug")
    logger.info("=" * 60)
    logger.info("")
    main()
