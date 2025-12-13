"""
Test: Apply a promo code and check if it shows in analytics
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import db_instance
from models.promo_code import PromoCode
from bson import ObjectId

print("\n" + "="*60)
print("TEST: Apply Promo Code & Check Analytics")
print("="*60 + "\n")

# Get a test user
users = db_instance.get_collection('users')
test_user = users.find_one({'username': 'jenny'})

if not test_user:
    print("❌ No test user found. Please create a user first.")
    exit(1)

print(f"✅ Found test user: {test_user['username']} (ID: {test_user['_id']})")

# Get an active promo code
promo_codes = db_instance.get_collection('promo_codes')
active_code = promo_codes.find_one({'status': 'active'})

if not active_code:
    print("❌ No active promo codes found. Please create one first.")
    exit(1)

print(f"✅ Found active code: {active_code['code']} (ID: {active_code['_id']})")
print(f"   Current usage_count: {active_code.get('usage_count', 0)}")

# Check if user already applied this code
user_promo_codes = db_instance.get_collection('user_promo_codes')
existing = user_promo_codes.find_one({
    'user_id': test_user['_id'],
    'promo_code_id': active_code['_id'],
    'is_active': True
})

if existing:
    print(f"\n⚠️ User already applied this code!")
    print(f"   Using existing application for test...")
    code_id = str(active_code['_id'])
else:
    print(f"\n📝 Applying code to user...")
    
    # Apply the code
    promo_model = PromoCode()
    result, error = promo_model.apply_code_to_user(
        active_code['code'],
        str(test_user['_id'])
    )
    
    if error:
        print(f"❌ Error applying code: {error}")
        exit(1)
    
    print(f"✅ Code applied successfully!")
    code_id = str(active_code['_id'])
    
    # Check updated usage_count
    updated_code = promo_codes.find_one({'_id': active_code['_id']})
    print(f"   New usage_count: {updated_code.get('usage_count', 0)}")

# Now test get_user_applications
print(f"\n🔍 Testing get_user_applications()...")
promo_model = PromoCode()
applications, total = promo_model.get_user_applications(code_id)

print(f"\nResults:")
print(f"   Total: {total}")
print(f"   Applications: {len(applications)}")

if applications:
    print(f"\n✅ SUCCESS! Applications found:")
    for i, app in enumerate(applications, 1):
        print(f"\n   {i}. Username: {app['username']}")
        print(f"      Email: {app['email']}")
        print(f"      Offer: {app['offer_name']}")
        print(f"      Bonus: ${app['bonus_earned']}")
        print(f"      Date: {app['applied_at']}")
else:
    print(f"\n❌ PROBLEM: No applications returned!")
    print(f"   Even though user applied the code.")
    
    # Debug: Check database directly
    print(f"\n🔍 Checking database directly...")
    direct_check = list(user_promo_codes.find({
        'promo_code_id': active_code['_id'],
        'is_active': True
    }))
    print(f"   Found {len(direct_check)} entries in user_promo_codes")
    
    if direct_check:
        print(f"\n   Entry details:")
        entry = direct_check[0]
        print(f"   - user_id: {entry['user_id']}")
        print(f"   - promo_code_id: {entry['promo_code_id']}")
        print(f"   - is_active: {entry.get('is_active')}")
        print(f"   - offer_applications: {entry.get('offer_applications', [])}")

print("\n" + "="*60)
print("✅ Test Complete!")
print("="*60 + "\n")
