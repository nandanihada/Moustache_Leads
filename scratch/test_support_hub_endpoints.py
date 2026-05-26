import os
import sys
import time
sys.path.append(os.path.abspath('backend'))
from database import db_instance
from bson import ObjectId

db = db_instance.get_db()

def benchmark_queries():
    # 1. Get a user ID from the database
    users_col = db_instance.get_collection('users')
    user = users_col.find_one()
    if not user:
        print("No users found in database.")
        return
    user_id = str(user['_id'])
    print(f"Benchmarking queries for user ID: {user_id} ({user.get('username')})")

    # 2. Test offer_views query
    start = time.time()
    views_col = db_instance.get_collection('offer_views')
    views = []
    if views_col is not None:
        views = list(views_col.find({'user_id': user_id}).limit(50))
    print(f"Offer views query took {time.time() - start:.4f}s, found {len(views)} items")

    # 3. Test clicks query
    start = time.time()
    clicks_col = db_instance.get_collection('clicks')
    clicks = []
    if clicks_col is not None:
        clicks = list(clicks_col.find({'$or': [{'user_id': user_id}, {'publisher_id': user_id}]}).limit(50))
    print(f"Clicks query took {time.time() - start:.4f}s, found {len(clicks)} items")

    # 4. Test login_logs query
    start = time.time()
    login_logs_col = db_instance.get_collection('login_logs')
    logs = []
    if login_logs_col is not None:
        logs = list(login_logs_col.find({'user_id': user_id}).sort('login_time', -1).limit(10))
    print(f"Login logs query took {time.time() - start:.4f}s, found {len(logs)} items")

    # 5. Test affiliate_requests query
    start = time.time()
    affiliate_requests_col = db_instance.get_collection('affiliate_requests')
    reqs = []
    if affiliate_requests_col is not None:
        reqs = list(affiliate_requests_col.find({'$or': [{'user_id': user_id}, {'user_id': ObjectId(user_id)}]}).limit(50))
    print(f"Affiliate requests query took {time.time() - start:.4f}s, found {len(reqs)} items")

    # 6. Test offer_send_history query
    start = time.time()
    history_col = db_instance.get_collection('offer_send_history')
    hist = []
    if history_col is not None:
        hist = list(history_col.find({'$or': [{'user_id': user_id}, {'recipient_user_ids': user_id}]}).limit(50))
    print(f"Offer send history query took {time.time() - start:.4f}s, found {len(hist)} items")

    # 7. Test computing global recommended collections
    start = time.time()
    offers_col = db_instance.get_collection('offers')
    active_offers_count = offers_col.count_documents({'status': {'$in': ['active', 'running']}})
    print(f"Offers count: {active_offers_count} (Took {time.time() - start:.4f}s)")

    # 8. Test compute_top_requested_global aggregation
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
        {'$project': {'offer_id': 1, 'name': 1}}
    ]
    res = list(offers_col.aggregate(pipeline, allowDiskUse=True))
    print(f"compute_top_requested_global aggregation took {time.time() - start:.4f}s, returned {len(res)} items")

if __name__ == '__main__':
    benchmark_queries()
