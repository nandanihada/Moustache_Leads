"""
Deeper check: MobPlus offers — all possible user associations
=============================================================
Checks offer_grants, offer_access_requests, clicks, conversions,
and also active (non-deleted) MobPlus offers that already exist.

Usage:
    python migrations/check_mobplus_deeper.py
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import db_instance


def check_deeper():
    offers_col = db_instance.get_collection('offers')
    grants_col = db_instance.get_collection('offer_grants')
    access_col = db_instance.get_collection('offer_access_requests')
    clicks_col = db_instance.get_collection('clicks')
    conversions_col = db_instance.get_collection('conversions')
    
    print(f"\n{'='*70}")
    print(f"  FULL MobPlus Offer Audit")
    print(f"{'='*70}\n")
    
    # 1. How many MobPlus offers are ACTIVE (not deleted)?
    active_query = {
        'deleted': {'$ne': True},
        '$or': [
            {'network': {'$regex': 'mobplus', '$options': 'i'}},
            {'target_url': {'$regex': 'm2888\\.net', '$options': 'i'}},
            {'target_url': {'$regex': 'bolo2vas97', '$options': 'i'}},
        ]
    }
    active_count = offers_col.count_documents(active_query)
    print(f"  ✅ Active MobPlus offers (not deleted): {active_count}")
    
    # 2. How many still in recycle bin?
    deleted_query = {
        'deleted': True,
        '$or': [
            {'network': {'$regex': 'mobplus', '$options': 'i'}},
            {'target_url': {'$regex': 'm2888\\.net', '$options': 'i'}},
            {'target_url': {'$regex': 'bolo2vas97', '$options': 'i'}},
        ]
    }
    deleted_count = offers_col.count_documents(deleted_query)
    print(f"  🗑️  Deleted MobPlus offers (recycle bin): {deleted_count}")
    
    # 3. Get all deleted offer IDs
    deleted_offers = list(offers_col.find(deleted_query, {'offer_id': 1, 'name': 1, '_id': 1}))
    deleted_offer_ids = [o.get('offer_id', str(o.get('_id', ''))) for o in deleted_offers]
    
    # 4. Check grants (including inactive/expired ones)
    if grants_col is not None:
        all_grants = grants_col.count_documents({'offer_id': {'$in': deleted_offer_ids}})
        active_grants = grants_col.count_documents({'offer_id': {'$in': deleted_offer_ids}, 'is_active': True})
        print(f"\n  📋 Grants for deleted MobPlus offers:")
        print(f"     Total grants (all time): {all_grants}")
        print(f"     Active grants: {active_grants}")
    
    # 5. Check access requests (all statuses)
    if access_col is not None:
        all_access = access_col.count_documents({'offer_id': {'$in': deleted_offer_ids}})
        approved_access = access_col.count_documents({'offer_id': {'$in': deleted_offer_ids}, 'status': 'approved'})
        pending_access = access_col.count_documents({'offer_id': {'$in': deleted_offer_ids}, 'status': 'pending'})
        print(f"\n  📋 Access requests for deleted MobPlus offers:")
        print(f"     Total requests: {all_access}")
        print(f"     Approved: {approved_access}")
        print(f"     Pending: {pending_access}")
    
    # 6. Check clicks
    if clicks_col is not None:
        try:
            clicks_with_deleted = clicks_col.count_documents({'offer_id': {'$in': deleted_offer_ids}})
            print(f"\n  🖱️  Clicks on deleted MobPlus offers: {clicks_with_deleted}")
            
            # Get unique offer_ids that have clicks
            if clicks_with_deleted > 0:
                clicked_offer_ids = clicks_col.distinct('offer_id', {'offer_id': {'$in': deleted_offer_ids}})
                print(f"     Unique offers with clicks: {len(clicked_offer_ids)}")
        except Exception as e:
            print(f"\n  🖱️  Clicks check error: {e}")
    
    # 7. Check conversions
    if conversions_col is not None:
        try:
            conversions_with_deleted = conversions_col.count_documents({'offer_id': {'$in': deleted_offer_ids}})
            print(f"\n  💰 Conversions on deleted MobPlus offers: {conversions_with_deleted}")
            
            if conversions_with_deleted > 0:
                converted_offer_ids = conversions_col.distinct('offer_id', {'offer_id': {'$in': deleted_offer_ids}})
                print(f"     Unique offers with conversions: {len(converted_offer_ids)}")
        except Exception as e:
            print(f"\n  💰 Conversions check error: {e}")
    
    # 8. Check if any deleted offers had affiliates='all' (visible to everyone on offerwall)
    offerwall_visible = offers_col.count_documents({
        **deleted_query,
        '$or': [
            {'affiliates': 'all'},
            {'show_in_offerwall': True},
        ]
    })
    print(f"\n  🌐 Deleted offers that were visible on offerwall (affiliates=all or show_in_offerwall=true): {offerwall_visible}")
    
    print(f"\n{'='*70}")
    print(f"  TOTAL PICTURE")
    print(f"{'='*70}")
    print(f"  Active MobPlus offers (just restored 60): {active_count}")
    print(f"  Still in recycle bin: {deleted_count}")
    print(f"{'='*70}\n")


if __name__ == '__main__':
    check_deeper()
