#!/usr/bin/env python3
from database import db_instance

offers_col = db_instance.get_collection('offers')

# Create test offers for different countries
test_offers = [
    {
        'offer_id': 'INDIA_OFFER_001',
        'name': 'Special Offer for India',
        'target_url': 'https://example.com/india-exclusive-offer',
        'countries': ['IN'],
        'device_targeting': 'all',
        'status': 'active',
        'access_type': 'public',
        'rotation_running': True,
        'payout': 2.50,
        'currency': 'USD',
        'category': 'SPECIAL',
        'created_at': '2024-01-01T00:00:00Z'
    },
    {
        'offer_id': 'US_OFFER_001',
        'name': 'Premium US Offer',
        'target_url': 'https://example.com/us-premium-offer',
        'countries': ['US'],
        'device_targeting': 'all',
        'status': 'active',
        'access_type': 'public',
        'rotation_running': True,
        'payout': 3.00,
        'currency': 'USD',
        'category': 'PREMIUM',
        'created_at': '2024-01-01T00:00:00Z'
    },
    {
        'offer_id': 'UK_OFFER_001',
        'name': 'UK Exclusive Deal',
        'target_url': 'https://example.com/uk-exclusive-deal',
        'countries': ['GB'],
        'device_targeting': 'all',
        'status': 'active',
        'access_type': 'public',
        'rotation_running': True,
        'payout': 2.75,
        'currency': 'USD',
        'category': 'EXCLUSIVE',
        'created_at': '2024-01-01T00:00:00Z'
    },
    {
        'offer_id': 'GLOBAL_OFFER_001',
        'name': 'Global Fallback Offer',
        'target_url': 'https://example.com/global-fallback',
        'countries': [],  # Empty array = global offer
        'device_targeting': 'all',
        'status': 'active',
        'access_type': 'public',
        'rotation_running': True,
        'payout': 1.50,
        'currency': 'USD',
        'category': 'GLOBAL',
        'created_at': '2024-01-01T00:00:00Z'
    }
]

try:
    result = offers_col.insert_many(test_offers)
    print(f'✅ Inserted {len(result.inserted_ids)} test offers')
    for offer in test_offers:
        countries = offer['countries'] if offer['countries'] else ['GLOBAL']
        print(f'   - {offer["name"]} → {offer["target_url"]}')
        print(f'     Countries: {countries}')
        print(f'     Payout: ${offer["payout"]} {offer["currency"]}')
except Exception as e:
    print(f'❌ Error inserting offers: {str(e)}')