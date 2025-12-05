#!/usr/bin/env python3
"""
Check if the test offer exists and has points
"""

from database import db_instance

print("\n" + "="*80)
print("🔍 CHECKING OFFER ML-00065")
print("="*80)

offers = db_instance.get_collection('offers')
offer = offers.find_one({'offer_id': 'ML-00065'})

if not offer:
    print("\n❌ Offer ML-00065 not found!")
    print("\n📋 Available offers:")
    all_offers = list(offers.find({'is_active': True}).limit(5))
    for o in all_offers:
        print(f"   - {o.get('offer_id')}: {o.get('name')} (payout: {o.get('payout')})")
else:
    print(f"\n✅ Offer found: {offer.get('name')}")
    print(f"   Payout: {offer.get('payout')}")
    print(f"   Has promo code: {bool(offer.get('promo_code_id'))}")
    if offer.get('promo_code_id'):
        print(f"   Promo code: {offer.get('promo_code')}")
        print(f"   Bonus: {offer.get('bonus_amount')} ({offer.get('bonus_type')})")
    
    # Test calculation
    print(f"\n💰 Points Calculation:")
    base_points = int(offer.get('payout', 0))
    print(f"   Base points: {base_points}")
    
    if offer.get('promo_code_id') and offer.get('bonus_amount'):
        bonus_type = offer.get('bonus_type', 'percentage')
        bonus_amount = offer.get('bonus_amount', 0)
        
        if bonus_type == 'percentage':
            bonus_points = int(base_points * (bonus_amount / 100))
        else:
            bonus_points = int(bonus_amount)
        
        print(f"   Bonus: {bonus_amount}{'%' if bonus_type == 'percentage' else ''} = {bonus_points} points")
        print(f"   Total: {base_points + bonus_points} points")
    else:
        print(f"   No bonus")
        print(f"   Total: {base_points} points")

print("\n" + "="*80)
