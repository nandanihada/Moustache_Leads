"""
Migration: Refine Offer Descriptions using Groq AI
Target: All offers that are shown in offerwall (show_in_iframe=True) + all running offers (status=running)
Stores refined_description JSON on each offer document.

Usage:
    cd backend
    python migrations/refine_offer_descriptions.py
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv()

from database import db_instance
from services.description_refiner_service import batch_refine_offers
import logging
import datetime

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


def run():
    """Find all iframe + running offers and refine their descriptions."""
    offers_col = db_instance.get_collection('offers')
    if offers_col is None:
        logger.error("Cannot connect to offers collection")
        return
    
    print("=" * 60)
    print("OFFER DESCRIPTION REFINER — Groq AI")
    print("=" * 60)
    print("Fetching offers...")
    
    # Simple query: active offers that are either running or shown in iframe
    query = {
        'is_active': True,
        '$or': [
            {'show_in_iframe': True},
            {'status': 'running'},
            {'status': 'active'},
        ]
    }
    
    # Fetch all matching offers (only needed fields)
    offers = list(offers_col.find(
        query,
        {
            'offer_id': 1, 'name': 1, 'description': 1,
            'payout': 1, 'payout_type': 1, 'status': 1,
            'show_in_iframe': 1, 'refined_description': 1
        }
    ).limit(500))  # Safety limit
    
    print(f"Found {len(offers)} total offers")
    
    # Filter out already-refined ones (client-side filter is faster than complex query)
    unrefined = [o for o in offers if not o.get('refined_description')]
    
    print(f"Already refined: {len(offers) - len(unrefined)}")
    print(f"Need refining: {len(unrefined)}")
    
    if len(unrefined) == 0:
        print("\n✅ All offers are already refined. Nothing to do.")
        return
    
    # Process in batches of 8 (fits within 6000 TPM)
    BATCH_SIZE = 8
    total_batches = (len(unrefined) + BATCH_SIZE - 1) // BATCH_SIZE
    est_time = total_batches * 70  # ~70s per batch (8 requests + 60s cooldown)
    print(f"Processing in {total_batches} batches of {BATCH_SIZE}")
    print(f"Estimated time: ~{est_time:.0f}s ({est_time/60:.1f} min)")
    print("(Respecting Groq free-tier: 6000 TPM limit)")
    print("")
    
    total_success = 0
    total_errors = 0
    
    for batch_num in range(total_batches):
        batch_start = batch_num * BATCH_SIZE
        batch_end = min(batch_start + BATCH_SIZE, len(unrefined))
        batch = unrefined[batch_start:batch_end]
        
        print(f"\n--- Batch {batch_num + 1}/{total_batches} ({len(batch)} offers) ---")
        success, errors = batch_refine_offers(batch, delay=2.0)
        total_success += success
        total_errors += errors
        
        # Cooldown between batches to reset TPM window
        if batch_num < total_batches - 1:
            print(f"  ⏳ Cooling down 60s to reset rate limit window...")
            import time
            time.sleep(60)
    
    print("")
    print("=" * 60)
    print("RESULTS")
    print("=" * 60)
    print(f"✅ Successfully refined: {total_success}")
    print(f"❌ Errors: {total_errors}")
    print(f"📊 Total: {total_success + total_errors}/{len(unrefined)}")


if __name__ == '__main__':
    run()
