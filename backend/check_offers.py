#!/usr/bin/env python3
from database import db_instance

offers_col = db_instance.get_collection('offers')

# Find active public offers with rotation_running
active_rotation_offers = list(offers_col.find({
    'status': 'active',
    'access_type': 'public',
    'rotation_running': True
}, {'offer_id': 1, 'name': 1, 'countries': 1}).limit(10))

print(f'Active public rotation offers: {len(active_rotation_offers)}')
for offer in active_rotation_offers:
    print(f'  - {offer["name"]} ({offer["countries"]})')

# Check if there are active offers without rotation_running requirement
active_public_offers = list(offers_col.find({
    'status': 'active',
    'access_type': 'public'
}, {'offer_id': 1, 'name': 1, 'countries': 1}).limit(5))

print(f'\nActive public offers (any rotation status): {len(active_public_offers)}')
for offer in active_public_offers:
    print(f'  - {offer["name"]} ({offer["countries"]})')

# Let's update a few offers to have rotation_running = true for testing
print('\nUpdating some offers for smart link testing...')
update_result = offers_col.update_many(
    {
        'status': 'active',
        'access_type': 'public',
        'countries': {'$in': ['US', 'IN', 'GB']}
    },
    {'$set': {'rotation_running': True}}
)

print(f'Updated {update_result.modified_count} offers to have rotation_running = true')