"""
Migration: Deactivate offers that are ONLY in the 'searched' subcategory.
These offers were incorrectly set to 'active' because they matched search keywords,
but they have no real user interaction (no clicks, picks, requests, or approvals).

Usage:
    python migrations/deactivate_searched_only_offers.py           # dry run
    python migrations/deactivate_searched_only_offers.py --execute  # actually update
"""

import sys, os, re as re_mod
from datetime import datetime, timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from database import db_instance


def run(execute=False):
    if not db_instance.is_connected():
        print("ERROR: Database not connected.")
        return

    offers_col = db_instance.get_collection('offers')
    cutoff = datetime.utcnow() - timedelta(days=30)

    # 1. Get all offer_ids with real interaction (clicks, picks, requests, approvals)
    interacted_ids = set()

    # Clicks
    for col_name in ('clicks', 'offerwall_clicks', 'offerwall_clicks_detailed'):
        col = db_instance.get_collection(col_name)
        if col is None:
            continue
        for field in ['offer_id', 'offerId']:
            try:
                for doc in col.aggregate([
                    {'$match': {'timestamp': {'$gte': cutoff}, field: {'$exists': True, '$ne': None}}},
                    {'$group': {'_id': f'${field}'}},
                ]):
                    if doc['_id']:
                        interacted_ids.add(str(doc['_id']))
            except Exception:
                pass

    print(f"Offers with clicks (30d): {len(interacted_ids)}")

    # Picked
    search_logs_col = db_instance.get_collection('search_logs')
    if search_logs_col is not None:
        try:
            for entry in search_logs_col.find(
                {'searched_at': {'$gte': cutoff}, 'picked_offer_id': {'$ne': None}},
                {'picked_offer_id': 1}
            ):
                pid = entry.get('picked_offer_id')
                if pid:
                    interacted_ids.add(str(pid))
        except Exception:
            pass

    # Requested
    requests_col = db_instance.get_collection('affiliate_requests')
    if requests_col is not None:
        try:
            for rd in requests_col.find({'requested_at': {'$gte': cutoff}}, {'offer_id': 1}):
                oid = rd.get('offer_id')
                if oid:
                    interacted_ids.add(str(oid))
        except Exception:
            pass

    # Approved (offers with approved affiliate requests)
    if requests_col is not None:
        try:
            for rd in requests_col.find({'status': 'approved'}, {'offer_id': 1}):
                oid = rd.get('offer_id')
                if oid:
                    interacted_ids.add(str(oid))
        except Exception:
            pass

    # Rotation offers (offers in the rotation pool)
    rotation_col = db_instance.get_collection('offer_rotation_state')
    if rotation_col is not None:
        try:
            state = rotation_col.find_one({})
            if state and state.get('active_offer_ids'):
                for oid in state['active_offer_ids']:
                    interacted_ids.add(str(oid))
        except Exception:
            pass

    print(f"Total offers with real interaction: {len(interacted_ids)}")

    # 2. Get all currently active offers
    active_offers = list(offers_col.find(
        {'status': 'active', '$or': [{'deleted': {'$exists': False}}, {'deleted': False}]},
        {'offer_id': 1, 'name': 1}
    ))
    active_offer_ids = {o.get('offer_id') for o in active_offers if o.get('offer_id')}

    print(f"Currently active offers: {len(active_offer_ids)}")

    # 3. Find offers that are active but have NO real interaction
    to_deactivate = active_offer_ids - interacted_ids

    print(f"Offers to deactivate (active but no interaction): {len(to_deactivate)}")

    if not to_deactivate:
        print("Nothing to deactivate.")
        return

    # Show some samples
    samples = list(offers_col.find(
        {'offer_id': {'$in': list(to_deactivate)[:10]}},
        {'offer_id': 1, 'name': 1, 'status': 1}
    ))
    print("\nSample offers to deactivate:")
    for s in samples:
        print(f"  {s.get('offer_id')} - {s.get('name', '')[:50]}")

    if not execute:
        print(f"\n=== DRY RUN — {len(to_deactivate)} offers would be deactivated. Pass --execute to apply. ===")
        return

    result = offers_col.update_many(
        {'offer_id': {'$in': list(to_deactivate)}},
        {'$set': {'status': 'inactive', 'updated_at': datetime.utcnow(), 'deactivated_reason': 'no_interaction_searched_only'}}
    )

    print(f"\nDONE: Deactivated {result.modified_count} offers.")
    print(f"Remaining active: {len(active_offer_ids) - result.modified_count}")


if __name__ == '__main__':
    execute = '--execute' in sys.argv
    run(execute=execute)
