#!/usr/bin/env python3
"""
Quick verification: Is the new code loaded?
"""

import sys
import os

# Check if the file has the new code
file_path = 'routes/postback_receiver.py'

print("\n" + "="*80)
print("🔍 CHECKING IF NEW CODE IS LOADED")
print("="*80)

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Check for key markers of the new code
has_click_lookup = "# If user_id not in postback, look it up from click record" in content
has_offer_fallback = "# Check if offer_id from postback exists in our database" in content
has_click_variable = "click = None" in content

print(f"\n✅ File: {file_path}")
print(f"   Has user_id lookup from click: {has_click_lookup}")
print(f"   Has offer_id fallback: {has_offer_fallback}")
print(f"   Has click variable: {has_click_variable}")

if has_click_lookup and has_offer_fallback and has_click_variable:
    print(f"\n✅ NEW CODE IS PRESENT IN FILE!")
else:
    print(f"\n❌ NEW CODE IS MISSING!")

# Now check if it's actually being used
print("\n" + "="*80)
print("🔍 TESTING IF CODE ACTUALLY RUNS")
print("="*80)

sys.path.insert(0, '.')
from database import db_instance
from routes.postback_receiver import calculate_offer_points_with_bonus, get_username_from_user_id

# Test with real data
click_id = "CLK-57D4BA10C801"
clicks = db_instance.get_collection('clicks')
click = clicks.find_one({'click_id': click_id})

if click:
    user_id = click.get('user_id')
    offer_id = click.get('offer_id')
    
    print(f"\n✅ Click data:")
    print(f"   user_id: {user_id}")
    print(f"   offer_id: {offer_id}")
    
    # Test functions
    username = get_username_from_user_id(user_id)
    points = calculate_offer_points_with_bonus(offer_id)
    
    print(f"\n✅ Function results:")
    print(f"   Username: {username}")
    print(f"   Points: {points['total_points']}")
    
    print(f"\n✅ EXPECTED MESSAGE:")
    print(f"   {username}: has just completed the offer {offer_id} worth {points['total_points']} points")
else:
    print(f"\n❌ Click not found: {click_id}")

print("\n" + "="*80)
