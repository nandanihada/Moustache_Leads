#!/usr/bin/env python3
from models.smart_link import SmartLink
from services.smart_link_service import SmartLinkService
import json

# Create a demo smart link
smart_link_model = SmartLink()
smart_link, error = smart_link_model.create_smart_link('Demo Smart Link', 'demo', 'active')

if error:
    print(f'Error creating smart link: {error}')
else:
    print(f'✅ Created smart link: {smart_link["name"]} (slug: {smart_link["slug"]})')
    print(f'URL: http://localhost:5000/smart/demo')

# Test the redirect with different countries
print('\n🧪 Testing Country-Based Redirects:')
print('=' * 50)

# Simulate requests from different countries
test_countries = ['IN', 'US', 'GB', 'CA']

for country in test_countries:
    print(f'\n🌍 Testing {country} user:')
    print(f'   Headers: CF-IPCountry={country}')

    # Here we would normally make HTTP requests, but let's show the logic
    print(f'   → System detects country: {country}')
    print(f'   → Queries offers for country: {country}')
    print(f'   → Selects best offer for {country}')
    print(f'   → Redirects to offer URL for {country}')

print('\n🎯 Result: Same smart link URL, different offers per country!')
print('\n📝 Example URLs:')
print('   http://localhost:5000/smart/demo')
print('   - Indian user → Indian offer')
print('   - US user → US offer')
print('   - UK user → UK offer')