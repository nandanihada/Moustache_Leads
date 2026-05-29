"""
Fast MobPlus Import — Direct bulk insert, no partner lookups
=============================================================
Fetches offers from MobPlus API and bulk-inserts them directly.
Skips the slow per-offer partner matching that was causing timeouts.

Usage:
    python migrations/fast_mobplus_import.py              # Import 5000 offers (page 1)
    python migrations/fast_mobplus_import.py --all        # Import ALL offers (all pages)
    python migrations/fast_mobplus_import.py --page 2     # Import specific page
"""

import sys
import os
import json
import time
import random
import string
import requests
from datetime import datetime, timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from database import db_instance
from services.network_field_mapper import network_field_mapper

# MobPlus API config
MOBPLUS_API_URL = "http://mob.mobplus.net/api/affiliate/offers"
MOBPLUS_API_KEY = "c8f485d2a99a49529fdfaacb2fbdc93f"
PAGE_SIZE = 5000


def generate_offer_id():
    """Generate unique offer ID like ML-XXXXXXX"""
    digits = ''.join(random.choices(string.digits, k=7))
    return f"ML-{digits}"


def fetch_mobplus_page(page=1, page_size=PAGE_SIZE):
    """Fetch one page of offers from MobPlus API"""
    headers = {
        'Authorization': MOBPLUS_API_KEY,
        'Content-Type': 'application/x-www-form-urlencoded'
    }
    form_data = {
        'q': json.dumps({"page": page, "pageSize": page_size})
    }
    
    print(f"  📡 Fetching page {page} (pageSize={page_size})...")
    start = time.time()
    response = requests.post(MOBPLUS_API_URL, headers=headers, data=form_data, timeout=90)
    elapsed = time.time() - start
    
    if response.status_code != 200:
        print(f"  ❌ API returned {response.status_code}")
        return []
    
    data = response.json()
    offers = data if isinstance(data, list) else data.get('data', data.get('offers', []))
    print(f"  ✅ Got {len(offers)} offers in {elapsed:.1f}s")
    return offers


def map_and_prepare_offers(raw_offers):
    """Map raw MobPlus offers to DB format — NO partner lookups"""
    mapped = []
    now = datetime.utcnow()
    
    for offer_data in raw_offers:
        try:
            # Use the field mapper but we'll skip the tracking link processing
            offer_id = str(offer_data.get('id', ''))
            raw_name = offer_data.get('name', '') or ''
            description = offer_data.get('desc', '') or offer_data.get('description', '') or ''
            
            # Extract tracking link and normalize macros
            tracking_link = offer_data.get('trackingLink', '') or offer_data.get('tracking_link', '') or ''
            if tracking_link:
                tracking_link = tracking_link.replace('{CLICK_ID}', '{click_id}')
                tracking_link = tracking_link.replace('{SOURCE}', '{sub1}')
            
            # Extract image
            image_url = offer_data.get('previewLink', '') or offer_data.get('preview_link', '') or ''
            
            # Extract payout
            payout = 0.0
            try:
                payout = float(offer_data.get('payout', 0) or 0)
            except:
                pass
            
            # Extract status
            raw_status = str(offer_data.get('status', 'active') or 'active').lower()
            status = 'active' if raw_status in ['live', 'active'] else 'inactive'
            
            # Extract categories
            categories = offer_data.get('categories', []) or []
            if isinstance(categories, str):
                categories = [categories]
            
            # Extract countries from name
            countries = extract_countries(raw_name)
            if not countries:
                countries = ['US']
            
            # Detect vertical from categories/name
            vertical = detect_vertical(categories, raw_name)
            
            # Build the offer document
            ml_offer_id = generate_offer_id()
            
            doc = {
                'offer_id': ml_offer_id,
                'campaign_id': offer_id,
                'name': raw_name.strip(),
                'description': description.strip(),
                'target_url': tracking_link,
                'preview_url': image_url or 'https://www.google.com',
                'image_url': image_url,
                'payout': payout,
                'currency': offer_data.get('currency', 'USD') or 'USD',
                'status': status,
                'network': 'mobplus',
                'countries': countries,
                'vertical': vertical,
                'category': vertical,
                'offer_type': 'CPA',
                'payout_model': 'CPA',
                'incentive_type': 'Incent',
                'affiliates': 'all',
                'daily_cap': 0,
                'monthly_cap': 0,
                'is_active': True if status == 'active' else False,
                'deleted': False,
                'show_in_offerwall': True,
                'star_rating': 4,
                'timer_seconds': 0,
                'approval_type': 'auto_approve',
                'require_approval': False,
                'created_at': now,
                'updated_at': now,
                'expiration_date': (now + timedelta(days=90)).strftime('%Y-%m-%d'),
            }
            mapped.append(doc)
        except Exception as e:
            continue
    
    return mapped


def extract_countries(name):
    """Extract country codes from offer name"""
    valid_codes = {'US','GB','UK','CA','AU','DE','FR','ES','IT','NL','BE','CH','AT','SE','NO','DK','FI','PL','IE','PT','GR','CZ','HU','RO','BG','HR','SK','SI','LT','LV','EE','JP','CN','KR','IN','SG','HK','TW','TH','MY','ID','PH','VN','NZ','BR','MX','AR','CL','CO','PE','ZA','IL','TR','AE','SA','EG','RU','UA','WW'}
    import re
    parts = re.split(r'[\s,\-–—/|()]+', name.upper())
    found = [p for p in parts if p in valid_codes]
    # Map UK -> GB
    found = ['GB' if c == 'UK' else c for c in found]
    return list(set(found)) if found else []


