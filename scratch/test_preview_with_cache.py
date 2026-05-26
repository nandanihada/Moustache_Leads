import os
import sys
import time
sys.path.append(os.path.abspath('backend'))
from database import db_instance
from bson import ObjectId

db = db_instance.get_db()
user_id = '696b65140bff65ebd4876e02'

_active_offers_cache = None
_active_offers_cache_expiry = 0
_active_offers_cache_ttl = 120

def get_active_offers_cached(db):
    global _active_offers_cache, _active_offers_cache_expiry
    now = time.time()
    if _active_offers_cache is not None and now < _active_offers_cache_expiry:
        print("Returning cached offers from memory...")
        return _active_offers_cache
    
    print("Fetching active offers from MongoDB with projection...")
    projection = {
        '_id': 1,
        'categories': 1,
        'category': 1,
        'vertical': 1,
        'countries': 1,
        'approved_count': 1,
        'hits': 1,
        'payout': 1,
        'revenue_share_percent': 1,
        'offer_name': 1,
        'name': 1,
        'network': 1,
        'image_url': 1,
        'thumbnail_url': 1,
        'status': 1
    }
    offers = list(db.offers.find({'status': 'active'}, projection))
    _active_offers_cache = offers
    _active_offers_cache_expiry = now + _active_offers_cache_ttl
    return offers

def get_offers_for_step_mock(step, user_id, state):
    all_offers = get_active_offers_cached(db)
    scored_offers = []
    interest_cats = []
    interest_geos = []
    sent_ids = state.get('sent_offer_ids', [])
    
    import random
    for offer in all_offers:
        offer_id_str = str(offer.get('_id'))
        if offer_id_str in sent_ids:
            continue
            
        score = 50
        score += random.random() * 5
        
        categories = offer.get('categories', [])
        if not isinstance(categories, list): categories = [categories]
        primary_cat = (offer.get('category') or offer.get('vertical') or '').lower()
        if primary_cat and primary_cat not in [c.lower() for c in categories]:
            categories.append(primary_cat)
        
        offer_cats_lower = [c.lower() for c in categories]
        countries = [c.upper() for c in (offer.get('countries') or [])]
        
        if 'WW' in countries:
            score += 5
        elif any(g in countries for g in interest_geos):
            score += 25
            
        match_count = sum(1 for c in offer_cats_lower if c in interest_cats)
        if match_count > 0:
            score += 100 + (match_count * 10)
            
        if 'installs' in offer_cats_lower:
            score += 15
        elif 'finance' in offer_cats_lower:
            score += 5
        
        score += min(15, (offer.get('approved_count', 0) / 5))
        score += min(10, (offer.get('hits', 0) / 200))
        
        scored_offers.append({'offer': offer, 'score': score})
        
    scored_offers.sort(key=lambda x: x['score'], reverse=True)
    return [scored_offers[0]['offer']] if scored_offers else [], []

def benchmark_simulation():
    # Simulate current step = 0 (run 5 steps)
    state = {'sent_offer_ids': []}
    
    print("\n--- FIRST INVOCATION (Cache Miss) ---")
    start = time.time()
    simulated_sent_ids = list(state.get('sent_offer_ids', []))
    simulated_state = dict(state)
    
    for step in range(1, 6):
        simulated_state['sent_offer_ids'] = simulated_sent_ids
        offers, _ = get_offers_for_step_mock(step, user_id, simulated_state)
        if offers:
            simulated_sent_ids.append(str(offers[0].get('_id')))
    print(f"Total time for first 5-step simulation: {time.time() - start:.4f}s")
    
    print("\n--- SECOND INVOCATION (Cache Hit) ---")
    start = time.time()
    simulated_sent_ids = list(state.get('sent_offer_ids', []))
    simulated_state = dict(state)
    
    for step in range(1, 6):
        simulated_state['sent_offer_ids'] = simulated_sent_ids
        offers, _ = get_offers_for_step_mock(step, user_id, simulated_state)
        if offers:
            simulated_sent_ids.append(str(offers[0].get('_id')))
    print(f"Total time for second 5-step simulation: {time.time() - start:.4f}s")

if __name__ == '__main__':
    benchmark_simulation()
