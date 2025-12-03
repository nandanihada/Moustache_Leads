#!/usr/bin/env python3
"""
Test the offers API to see what's being returned
"""

import requests
import json

BASE_URL = "http://localhost:5000"
PLACEMENT_ID = "4hN81lEwE7Fw1hnI"
USER_ID = "test_user"

print("=" * 80)
print("🔍 TESTING OFFERS API")
print("=" * 80)

# Test 1: Get offers
print("\n📊 Test 1: Getting offers...")
params = {
    'placement_id': PLACEMENT_ID,
    'user_id': USER_ID
}

response = requests.get(f"{BASE_URL}/api/offerwall/offers", params=params)
print(f"Status: {response.status_code}")
print(f"Response: {json.dumps(response.json(), indent=2)}")

data = response.json()
if 'offers' in data:
    print(f"\n✅ Total offers returned: {len(data['offers'])}")
    print("\nOffers:")
    for i, offer in enumerate(data['offers'], 1):
        print(f"  {i}. {offer.get('title')} (ID: {offer.get('id')})")
        print(f"     Reward: {offer.get('reward_amount')} {offer.get('reward_currency')}")
        print(f"     Category: {offer.get('category')}")
else:
    print("❌ No offers in response")

print("\n" + "=" * 80)