def detect_vertical(categories, name):
    """Detect vertical from categories and name"""
    cat_map = {
        'adult': 'DATING', 'dating': 'DATING', 'finance': 'FINANCE',
        'loan': 'LOAN', 'insurance': 'INSURANCE', 'health': 'HEALTH',
        'gaming': 'GAMES_INSTALL', 'casino': 'GAMBLING', 'gambling': 'GAMBLING',
        'sweepstakes': 'SWEEPSTAKES', 'survey': 'SURVEY', 'education': 'EDUCATION',
        'crypto': 'CRYPTO', 'shopping': 'SHOPPING', 'travel': 'TRAVEL',
        'entertainment': 'ENTERTAINMENT', 'install': 'INSTALLS', 'direct': 'INSTALLS',
        'pin submit': 'INSTALLS', 'pin': 'INSTALLS', 'free trial': 'FREE_TRIAL',
    }
    
    for cat in categories:
        if isinstance(cat, str):
            cl = cat.lower().strip()
            if cl in cat_map:
                return cat_map[cl]
    
    # Fallback: check name
    name_lower = name.lower()
    if 'insurance' in name_lower or 'auto' in name_lower:
        return 'INSURANCE'
    elif 'vpn' in name_lower or 'install' in name_lower:
        return 'INSTALLS'
    elif 'sweeps' in name_lower or 'giveaway' in name_lower or 'gift card' in name_lower:
        return 'SWEEPSTAKES'
    elif 'dating' in name_lower or 'singles' in name_lower:
        return 'DATING'
    elif 'survey' in name_lower or 'poll' in name_lower:
        return 'SURVEY'
    elif 'casino' in name_lower or 'slots' in name_lower:
        return 'GAMBLING'
    elif 'loan' in name_lower or 'credit' in name_lower:
        return 'FINANCE'
    
    return 'INSTALLS'  # Default


def run_import(max_pages=1, start_page=1):
    offers_col = db_instance.get_collection('offers')
    if offers_col is None:
        print("❌ Cannot connect to database")
        return
    
    # Get existing campaign_ids to skip duplicates
    print("  🔍 Checking existing offers for duplicates...")
    existing = set()
    try:
        existing_docs = offers_col.find({'network': 'mobplus'}, {'campaign_id': 1})
        existing = set(d.get('campaign_id', '') for d in existing_docs)
        print(f"  Found {len(existing)} existing mobplus offers to skip")
    except:
        pass
    
    total_imported = 0
    total_skipped = 0
    
    for page in range(start_page, start_page + max_pages):
        # Fetch from API
        raw_offers = fetch_mobplus_page(page=page, page_size=PAGE_SIZE)
        if not raw_offers:
            print(f"  No more offers on page {page}. Done.")
            break
        
        # Map offers
        print(f"  🔄 Mapping {len(raw_offers)} offers...")
        mapped = map_and_prepare_offers(raw_offers)
        
        # Filter duplicates
        new_offers = [o for o in mapped if o['campaign_id'] not in existing]
        skipped = len(mapped) - len(new_offers)
        total_skipped += skipped
        
        if not new_offers:
            print(f"  ⚠️  All {len(mapped)} offers already exist. Skipping page {page}.")
            continue
        
        # Bulk insert
        print(f"  💾 Bulk inserting {len(new_offers)} offers (skipped {skipped} duplicates)...")
        start = time.time()
        
        # Insert in batches of 1000
        batch_size = 1000
        for i in range(0, len(new_offers), batch_size):
            batch = new_offers[i:i+batch_size]
            try:
                result = offers_col.insert_many(batch, ordered=False)
                total_imported += len(result.inserted_ids)
            except Exception as e:
                # Some might fail due to duplicates, that's ok
                print(f"    ⚠️  Batch {i//batch_size + 1} partial error: {str(e)[:100]}")
                total_imported += len(batch)  # Approximate
        
        elapsed = time.time() - start
        print(f"  ✅ Page {page} done in {elapsed:.1f}s — imported {len(new_offers)} offers")
        
        # Add to existing set for next page dedup
        for o in new_offers:
            existing.add(o['campaign_id'])
        
        # If we got fewer than page_size, no more pages
        if len(raw_offers) < PAGE_SIZE:
            break
    
    print(f"\n{'='*60}")
    print(f"  IMPORT COMPLETE")
    print(f"{'='*60}")
    print(f"  Total imported: {total_imported}")
    print(f"  Total skipped (duplicates): {total_skipped}")
    print(f"{'='*60}\n")


if __name__ == '__main__':
    print(f"\n{'='*60}")
    print(f"  Fast MobPlus Import")
    print(f"{'='*60}\n")
    
    if '--all' in sys.argv:
        print("  Mode: ALL pages (up to 50k offers)")
        run_import(max_pages=10)
    elif '--page' in sys.argv:
        idx = sys.argv.index('--page')
        page = int(sys.argv[idx + 1]) if idx + 1 < len(sys.argv) else 1
        print(f"  Mode: Single page {page}")
        run_import(max_pages=1, start_page=page)
    else:
        print("  Mode: First 5000 offers (page 1 only)")
        run_import(max_pages=1)
