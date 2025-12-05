#!/usr/bin/env python3
"""
Local test: Simulate postback and check what gets forwarded
"""

import sys
sys.path.insert(0, '.')

from database import db_instance
from routes.postback_receiver import calculate_offer_points_with_bonus, get_username_from_user_id

print("\n" + "="*80)
print("🧪 LOCAL POSTBACK TEST")
print("="*80)

# Simulate the postback data
print("\n📥 Simulating postback from upstream:")
postback_params = {
    'click_id': 'CLK-57D4BA10C801',
    'offer_id': 'BJYLS',  # Upstream's offer ID
    # Note: No user_id in postback!
}
print(f"   click_id: {postback_params['click_id']}")
print(f"   offer_id: {postback_params['offer_id']}")
print(f"   user_id: (not provided)")

# Step 1: Look up click
print("\n🔍 Step 1: Looking up click record...")
clicks = db_instance.get_collection('clicks')
click = clicks.find_one({'click_id': postback_params['click_id']})

if not click:
    print(f"   ❌ Click not found: {postback_params['click_id']}")
else:
    print(f"   ✅ Click found!")
    user_id = click.get('user_id') or click.get('username') or click.get('sub2')
    offer_id_from_click = click.get('offer_id')
    print(f"   user_id from click: {user_id}")
    print(f"   offer_id from click: {offer_id_from_click}")
    
    # Step 2: Determine which offer_id to use
    print("\n🔍 Step 2: Determining offer_id...")
    # Try upstream's offer_id first
    offers = db_instance.get_collection('offers')
    offer = offers.find_one({'offer_id': postback_params['offer_id']})
    
    if not offer:
        print(f"   ⚠️  Upstream offer_id '{postback_params['offer_id']}' not found")
        print(f"   🔄 Trying offer_id from click: {offer_id_from_click}")
        offer = offers.find_one({'offer_id': offer_id_from_click})
        if offer:
            print(f"   ✅ Found offer by click's offer_id!")
            offer_id_to_use = offer_id_from_click
        else:
            print(f"   ❌ Offer not found by either ID")
            offer_id_to_use = None
    else:
        print(f"   ✅ Found offer by upstream's offer_id")
        offer_id_to_use = postback_params['offer_id']
    
    if offer_id_to_use:
        # Step 3: Calculate points
        print(f"\n💰 Step 3: Calculating points for {offer_id_to_use}...")
        points_calc = calculate_offer_points_with_bonus(offer_id_to_use)
        print(f"   Base points: {points_calc['base_points']}")
        if points_calc['has_bonus']:
            print(f"   Bonus: {points_calc['bonus_percentage']:.1f}% = {points_calc['bonus_points']} points")
        print(f"   Total points: {points_calc['total_points']}")
        
        # Step 4: Get username
        print(f"\n👤 Step 4: Getting username for user_id: {user_id}...")
        username = get_username_from_user_id(user_id)
        print(f"   Username: {username}")
        
        # Step 5: Show what would be sent
        print("\n" + "="*80)
        print("📤 WHAT WOULD BE SENT TO PARTNER:")
        print("="*80)
        print(f"   username={username}")
        print(f"   payout={points_calc['total_points']}")
        print(f"   status=approved")
        print(f"   offer_id={offer_id_to_use}")
        
        print("\n✅ Partner would receive:")
        print(f"   {username}: has just completed the offer {offer_id_to_use} worth {points_calc['total_points']} points")

print("\n" + "="*80)
