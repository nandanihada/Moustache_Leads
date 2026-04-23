#!/usr/bin/env python3
from database import db_instance

offers_col = db_instance.get_collection('offers')

# Check what offers exist
offers = list(offers_col.find({}, {'offer_id': 1, 'name': 1, 'countries': 1, 'status': 1, 'access_type': 1, 'rotation_running': 1}))
print('Current offers in database:')
for offer in offers:
    print(f'  - {offer}')

# Test the query logic
print('\nTesting query for IN country:')
query = {
    'status': 'active',
    'access_type': 'public',
    '$and': [
        {'$or': [{'deleted': {'$exists': False}}, {'deleted': False}]},
        {'$or': [
            {'rotation_running': True},
            {'rotation_batch_index': {'$exists': True}}
        ]},
        {'$or': [
            {'countries': 'IN'},
            {'countries': 'IN'.lower()},
            {'allowed_countries': 'IN'},
            {'allowed_countries': 'IN'.lower()},
            {'countries': {'$exists': False}},
            {'countries': []}
        ]}
    ]
}

matching_offers = list(offers_col.find(query, {'offer_id': 1, 'name': 1, 'countries': 1}))
print(f'Offers matching IN query: {len(matching_offers)}')
for offer in matching_offers:
    print(f'  - {offer}')

# Test US query
print('\nTesting query for US country:')
us_query = {
    'status': 'active',
    'access_type': 'public',
    '$and': [
        {'$or': [{'deleted': {'$exists': False}}, {'deleted': False}]},
        {'$or': [
            {'rotation_running': True},
            {'rotation_batch_index': {'$exists': True}}
        ]},
        {'$or': [
            {'countries': 'US'},
            {'countries': 'US'.lower()},
            {'allowed_countries': 'US'},
            {'allowed_countries': 'US'.lower()},
            {'countries': {'$exists': False}},
            {'countries': []}
        ]}
    ]
}

us_offers = list(offers_col.find(us_query, {'offer_id': 1, 'name': 1, 'countries': 1}))
print(f'Offers matching US query: {len(us_offers)}')
for offer in us_offers:
    print(f'  - {offer}')