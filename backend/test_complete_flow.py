#!/usr/bin/env python3
"""
Complete flow test with the actual click data
"""

import sys
sys.path.insert(0, '.')

from database import db_instance
from routes.postback_receiver import calculate_offer_points_with_bonus, get_username_from_user_id

print("\n" + "="*80)
print("🧪 COMPLETE FLOW TEST")
print("="*80)

# Step 1: Simulate postback
click_id = "CLK-57D4BA10C801"
upstream_offer_id = "BJYLS"

print(f"\n📥 Postback received:")
print(f"   click_id: {click_id}")
print(f"   offer_id: {upstream_offer_id} (from upstream)")

# Step 2: Look up click
print(f"\n🔍 Looking up click...")
clicks = db_instance.get_collection('clicks')
click = clicks.find_one({'click_id': click_id})

if not click:
    print(f"   ❌ Click not found!")
    exit(1)

print(f"   ✅ Click found!")
user_id = click.get('user_id')
click_offer_id = click.get('offer_id')
print(f"   user_id: {user_id}")
print(f"   offer_id: {click_offer_id}")

# Step 3: Check if upstream offer exists
print(f"\n🔍 Checking upstream offer_id '{upstream_offer_id}'...")
offers = db_instance.get_collection('offers')
offer = offers.find_one({'offer_id': upstream_offer_id})

if not offer:
    print(f"   ❌ Upstream offer not found")
    print(f"   🔄 Using offer_id from click: {click_offer_id}")
    offer_id_to_use = click_offer_id
else:
    print(f"   ✅ Upstream offer found")
    offer_id_to_use = upstream_offer_id

# Step 4: Calculate points
print(f"\n💰 Calculating points for {offer_id_to_use}...")
points_calc = calculate_offer_points_with_bonus(offer_id_to_use)
print(f"   Base points: {points_calc['base_points']}")
if points_calc['has_bonus']:
    print(f"   Bonus: {points_calc['bonus_percentage']:.1f}% ({points_calc['promo_code']}) = {points_calc['bonus_points']} points")
print(f"   Total points: {points_calc['total_points']}")

# Step 5: Get username
print(f"\n👤 Getting username for '{user_id}'...")
username = get_username_from_user_id(user_id)
print(f"   Username: {username}")

# Step 6: Show result
print("\n" + "="*80)
print("📤 WHAT PARTNER WILL RECEIVE:")
print("="*80)
print(f"   username={username}")
print(f"   payout={points_calc['total_points']}")
print(f"   status=approved")
print(f"   offer_id={offer_id_to_use}")

print(f"\n✅ Message: {username}: has just completed the offer {offer_id_to_use} worth {points_calc['total_points']} points")
print("\n" + "="*80)
