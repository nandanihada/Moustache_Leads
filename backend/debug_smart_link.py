#!/usr/bin/env python3
from services.smart_link_service import SmartLinkService

service = SmartLinkService()

# Test getting offers for different countries
countries = ['IN', 'US', 'GB', 'CA']

print("Testing Smart Link Service Offer Selection:")
print("=" * 50)

for country in countries:
    offers = service._get_eligible_offers(country, None, None)
    print(f'{country}: Found {len(offers)} offers')
    if offers:
        for offer in offers[:2]:  # Show first 2 offers
            print(f'  - {offer.get("name", "Unknown")} → {offer.get("target_url", "No URL")}')
    print()

# Test the full select_offer method
print("Testing Full Offer Selection:")
print("=" * 30)

for country in countries:
    selected_offer = service.select_offer('demo', country, None, None)
    if selected_offer:
        print(f'{country}: Selected → {selected_offer.get("name", "Unknown")}')
        print(f'     URL: {selected_offer.get("target_url", "No URL")}')
    else:
        print(f'{country}: No offer selected')
    print()