"""
Restore MobPlus offers that have active user grants
====================================================
Restores 60 soft-deleted MobPlus offers that have been
granted/accepted by users back to active status.

Usage:
    python migrations/restore_mobplus_granted_offers.py
"""

import sys
import os
from datetime import datetime

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import db_instance


def restore_mobplus_granted_offers():
    offers_col = db_instance.get_collection('offers')
    grants_col = db_instance.get_collection('offer_grants')
    access_col = db_instance.get_collection('offer_access_requests')
    
    if offers_col is None:
        print("❌ Could not connect to offers collection")
        return
    
    # Find all deleted MobPlus offers
    query = {
        'deleted': True,
        '$or': [
            {'network': {'$regex': 'mobplus', '$options': 'i'}},
            {'network': {'$regex': 'mob.plus', '$options': 'i'}},
            {'target_url': {'$regex': 'm2888\\.net', '$options': 'i'}},
            {'target_url': {'$regex': 'mobplus', '$options': 'i'}},
            {'target_url': {'$regex': 'bolo2vas97', '$options': 'i'}},
        ]
    }
    
    deleted_mobplus = list(offers_col.find(query, {
        'offer_id': 1,
        'name': 1,
        '_id': 1,
    }))
    
    # Get all offer_ids
    offer_ids = [o.get('offer_id', str(o.get('_id', ''))) for o in deleted_mobplus]
    
    # Find which ones have grants
    granted_offer_ids = set()
    
    if grants_col is not None:
        grants = list(grants_col.find({
            'offer_id': {'$in': offer_ids},
            'is_active': True
        }, {'offer_id': 1}))
        for g in grants:
            granted_offer_ids.add(g.get('offer_id', ''))
    
    if access_col is not None:
        access_requests = list(access_col.find({
            'offer_id': {'$in': offer_ids},
            'status': 'approved'
        }, {'offer_id': 1}))
        for ar in access_requests:
            granted_offer_ids.add(ar.get('offer_id', ''))
    
    print(f"\n{'='*60}")
    print(f"  Restoring {len(granted_offer_ids)} MobPlus Offers with User Grants")
    print(f"{'='*60}\n")
    
    if not granted_offer_ids:
        print("⚠️  No offers to restore.")
        return
    
    # Restore them — set deleted=False, is_active=True, clear deleted_at
    result = offers_col.update_many(
        {
            'offer_id': {'$in': list(granted_offer_ids)},
            'deleted': True
        },
        {
            '$set': {
                'deleted': False,
                'is_active': True,
                'status': 'active',
                'updated_at': datetime.utcnow()
            },
            '$unset': {
                'deleted_at': ''
            }
        }
    )
    
    print(f"  ✅ Restored {result.modified_count} offers successfully!")
    print(f"  (Matched: {result.matched_count}, Modified: {result.modified_count})")
    print(f"\n{'='*60}\n")


if __name__ == '__main__':
    restore_mobplus_granted_offers()
