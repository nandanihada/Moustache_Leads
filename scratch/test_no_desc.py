import os
import sys
import time
sys.path.append(os.path.abspath('backend'))
from database import db_instance

# Replicate the functions to test their speed directly without 'description'
def compute_top_approved_global():
    db = db_instance.get_db()
    reqs_col = db.affiliate_requests
    offers_col = db.offers
    start = time.time()
    agg = list(reqs_col.aggregate([
        {'$match': {'status': 'approved'}},
        {'$group': {'_id': '$offer_id', 'count': {'$sum': 1}}},
        {'$sort': {'count': -1}},
        {'$limit': 150}
    ]))
    top_approved_ids = [item['_id'] for item in agg if item.get('_id')]
    if top_approved_ids:
        offers = list(offers_col.find(
            {'offer_id': {'$in': top_approved_ids}, 'status': {'$in': ['active', 'running']}},
            {'offer_id': 1, 'name': 1, 'payout': 1, 'category': 1, 'network': 1, 'countries': 1, 'status': 1, 'image_url': 1, 'thumbnail_url': 1, 'type': 1}
        ))
        order_map = {oid: idx for idx, oid in enumerate(top_approved_ids)}
        offers.sort(key=lambda o: order_map.get(o.get('offer_id'), 999))
    print(f"No description: compute_top_approved_global took {time.time() - start:.4f}s")

def compute_newly_added_global():
    db = db_instance.get_db()
    offers_col = db.offers
    start = time.time()
    res = list(offers_col.find(
        {'status': {'$in': ['active', 'running']}},
        {'offer_id': 1, 'name': 1, 'payout': 1, 'category': 1, 'network': 1, 'countries': 1, 'status': 1, 'image_url': 1, 'thumbnail_url': 1, 'type': 1}
    ).sort('created_at', -1).limit(150))
    print(f"No description: compute_newly_added_global took {time.time() - start:.4f}s")

if __name__ == '__main__':
    compute_top_approved_global()
    compute_newly_added_global()
