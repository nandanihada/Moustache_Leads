#!/usr/bin/env python3
"""
Test postback forwarding with POST data
"""

import sys
sys.path.insert(0, '.')

from database import db_instance
from routes.postback_receiver import calculate_offer_points_with_bonus, get_username_from_user_id

print("\n" + "="*80)
print("🧪 TESTING POSTBACK FORWARDING WITH POST DATA")
print("="*80)

# Test data
click_id = "CLK-TEST123"
offer_id = "ML-00063"  # Use a real offer ID from your database
user_id = "Don1"

print(f"\n📥 Test Data:")
print(f"   click_id: {click_id}")
print(f"   offer_id: {offer_id}")
print(f"   user_id: {user_id}")

# Calculate points
print(f"\n💰 Calculating points...")
points_calc = calculate_offer_points_with_bonus(offer_id)
print(f"   Base points: {points_calc['base_points']}")
if points_calc['has_bonus']:
    print(f"   Bonus: {points_calc['bonus_percentage']:.1f}% = {points_calc['bonus_points']} points")
print(f"   Total points: {points_calc['total_points']}")

# Get username
print(f"\n👤 Getting username...")
username = get_username_from_user_id(user_id)
print(f"   Username: {username}")

# Show what would be sent
print(f"\n" + "="*80)
print("📤 WHAT WILL BE SENT TO DOWNSTREAM PARTNER:")
print("="*80)

print(f"\n📍 Method: POST")
print(f"\n📦 POST Data:")
post_data = {
    'username': username or '',
    'points': str(points_calc['total_points']),
    'payout': str(points_calc['total_points']),
    'status': 'approved',
    'user_id': user_id or '',
    'offer_id': offer_id or '',
    'click_id': click_id or '',
}

for key, value in post_data.items():
    print(f"   {key}: {value}")

print(f"\n✅ Partner will receive:")
print(f"   - Username: {username}")
print(f"   - Points: {points_calc['total_points']}")
print(f"   - Status: approved")
print(f"   - Via: POST request")

print("\n" + "="*80)
print("✅ TEST COMPLETE!")
print("="*80)
