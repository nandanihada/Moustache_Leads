"""
Production MongoDB Index Creation Script

Run this ONCE against your production database to create all necessary indexes.
This will dramatically speed up queries across the application.

Usage:
    python migrations/create_production_indexes.py

WARNING: Creating indexes on large collections may take a few minutes.
         Run during low-traffic periods.
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from database import db_instance
from pymongo import ASCENDING, DESCENDING, TEXT
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def create_indexes():
    if not db_instance.is_connected():
        logger.error("Database not connected")
        return
    
    db = db_instance.get_db()
    results = []
    
    def safe_create(collection_name, index, **kwargs):
        try:
            db[collection_name].create_index(index, **kwargs)
            results.append(f"  ✅ {collection_name}: {index}")
        except Exception as e:
            results.append(f"  ❌ {collection_name}: {index} - {e}")
    
    # ===== OFFERS COLLECTION =====
    logger.info("Creating offers indexes...")
    safe_create('offers', [('offer_id', ASCENDING)], unique=True)
    safe_create('offers', [('status', ASCENDING), ('is_active', ASCENDING)])
    safe_create('offers', [('is_active', ASCENDING), ('deleted', ASCENDING), ('status', ASCENDING)])
    safe_create('offers', [('category', ASCENDING), ('status', ASCENDING)])
    safe_create('offers', [('network', ASCENDING), ('status', ASCENDING)])
    safe_create('offers', [('created_at', DESCENDING)])
    safe_create('offers', [('created_by', ASCENDING)])
    safe_create('offers', [('payout', DESCENDING)])
    
    # ===== CLICKS COLLECTION =====
    logger.info("Creating clicks indexes...")
    safe_create('clicks', [('click_id', ASCENDING)], unique=True)
    safe_create('clicks', [('offer_id', ASCENDING), ('created_at', DESCENDING)])
    safe_create('clicks', [('affiliate_id', ASCENDING), ('created_at', DESCENDING)])
    safe_create('clicks', [('status', ASCENDING)])
    safe_create('clicks', [('ip_address', ASCENDING), ('offer_id', ASCENDING)])
    
    # ===== CONVERSIONS COLLECTION =====
    logger.info("Creating conversions indexes...")
    safe_create('conversions', [('conversion_id', ASCENDING)], unique=True)
    safe_create('conversions', [('offer_id', ASCENDING), ('status', ASCENDING)])
    safe_create('conversions', [('offer_id', ASCENDING), ('conversion_time', DESCENDING)])
    safe_create('conversions', [('click_id', ASCENDING)])
    safe_create('conversions', [('affiliate_id', ASCENDING), ('created_at', DESCENDING)])
    safe_create('conversions', [('status', ASCENDING), ('conversion_time', DESCENDING)])
    
    # ===== POSTBACK QUEUE =====
    logger.info("Creating postback_queue indexes...")
    safe_create('postback_queue', [('status', ASCENDING), ('next_attempt', ASCENDING)])
    safe_create('postback_queue', [('status', ASCENDING), ('attempts', ASCENDING)])
    safe_create('postback_queue', [('conversion_id', ASCENDING)])
    
    # ===== POSTBACK LOGS =====
    logger.info("Creating postback_logs indexes...")
    safe_create('postback_logs', [('created_at', DESCENDING)])
    safe_create('postback_logs', [('partner_id', ASCENDING), ('created_at', DESCENDING)])
    safe_create('postback_logs', [('status', ASCENDING), ('created_at', DESCENDING)])
    
    # ===== USERS COLLECTION =====
    logger.info("Creating users indexes...")
    safe_create('users', [('email', ASCENDING)], unique=True, sparse=True)
    safe_create('users', [('username', ASCENDING)], unique=True, sparse=True)
    safe_create('users', [('role', ASCENDING), ('created_at', DESCENDING)])
    
    # ===== PLACEMENTS COLLECTION =====
    logger.info("Creating placements indexes...")
    safe_create('placements', [('publisherId', ASCENDING)])
    safe_create('placements', [('approvalStatus', ASCENDING), ('createdAt', ASCENDING)])
    safe_create('placements', [('placementIdentifier', ASCENDING)])
    
    # ===== AFFILIATE REQUESTS =====
    logger.info("Creating affiliate_requests indexes...")
    safe_create('affiliate_requests', [('offer_id', ASCENDING), ('user_id', ASCENDING)])
    safe_create('affiliate_requests', [('offer_id', ASCENDING), ('publisher_id', ASCENDING)])
    safe_create('affiliate_requests', [('status', ASCENDING)])
    
    # ===== OFFERWALL TRACKING =====
    logger.info("Creating offerwall tracking indexes...")
    safe_create('offerwall_sessions', [('session_id', ASCENDING)], unique=True)
    safe_create('offerwall_sessions', [('placement_id', ASCENDING)])
    safe_create('offerwall_clicks', [('session_id', ASCENDING), ('offer_id', ASCENDING)])
    safe_create('offerwall_clicks', [('click_id', ASCENDING)])
    safe_create('offerwall_impressions', [('session_id', ASCENDING)])
    
    # ===== TRACKING EVENTS =====
    logger.info("Creating tracking_events indexes...")
    safe_create('tracking_events', [('timestamp', DESCENDING)])
    safe_create('tracking_events', [('event_type', ASCENDING), ('timestamp', DESCENDING)])
    safe_create('tracking_events', [('offer_id', ASCENDING), ('timestamp', DESCENDING)])
    
    # ===== ERROR/SYSTEM LOGS =====
    logger.info("Creating log indexes...")
    safe_create('error_logs', [('type', ASCENDING), ('timestamp', DESCENDING)])
    safe_create('system_events', [('event_type', ASCENDING), ('timestamp', DESCENDING)])
    safe_create('login_logs', [('user_id', ASCENDING), ('timestamp', DESCENDING)])
    safe_create('cap_alerts', [('alert_key', ASCENDING), ('sent_at', DESCENDING)])
    
    # ===== PRINT RESULTS =====
    logger.info("\n" + "="*60)
    logger.info("INDEX CREATION RESULTS:")
    logger.info("="*60)
    for r in results:
        logger.info(r)
    
    success = sum(1 for r in results if '✅' in r)
    failed = sum(1 for r in results if '❌' in r)
    logger.info(f"\nTotal: {success} created, {failed} failed")


if __name__ == '__main__':
    create_indexes()
