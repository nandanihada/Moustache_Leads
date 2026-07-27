"""
Migration: Backfill redirect_urls for existing partners

Generates the 4 browser-facing redirect URLs for every partner that has a
unique_postback_key but is missing the redirect_urls field.

Run once:
  python migrations/backfill_redirect_urls.py
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from database import db_instance
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

REDIRECT_EVENTS = ['complete', 'overquota', 'terminate', 'security']

def run():
    if not db_instance.is_connected():
        logger.error("Database not connected")
        return

    partners_col = db_instance.get_collection('partners')
    
    # Find all partners that have a unique_postback_key but no redirect_urls
    query = {
        'unique_postback_key': {'$exists': True, '$ne': ''},
        'redirect_urls': {'$exists': False}
    }
    partners = list(partners_col.find(query))
    logger.info(f"Found {len(partners)} partners missing redirect_urls")

    updated = 0
    for partner in partners:
        unique_key = partner.get('unique_postback_key', '')
        if not unique_key:
            continue

        redirect_base = f"https://postback.moustacheleads.com/redirect/{unique_key}"
        redirect_urls = {evt: f"{redirect_base}/{evt}" for evt in REDIRECT_EVENTS}

        partners_col.update_one(
            {'_id': partner['_id']},
            {'$set': {'redirect_urls': redirect_urls}}
        )
        updated += 1
        logger.info(f"  ✅ {partner.get('partner_name', '?')} → redirect_urls set")

    logger.info(f"Done. Updated {updated} partners.")

if __name__ == '__main__':
    run()
