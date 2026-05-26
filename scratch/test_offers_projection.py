import os
import sys
import time
sys.path.append(os.path.abspath('backend'))
from database import db_instance

db = db_instance.get_db()

def test_projection():
    print("Starting projection benchmark...")
    
    # Test 1: No projection
    start = time.time()
    all_offers_full = list(db.offers.find({'status': 'active'}))
    print(f"Full document query took {time.time() - start:.4f}s, size: {len(all_offers_full)}")
    
    # Test 2: With projection
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
        'thumbnail_url': 1
    }
    
    start = time.time()
    all_offers_proj = list(db.offers.find({'status': 'active'}, projection))
    print(f"Projected query took {time.time() - start:.4f}s, size: {len(all_offers_proj)}")

if __name__ == '__main__':
    test_projection()
