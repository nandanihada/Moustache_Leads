#!/usr/bin/env python3
"""
Complete end-to-end test of postback forwarding
"""

import sys
sys.path.insert(0, '.')

from database import db_instance
from routes.postback_receiver import calculate_offer_points_with_bonus, get_username_from_user_id
from bson import ObjectId

print("\n" + "="*80)
print("🧪 COMPLETE POSTBACK FORWARDING TEST")
print("="*80)

# Step 1: Get SurveyTitans placement
print("\n📋 Step 1: Getting SurveyTitans placement...")
placements = db_instance.get_collection('placements')
st = placements.find_one({'_id': ObjectId('690c8d103f9cfc24ca67966f')})

if not st:
    print("❌ SurveyTitans placement not found!")
    exit(1)

print(f"✅ Found: {st.get('offerwallTitle')}")
print(f"   Postback URL: {st.get('postbackUrl')}")

# Step 2: Simulate postback
print("\n📥 Step 2: Simulating postback...")
click_id = "CLK-57D4BA10C801"
upstream_offer_id = "BJYLS"

print(f"   click_id: {click_id}")
print(f"   offer_id: {upstream_offer_id} (from upstream)")

# Step 3: Look up click
print("\n🔍 Step 3: Looking up click...")
clicks = db_instance.get_collection('clicks')
click = clicks.find_one({'click_id': click_id})

if not click:
    print("❌ Click not found!")
    exit(1)

user_id = click.get('user_id')
click_offer_id = click.get('offer_id')

print(f"✅ Click found!")
print(f"   user_id: {user_id}")
print(f"   offer_id: {click_offer_id}")

# Step 4: Check if upstream offer exists
print(f"\n🔍 Step 4: Checking upstream offer...")
offers = db_instance.get_collection('offers')
offer = offers.find_one({'offer_id': upstream_offer_id})

if not offer:
    print(f"⚠️  Upstream offer '{upstream_offer_id}' not found")
    print(f"🔄 Using offer from click: {click_offer_id}")
    offer_id_to_use = click_offer_id
else:
    offer_id_to_use = upstream_offer_id

# Step 5: Calculate points
print(f"\n💰 Step 5: Calculating points...")
points_calc = calculate_offer_points_with_bonus(offer_id_to_use)
username = get_username_from_user_id(user_id)

print(f"   Offer: {offer_id_to_use}")
print(f"   Username: {username}")
print(f"   Base points: {points_calc['base_points']}")
if points_calc['has_bonus']:
    print(f"   Bonus: {points_calc['bonus_percentage']:.1f}% = {points_calc['bonus_points']} points")
print(f"   Total points: {points_calc['total_points']}")

# Step 6: Build URL
print(f"\n📤 Step 6: Building postback URL...")
postback_url = st.get('postbackUrl')

macros = {
    '{username}': username or '',
    '{payout}': str(points_calc['total_points']),
    '{status}': 'approved',
    '{transaction_id}': click_id or '',
    '{click_id}': click_id or '',
    '{offer_id}': offer_id_to_use or '',
}

print(f"\n   Macro values:")
for macro, value in macros.items():
    print(f"      {macro} = '{value}'")

final_url = postback_url
for macro, value in macros.items():
    final_url = final_url.replace(macro, str(value))

print(f"\n   Final URL:")
print(f"   {final_url}")

# Step 7: Parse URL to show what SurveyTitans receives
print("\n" + "="*80)
print("✅ WHAT SURVEYTITANS WILL RECEIVE:")
print("="*80)

from urllib.parse import urlparse, parse_qs
parsed = urlparse(final_url)
params = parse_qs(parsed.query)

print(f"\n   URL: {parsed.scheme}://{parsed.netloc}{parsed.path}")
print(f"\n   Parameters:")
for key, value in params.items():
    print(f"      {key} = {value[0]}")

print(f"\n✅ Message displayed:")
print(f"   {username}: has just completed the offer {offer_id_to_use} worth {points_calc['total_points']} points")

print("\n" + "="*80)
print("✅ TEST COMPLETE!")
print("="*80)
