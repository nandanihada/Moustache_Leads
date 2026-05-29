"""Check all active MobPlus offers"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from database import db_instance

offers_col = db_instance.get_collection('offers')
grants_col = db_instance.get_collection('offer_grants')
clicks_col = db_instance.get_collection('clicks')

# Check ALL active (non-deleted) offers that could be mobplus
print('=== Active offers by network name pattern ===')
for p in ['mobplus', 'mob plus', 'mob_plus', 'MobPlus', 'Mobplus']:
    count = offers_col.count_documents({'deleted': {'$ne': True}, 'network': {'$regex': p, '$options': 'i'}})
    if count > 0:
        print(f'  network ~= "{p}": {count}')

# Also check by URL patterns
print('\n=== Active offers by URL pattern ===')
for p in ['m2888', 'bolo2vas97', 'mobplus', 'mob.mobplus']:
    count = offers_col.count_documents({'deleted': {'$ne': True}, 'target_url': {'$regex': p, '$options': 'i'}})
    if count > 0:
        print(f'  target_url ~= "{p}": {count}')

# Total unique active mobplus offers
all_active = list(offers_col.find({
    'deleted': {'$ne': True},
    '$or': [
        {'network': {'$regex': 'mobplus', '$options': 'i'}},
        {'target_url': {'$regex': 'm2888', '$options': 'i'}},
        {'target_url': {'$regex': 'bolo2vas97', '$options': 'i'}},
    ]
}, {'offer_id': 1, 'name': 1, 'network': 1, 'status': 1, 'payout': 1, 'countries': 1, 'affiliates': 1, 'show_in_offerwall': 1}))

print(f'\n=== TOTAL active MobPlus offers: {len(all_active)} ===')

# Check which have grants
active_ids = [o.get('offer_id', str(o.get('_id', ''))) for o in all_active]
granted_ids = set()
if grants_col is not None:
    grants = list(grants_col.find({'offer_id': {'$in': active_ids}, 'is_active': True}, {'offer_id': 1}))
    granted_ids = set(g['offer_id'] for g in grants)

# Check which have clicks
clicked_ids = set()
if clicks_col is not None:
    clicked = clicks_col.distinct('offer_id', {'offer_id': {'$in': active_ids}})
    clicked_ids = set(clicked)

print(f'\n=== Breakdown of {len(all_active)} active MobPlus offers ===')
print(f'  With active grants: {len([o for o in all_active if o.get("offer_id") in granted_ids])}')
print(f'  With clicks: {len([o for o in all_active if o.get("offer_id") in clicked_ids])}')
print(f'  No grants, no clicks: {len([o for o in all_active if o.get("offer_id") not in granted_ids and o.get("offer_id") not in clicked_ids])}')

# List all 
print(f'\n=== All {len(all_active)} active MobPlus offers ===')
for i, o in enumerate(all_active, 1):
    oid = o.get('offer_id', '')
    name = o.get('name', '')[:50]
    payout = o.get('payout', 0)
    status = o.get('status', '?')
    countries = ', '.join((o.get('countries') or [])[:3])
    has_grant = '✅GRANT' if oid in granted_ids else ''
    has_click = '🖱️CLICK' if oid in clicked_ids else ''
    affiliates = o.get('affiliates', '')
    offerwall = '🌐OW' if o.get('show_in_offerwall') else ''
    print(f'  {i:3d}. [{oid:10s}] {status:8s} ${payout:.2f} | {countries:8s} | {has_grant} {has_click} {offerwall} | {name}')
