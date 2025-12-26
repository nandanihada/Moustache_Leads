"""
Check promo code user applications data
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import db_instance
from bson import ObjectId

# Get a promo code
promo_codes = db_instance.get_collection('promo_codes')
user_promo_codes = db_instance.get_collection('user_promo_codes')
users = db_instance.get_collection('users')

print("\n" + "="*60)
print("PROMO CODE USER APPLICATIONS CHECK")
print("="*60 + "\n")

# Get all promo codes
all_codes = list(promo_codes.find().limit(5))
print(f"Found {len(all_codes)} promo codes\n")

for code in all_codes:
    print(f"\n📋 Code: {code['code']}")
    print(f"   ID: {code['_id']}")
    print(f"   Status: {code['status']}")
    print(f"   Usage Count: {code.get('usage_count', 0)}")
    
    # Find users who applied this code
    user_apps = list(user_promo_codes.find({
        'promo_code_id': code['_id'],
        'is_active': True
    }))
    
    print(f"   Users Applied: {len(user_apps)}")
    
    if user_apps:
        print(f"\n   👥 User Details:")
        for i, user_app in enumerate(user_apps, 1):
            user = users.find_one({'_id': user_app['user_id']})
            username = user.get('username', 'Unknown') if user else 'Unknown'
            
            print(f"      {i}. Username: {username}")
            print(f"         User ID: {user_app['user_id']}")
            print(f"         Applied At: {user_app.get('applied_at')}")
            print(f"         Bonus Earned: ${user_app.get('total_bonus_earned', 0)}")
            print(f"         Conversions: {user_app.get('conversions_count', 0)}")
            
            # Check offer applications
            offer_apps = user_app.get('offer_applications', [])
            if offer_apps:
                print(f"         Offer Applications: {len(offer_apps)}")
                for app in offer_apps:
                    print(f"            - {app.get('offer_name')}: ${app.get('bonus_earned', 0)}")
            else:
                print(f"         Offer Applications: None (not used yet)")
    else:
        print(f"   ⚠️ No users have applied this code yet")
    
    print(f"   {'-'*50}")

print("\n" + "="*60)
print("✅ Check Complete!")
print("="*60 + "\n")

# Test the get_user_applications method
print("\n🔍 Testing get_user_applications() method...\n")

from models.promo_code import PromoCode

promo_model = PromoCode()

if all_codes:
    test_code = all_codes[0]
    print(f"Testing with code: {test_code['code']} (ID: {test_code['_id']})")
    
    applications, total = promo_model.get_user_applications(str(test_code['_id']))
    
    print(f"\nResults:")
    print(f"Total: {total}")
    print(f"Applications returned: {len(applications)}")
    
    if applications:
        print(f"\nApplications:")
        for app in applications:
            print(f"  - {app['username']}: {app['offer_name']} (${app['bonus_earned']})")
    else:
        print(f"\n⚠️ No applications returned by method")
        print(f"   This is why the admin panel shows empty!")

print("\n✅ Done!\n")
