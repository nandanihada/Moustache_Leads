import os
import sys
import time
sys.path.append(os.path.abspath('backend'))
from database import db_instance
from bson import ObjectId

db = db_instance.get_db()
user_id = '696b65140bff65ebd4876e02'

print("Starting _get_offers_for_step replication...")

# 1. Fetch interest signals from user_intelligence
start = time.time()
print("Querying user_intelligence...")
intel = db.user_intelligence.find_one({'user_id': str(user_id)})
print(f"user_intelligence query took {time.time() - start:.4f}s")

# 2. Get user profile fallbacks
start = time.time()
print("Querying users...")
users_col = db_instance.get_collection('users')
try:
    user = users_col.find_one({'_id': ObjectId(user_id)})
except Exception:
    user = users_col.find_one({'_id': user_id})
print(f"users query took {time.time() - start:.4f}s")

if not user:
    print("User not found.")
    sys.exit(0)

# 4. EMERGENCY FALLBACK
start = time.time()
print("Querying offer_views...")
recent_views = list(db.offer_views.find({'user_id': str(user_id)}).sort('timestamp', -1).limit(20))
print(f"offer_views query took {time.time() - start:.4f}s")

# 6. Score all active offers
start = time.time()
print("Querying active offers...")
all_offers = list(db.offers.find({'status': 'active'}))
print(f"active offers query took {time.time() - start:.4f}s, found {len(all_offers)} offers")

# 7. Loop over all offers
print("Starting scoring loop...")
start = time.time()
scored_offers = []
interest_cats = []
interest_geos = []
sent_ids = []

for idx, offer in enumerate(all_offers):
    if idx % 100 == 0:
        print(f"Scoring progress: {idx}/{len(all_offers)}")
    offer_id_str = str(offer.get('_id'))
    if offer_id_str in sent_ids:
        continue
        
    score = 50
    # Jitter
    import random
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

print(f"Scoring loop took {time.time() - start:.4f}s")
