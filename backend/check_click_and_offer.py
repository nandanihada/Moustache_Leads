#!/usr/bin/env python3
"""
Check what's in the click record for the test click
"""

from database import db_instance

print("\n" + "="*80)
print("🔍 CHECKING CLICK RECORD")
print("="*80)

# Check the specific click
click_id = "CLK-57D4BA10C801"
clicks = db_instance.get_collection('clicks')

click = clicks.find_one({'click_id': click_id})

if not click:
    print(f"\n❌ Click not found: {click_id}")
    print("\n📋 Recent clicks:")
    recent = list(clicks.find().sort('timestamp', -1).limit(5))
    for c in recent:
        print(f"   - {c.get('click_id')}: user={c.get('user_id')}, offer={c.get('offer_id')}")
else:
    print(f"\n✅ Click found: {click_id}")
    print(f"\nClick Data:")
    print(f"   click_id: {click.get('click_id')}")
    print(f"   user_id: {click.get('user_id')}")
    print(f"   offer_id: {click.get('offer_id')}")
    print(f"   sub1: {click.get('sub1')}")
    print(f"   sub2: {click.get('sub2')}")
    print(f"   timestamp: {click.get('timestamp')}")
    
    # Check if user exists
    user_id = click.get('user_id')
    if user_id:
        users = db_instance.get_collection('users')
        user = users.find_one({'_id': user_id}) or users.find_one({'username': user_id})
        if user:
            print(f"\n✅ User found:")
            print(f"   Username: {user.get('username')}")
        else:
            print(f"\n⚠️  User not found in database: {user_id}")

# Check the offer
print("\n" + "="*80)
print("🔍 CHECKING OFFER ML-00057")
print("="*80)

offers = db_instance.get_collection('offers')
offer = offers.find_one({'offer_id': 'ML-00057'})

if not offer:
    print("\n❌ Offer ML-00057 not found!")
else:
    print(f"\n✅ Offer found: {offer.get('name')}")
    print(f"   offer_id: {offer.get('offer_id')}")
    print(f"   campaign_id: {offer.get('campaign_id')}")
    print(f"   payout: {offer.get('payout')}")
    print(f"   promo_code_id: {offer.get('promo_code_id')}")
    if offer.get('promo_code_id'):
        print(f"   promo_code: {offer.get('promo_code')}")
        print(f"   bonus_amount: {offer.get('bonus_amount')}")
        print(f"   bonus_type: {offer.get('bonus_type')}")

print("\n" + "="*80)
