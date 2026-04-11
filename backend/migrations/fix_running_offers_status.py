"""
Migration: Mark running offers as 'active', EXCEPT those only in the 'searched' subcategory.

Usage:
    python migrations/fix_running_offers_status.py           # dry run
    python migrations/fix_running_offers_status.py --execute  # actually update
"""

import sys
import os
import re as re_mod
from datetime import datetime, timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import db_instance


def get_running_offer_ids(days=70):
    cutoff = datetime.utcnow() - timedelta(days=days)

    # 1. Offers with clicks
    click_ids = set()
    for col_name in ('clicks', 'offerwall_clicks', 'offerwall_clicks_detailed', 'dashboard_clicks'):
        col = db_instance.get_collection(col_name)
        if col is None:
            continue
        fields = ['offer_id']
        if col_name == 'clicks':
            fields.append('offerId')
        for field in fields:
            try:
                for doc in col.aggregate([
                    {'$match': {'timestamp': {'$gte': cutoff}, field: {'$exists': True, '$ne': None}}},
                    {'$group': {'_id': f'${field}'}},
                ]):
                    oid = str(doc['_id']) if doc['_id'] else None
                    if oid:
                        click_ids.add(oid)
            except Exception as e:
                print(f"  WARN: Failed querying {col_name}.{field}: {e}")

    print(f"  Offers with clicks: {len(click_ids)}")

    # 2. Picked offers
    picked_ids = set()
    search_logs_col = db_instance.get_collection('search_logs')
    if search_logs_col is not None:
        try:
            for entry in search_logs_col.find(
                {'searched_at': {'$gte': cutoff}, 'picked_offer_id': {'$ne': None, '$exists': True}},
                {'picked_offer_id': 1}
            ):
                pid = entry.get('picked_offer_id')
                if pid:
                    picked_ids.add(str(pid))
        except Exception as e:
            print(f"  WARN: Failed querying picked: {e}")

    print(f"  Picked offers: {len(picked_ids)}")

    # 3. Requested
    requested_ids = set()
    requests_col = db_instance.get_collection('affiliate_requests')
    if requests_col is not None:
        try:
            for rd in requests_col.find({'requested_at': {'$gte': cutoff}}, {'offer_id': 1}):
                oid = rd.get('offer_id')
                if oid:
                    requested_ids.add(str(oid))
        except Exception as e:
            print(f"  WARN: Failed querying requests: {e}")

    print(f"  Requested offers: {len(requested_ids)}")

    # 4. Searched offers (keyword match)
    searched_ids = set()
    offers_col = db_instance.get_collection('offers')
    if search_logs_col is not None and offers_col is not None:
        try:
            keywords = set()
            for entry in search_logs_col.find({'searched_at': {'$gte': cutoff}}, {'keyword': 1}):
                kw = (entry.get('keyword') or '').strip()
                if kw:
                    keywords.add(kw)

            if keywords:
                conditions = []
                for kw in list(keywords)[:200]:
                    escaped = re_mod.escape(kw)
                    conditions.append({'name': {'$regex': escaped, '$options': 'i'}})
                    conditions.append({'offer_id': {'$regex': escaped, '$options': 'i'}})

                for m in offers_col.find(
                    {'$or': conditions, '$and': [{'$or': [{'deleted': {'$exists': False}}, {'deleted': False}]}]},
                    {'offer_id': 1}
                ):
                    oid = m.get('offer_id')
                    if oid:
                        searched_ids.add(oid)
        except Exception as e:
            print(f"  WARN: Failed querying searched: {e}")

    print(f"  Searched offers (keyword match): {len(searched_ids)}")

    # Compute sets
    directly_interacted = click_ids | picked_ids | requested_ids
    searched_only = searched_ids - directly_interacted
    all_running = directly_interacted | searched_ids
    to_activate = all_running - searched_only

    print(f"\n  Total running offers: {len(all_running)}")
    print(f"  Searched-only (will NOT activate): {len(searched_only)}")
    print(f"  Offers to mark active: {len(to_activate)}")

    return to_activate, searched_only


def run(execute=False):
    if not db_instance.is_connected():
        print("ERROR: Database not connected. Check MONGODB_URI.")
        return

    print("Gathering running offer IDs...")
    to_activate, searched_only = get_running_offer_ids()

    if not to_activate:
        print("No offers to update.")
        return

    offers_col = db_instance.get_collection('offers')

    # Show current status distribution
    print("\nCurrent status distribution of offers to activate:")
    for doc in offers_col.aggregate([
        {'$match': {'offer_id': {'$in': list(to_activate)}}},
        {'$group': {'_id': '$status', 'count': {'$sum': 1}}}
    ]):
        print(f"  {doc['_id']}: {doc['count']}")

    if not execute:
        print("\n=== DRY RUN — no changes made. Pass --execute to apply. ===")
        return

    result = offers_col.update_many(
        {
            'offer_id': {'$in': list(to_activate)},
            '$or': [{'deleted': {'$exists': False}}, {'deleted': False}]
        },
        {'$set': {'status': 'active', 'updated_at': datetime.utcnow()}}
    )

    print(f"\nDONE: Updated {result.modified_count} offers to 'active'.")
    print(f"Skipped {len(searched_only)} searched-only offers.")


if __name__ == '__main__':
    execute = '--execute' in sys.argv
    run(execute=execute)
