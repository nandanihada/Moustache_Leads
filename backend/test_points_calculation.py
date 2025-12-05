#!/usr/bin/env python3
"""
Test postback points calculation
"""

from database import db_instance

print("\n" + "="*80)
print("🧪 TESTING POSTBACK POINTS CALCULATION")
print("="*80)

# Test the calculation function
def calculate_offer_points_with_bonus(offer_id):
    """Calculate points from offer with bonus"""
    try:
        offers = db_instance.get_collection('offers')
        if offers is None:
            print("❌ Cannot access offers collection")
            return None
        
        offer = offers.find_one({'offer_id': offer_id})
        
        if not offer:
            print(f"❌ Offer not found: {offer_id}")
            return None
        
        # Get base points from offer
        base_points = int(offer.get('payout', 0))
        
        # Check for promo code bonus
        bonus_points = 0
        bonus_percentage = 0
        has_bonus = False
        promo_code = ''
        
        if offer.get('promo_code_id') and offer.get('bonus_amount'):
            has_bonus = True
            bonus_type = offer.get('bonus_type', 'percentage')
            bonus_amount = offer.get('bonus_amount', 0)
            promo_code = offer.get('promo_code', '')
            
            if bonus_type == 'percentage':
                bonus_points = int(base_points * (bonus_amount / 100))
                bonus_percentage = bonus_amount
            else:  # fixed
                bonus_points = int(bonus_amount)
                bonus_percentage = (bonus_amount / base_points * 100) if base_points > 0 else 0
        
        total_points = base_points + bonus_points
        
        return {
            'base_points': base_points,
            'bonus_points': bonus_points,
            'total_points': total_points,
            'bonus_percentage': bonus_percentage,
            'has_bonus': has_bonus,
            'promo_code': promo_code
        }
    except Exception as e:
        print(f"❌ Error: {e}")
        return None

# Test with a real offer
print("\n📋 Step 1: Finding an offer to test...")
offers = db_instance.get_collection('offers')
sample_offer = offers.find_one({'is_active': True})

if not sample_offer:
    print("❌ No active offers found!")
    exit(1)

offer_id = sample_offer.get('offer_id')
print(f"✅ Found offer: {offer_id} - {sample_offer.get('name')}")
print(f"   Payout: {sample_offer.get('payout')}")
print(f"   Has promo code: {bool(sample_offer.get('promo_code_id'))}")
if sample_offer.get('promo_code_id'):
    print(f"   Promo code: {sample_offer.get('promo_code')}")
    print(f"   Bonus: {sample_offer.get('bonus_amount')} ({sample_offer.get('bonus_type')})")

# Test calculation
print(f"\n📋 Step 2: Testing calculation for {offer_id}...")
result = calculate_offer_points_with_bonus(offer_id)

if result:
    print(f"\n✅ Calculation Result:")
    print(f"   Base points: {result['base_points']}")
    if result['has_bonus']:
        print(f"   Bonus: {result['bonus_percentage']:.1f}% ({result['promo_code']}) = {result['bonus_points']} points")
    print(f"   Total points: {result['total_points']}")
else:
    print("❌ Calculation failed!")

# Test with multiple offers
print(f"\n📋 Step 3: Testing with multiple offers...")
all_offers = list(offers.find({'is_active': True}).limit(5))

for offer in all_offers:
    offer_id = offer.get('offer_id')
    result = calculate_offer_points_with_bonus(offer_id)
    if result:
        bonus_str = f" + {result['bonus_points']} bonus" if result['has_bonus'] else ""
        print(f"   {offer_id}: {result['base_points']}{bonus_str} = {result['total_points']} points")

print("\n" + "="*80)
print("✅ Test complete!")
print("="*80)
