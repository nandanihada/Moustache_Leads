import os
import sys
import time
sys.path.append(os.path.abspath('backend'))
from database import db_instance

# Replicate the functions to test their speed directly
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
            {'offer_id': 1, 'name': 1, 'payout': 1, 'category': 1, 'network': 1, 'countries': 1, 'status': 1, 'image_url': 1, 'thumbnail_url': 1, 'type': 1, 'description': 1}
        ))
        order_map = {oid: idx for idx, oid in enumerate(top_approved_ids)}
        offers.sort(key=lambda o: order_map.get(o.get('offer_id'), 999))
    print(f"compute_top_approved_global took {time.time() - start:.4f}s")

def compute_top_clicked_global():
    db = db_instance.get_db()
    clicks_col = db.clicks
    offers_col = db.offers
    start = time.time()
    click_agg = list(clicks_col.aggregate([
        {'$group': {'_id': '$offer_id', 'click_count': {'$sum': 1}}},
        {'$sort': {'click_count': -1}},
        {'$limit': 150}
    ]))
    top_clicked_ids = [c['_id'] for c in click_agg if c.get('_id')]
    if top_clicked_ids:
        offers = list(offers_col.find(
            {'offer_id': {'$in': top_clicked_ids}, 'status': {'$in': ['active', 'running']}},
            {'offer_id': 1, 'name': 1, 'payout': 1, 'category': 1, 'network': 1, 'countries': 1, 'status': 1, 'image_url': 1, 'thumbnail_url': 1, 'type': 1, 'description': 1}
        ))
        click_order = {oid: idx for idx, oid in enumerate(top_clicked_ids)}
        offers.sort(key=lambda o: click_order.get(o.get('offer_id'), 999))
    print(f"compute_top_clicked_global took {time.time() - start:.4f}s")

def compute_newly_added_global():
    db = db_instance.get_db()
    offers_col = db.offers
    start = time.time()
    res = list(offers_col.find(
        {'status': {'$in': ['active', 'running']}},
        {'offer_id': 1, 'name': 1, 'payout': 1, 'category': 1, 'network': 1, 'countries': 1, 'status': 1, 'image_url': 1, 'thumbnail_url': 1, 'type': 1, 'description': 1}
    ).sort('created_at', -1).limit(150))
    print(f"compute_newly_added_global took {time.time() - start:.4f}s")

def compute_high_payout_global():
    db = db_instance.get_db()
    offers_col = db.offers
    start = time.time()
    res = list(offers_col.find(
        {'status': {'$in': ['active', 'running']}},
        {'offer_id': 1, 'name': 1, 'payout': 1, 'category': 1, 'network': 1, 'countries': 1, 'status': 1, 'image_url': 1, 'thumbnail_url': 1, 'type': 1, 'description': 1}
    ).sort('payout', -1).limit(150))
    print(f"compute_high_payout_global took {time.time() - start:.4f}s")

def compute_top_requested_global():
    db = db_instance.get_db()
    offers_col = db.offers
    start = time.time()
    pipeline = [
        {'$match': {'status': {'$in': ['active', 'running']}}},
        {'$lookup': {
            'from': 'affiliate_requests',
            'localField': 'offer_id',
            'foreignField': 'offer_id',
            'as': 'requests'
        }},
        {'$addFields': {'req_count': {'$size': '$requests'}}},
        {'$sort': {'req_count': -1}},
        {'$limit': 150},
        {'$project': {'offer_id': 1, 'name': 1, 'payout': 1, 'category': 1, 'network': 1, 'countries': 1, 'status': 1, 'image_url': 1, 'thumbnail_url': 1, 'type': 1, 'description': 1}}
    ]
    res = list(offers_col.aggregate(pipeline, allowDiskUse=True))
    print(f"compute_top_requested_global took {time.time() - start:.4f}s")

if __name__ == '__main__':
    compute_top_approved_global()
    compute_top_clicked_global()
    compute_newly_added_global()
    compute_high_payout_global()
    compute_top_requested_global()
