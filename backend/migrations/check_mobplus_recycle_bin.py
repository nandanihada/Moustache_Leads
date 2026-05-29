"""
Check MobPlus offers in recycle bin and their user grants
=========================================================
Finds all soft-deleted MobPlus offers and checks which ones
have been granted/accepted by users (via offer_grants collection).

Usage:
    python migrations/check_mobplus_recycle_bin.py
"""

import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import db_instance


def check_mobplus_recycle_bin():
    offers_col = db_instance.get_collection('offers')
    grants_col = db_instance.get_collection('offer_grants')
    
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
        'network': 1,
        'target_url': 1,
        'status': 1,
        'payout': 1,
        'countries': 1,
        'deleted_at': 1,
        'campaign_id': 1,
    }))
    
    print(f"\n{'='*70}")
    print(f"  MobPlus Offers in Recycle Bin")
    print(f"{'='*70}")
    print(f"\n📊 Total deleted MobPlus offers: {len(deleted_mobplus)}\n")
    
    if not deleted_mobplus:
        print("✅ No MobPlus offers found in recycle bin.")
        return
    
    # Get all offer_ids for these deleted offers
    offer_ids = []
    for o in deleted_mobplus:
        oid = o.get('offer_id', str(o.get('_id', '')))
        offer_ids.append(oid)
    
    # Check which ones have grants (accepted by users)
    granted_offers = set()
    grants_by_offer = {}
    
    if grants_col is not None:
        # Find grants for these offer IDs
        grants = list(grants_col.find({
            'offer_id': {'$in': offer_ids},
            'is_active': True
        }))
        
        for g in grants:
            oid = g.get('offer_id', '')
            if oid not in grants_by_offer:
                grants_by_offer[oid] = []
            grants_by_offer[oid].append(g.get('user_id', 'unknown'))
            granted_offers.add(oid)
    
    # Also check offer_access_requests for approved requests
    access_col = db_instance.get_collection('offer_access_requests')
    access_by_offer = {}
    if access_col is not None:
        access_requests = list(access_col.find({
            'offer_id': {'$in': offer_ids},
            'status': 'approved'
        }))
        for ar in access_requests:
            oid = ar.get('offer_id', '')
            if oid not in access_by_offer:
                access_by_offer[oid] = []
            access_by_offer[oid].append(ar.get('user_id', 'unknown'))
            granted_offers.add(oid)
    
    # Print results
    print(f"{'─'*70}")
    print(f"  OFFERS WITH USER GRANTS/ACCESS (should restore)")
    print(f"{'─'*70}")
    
    with_grants = []
    without_grants = []
    
    for o in deleted_mobplus:
        oid = o.get('offer_id', str(o.get('_id', '')))
        name = o.get('name', 'Unknown')[:50]
        payout = o.get('payout', 0)
        countries = ', '.join(o.get('countries', [])[:3])
        deleted_at = o.get('deleted_at', '')
        
        grant_users = grants_by_offer.get(oid, [])
        access_users = access_by_offer.get(oid, [])
        all_users = list(set(grant_users + access_users))
        
        if all_users:
            with_grants.append({
                'offer_id': oid,
                'name': name,
                'payout': payout,
                'countries': countries,
                'users': all_users,
                'deleted_at': deleted_at
            })
        else:
            without_grants.append({
                'offer_id': oid,
                'name': name,
                'payout': payout,
                'countries': countries,
                'deleted_at': deleted_at
            })
    
    if with_grants:
        print(f"\n  ✅ {len(with_grants)} offers have active user grants/access:\n")
        for i, o in enumerate(with_grants, 1):
            print(f"  {i:3d}. [{o['offer_id']:10s}] ${o['payout']:.2f} | {o['countries']:8s} | {o['name']}")
            print(f"       Users: {len(o['users'])} user(s) — {', '.join(o['users'][:5])}")
            if o['deleted_at']:
                print(f"       Deleted: {o['deleted_at']}")
            print()
    else:
        print("\n  ⚠️  No deleted MobPlus offers have active user grants.\n")
    
    print(f"{'─'*70}")
    print(f"  OFFERS WITHOUT USER GRANTS (safe to permanently delete)")
    print(f"{'─'*70}")
    print(f"\n  ❌ {len(without_grants)} offers have NO user grants:\n")
    
    for i, o in enumerate(without_grants[:20], 1):
        print(f"  {i:3d}. [{o['offer_id']:10s}] ${o['payout']:.2f} | {o['countries']:8s} | {o['name']}")
    
    if len(without_grants) > 20:
        print(f"\n  ... and {len(without_grants) - 20} more")
    
    print(f"\n{'='*70}")
    print(f"  SUMMARY")
    print(f"{'='*70}")
    print(f"  Total MobPlus in recycle bin:  {len(deleted_mobplus)}")
    print(f"  With user grants (RESTORE):    {len(with_grants)}")
    print(f"  Without grants (CAN DELETE):   {len(without_grants)}")
    print(f"{'='*70}\n")


if __name__ == '__main__':
    check_mobplus_recycle_bin()
