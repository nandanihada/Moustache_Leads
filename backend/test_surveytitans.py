#!/usr/bin/env python3
"""
Test what SurveyTitans would receive
"""

import sys
sys.path.insert(0, '.')

from database import db_instance
from routes.postback_receiver import calculate_offer_points_with_bonus, get_username_from_user_id

print("\n" + "="*80)
print("🧪 SURVEYTITANS NOTIFICATION TEST")
print("="*80)

# Get SurveyTitans placement
placements = db_instance.get_collection('placements')
surveytitans = placements.find_one({'offerwallTitle': {'$regex': 'survey', '$options': 'i'}})

if not surveytitans:
    print("\n❌ SurveyTitans placement not found!")
    print("\n📋 Available placements:")
    all_placements = list(placements.find({'postbackUrl': {'$exists': True, '$ne': ''}}))
    for p in all_placements:
        print(f"   - {p.get('offerwallTitle')}: {p.get('postbackUrl')}")
    exit(1)

print(f"\n✅ Found placement: {surveytitans.get('offerwallTitle')}")
print(f"   Postback URL: {surveytitans.get('postbackUrl')}")

# Simulate the postback data
click_id = "CLK-57D4BA10C801"
upstream_offer_id = "BJYLS"

print(f"\n📥 Simulating postback:")
print(f"   click_id: {click_id}")
print(f"   offer_id: {upstream_offer_id}")

# Look up click
clicks = db_instance.get_collection('clicks')
click = clicks.find_one({'click_id': click_id})

if not click:
    print(f"\n❌ Click not found!")
    exit(1)

user_id = click.get('user_id')
click_offer_id = click.get('offer_id')

print(f"\n✅ Click found:")
print(f"   user_id: {user_id}")
print(f"   offer_id: {click_offer_id}")

# Check upstream offer
offers = db_instance.get_collection('offers')
offer = offers.find_one({'offer_id': upstream_offer_id})

if not offer:
    print(f"\n⚠️  Upstream offer '{upstream_offer_id}' not found")
    print(f"   🔄 Using offer from click: {click_offer_id}")
    offer_id_to_use = click_offer_id
else:
    offer_id_to_use = upstream_offer_id

# Calculate points
points_calc = calculate_offer_points_with_bonus(offer_id_to_use)
username = get_username_from_user_id(user_id)

print(f"\n💰 Points calculation:")
print(f"   Offer: {offer_id_to_use}")
print(f"   Base points: {points_calc['base_points']}")
if points_calc['has_bonus']:
    print(f"   Bonus: {points_calc['bonus_percentage']:.1f}% = {points_calc['bonus_points']} points")
print(f"   Total: {points_calc['total_points']}")

print(f"\n👤 Username: {username}")

# Build the URL
postback_url = surveytitans.get('postbackUrl', '')
macros = {
    '{click_id}': click_id,
    '{status}': 'approved',
    '{payout}': str(points_calc['total_points']),
    '{offer_id}': offer_id_to_use,
    '{user_id}': user_id,
    '{username}': username,
}

final_url = postback_url
for macro, value in macros.items():
    if value:
        final_url = final_url.replace(macro, str(value))

print("\n" + "="*80)
print("📤 WHAT SURVEYTITANS WILL RECEIVE:")
print("="*80)
print(f"\nURL: {final_url}")

print(f"\n✅ Notification message:")
print(f"   {username}: has just completed the offer {offer_id_to_use} worth {points_calc['total_points']} points")

print("\n" + "="*80)
print("✅ TEST COMPLETE!")
print("="*80)
