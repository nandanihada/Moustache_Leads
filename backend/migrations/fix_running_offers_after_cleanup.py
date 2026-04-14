"""
Fix: Set ALL 'running' offers to status=active so they are visible to publishers.
Uses the EXACT same data sources as the admin Running Offers API.
Run from backend/: python migrations/fix_running_offers_after_cleanup.py
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from datetime import datetime, timedelta
from database import db_instance

def get_all_running_offer_ids():
    """Exact same logic as get_running_offers() in admin_offers.py"""
    cutoff = datetime.utcnow() - timedelta(days=70)
    running_ids = set()

    # 1. Clicks
    for col_name in ('clicks', 'offerwall_clicks', 'offerwall_clicks_detailed', 'dashboard_clicks'):
        col = db_instance.get_collection(col_name)
        if col is None:
            continue
        try:
            fields = ['offer_id']
            if col_name == 'clicks':
                fields.append('offerId')
            for f in fields:
                for doc in col.aggregate([
                    {'$match': {'timestamp': {'$gte': cutoff}, f: {'$exists': True, '$ne': None}}},
                    {'$group': {'_id': f'${f}'}},
                ]):
                    if doc['_id']:
                        running_ids.add(str(doc['_id']))
        except Exception as e:
            print(f"  Warn {col_name}: {e}")
    print(f"  Clicks: {len(running_ids)}")

    # 2. Picked from search_logs
    sl = db_instance.get_collection('search_logs')
    if sl is not None:
        try:
            for doc in sl.find(
                {'searched_at': {'$gte': cutoff}, 'picked_offer_id': {'$ne': None, '$exists': True}},
                {'picked_offer_id': 1}
            ):
                pid = doc.get('picked_offer_id')
                if pid:
                    running_ids.add(str(pid))
        except Exception as e:
            print(f"  Warn search_logs: {e}")
    print(f"  After picked: {len(running_ids)}")

    # 3. Requested/approved/rejected from affiliate_requests
    ar = db_instance.get_collection('affiliate_requests')
    if ar is not None:
        try:
            for doc in ar.find({'requested_at': {'$gte': cutoff}}, {'offer_id': 1}):
                oid = doc.get('offer_id')
                if oid:
                    running_ids.add(str(oid))
        except Exception as e:
            print(f"  Warn affiliate_requests: {e}")
    print(f"  After requests: {len(running_ids)}")

    return running_ids

def fix():
    offers_col = db_instance.get_collection('offers')
    print("Finding all running offer IDs...")
    ids = get_all_running_offer_ids()

    # Add rotation state IDs
    rc = db_instance.get_collection('offer_rotation_state')
    state = rc.find_one({'_id': 'rotation_config'})
    if state:
        for r in state.get('running_offer_ids', []):
            ids.add(r)
    for d in offers_col.find({'rotation_running': True}, {'offer_id': 1}):
        ids.add(d['offer_id'])

    print(f"Total running IDs: {len(ids)}")

    q = {
        'offer_id': {'$in': list(ids)},
        'status': {'$ne': 'active'},
        '$or': [{'deleted': {'$exists': False}}, {'deleted': False}],
    }
    n = offers_col.count_documents(q)
    print(f"Currently NOT active: {n}")

    if n == 0:
        print("All already active!")
        print(f"Total active: {offers_col.count_documents({'status': 'active'})}")
        return

    r = offers_col.update_many(q, {'$set': {
        'status': 'active',
        'rotation_running': True,
        'updated_at': datetime.utcnow(),
    }})
    print(f"Restored {r.modified_count} offers to active")
    print(f"Total active now: {offers_col.count_documents({'status': 'active'})}")

if __name__ == '__main__':
    fix()
