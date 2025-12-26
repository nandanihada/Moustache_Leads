"""
Fix: Reactivate user promo code applications and update counts
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import db_instance
from datetime import datetime

print("\n" + "="*70)
print("FIXING USER PROMO CODE APPLICATIONS")
print("="*70 + "\n")

user_promo_codes = db_instance.get_collection('user_promo_codes')
promo_codes = db_instance.get_collection('promo_codes')

# Step 1: Find and fix inactive applications that should be active
print("Step 1: Reactivating valid user applications...\n")

# Get all inactive applications
inactive_apps = list(user_promo_codes.find({'is_active': False}))
print(f"Found {len(inactive_apps)} inactive applications\n")

reactivated = 0
for app in inactive_apps:
    # Get the promo code
    code = promo_codes.find_one({'_id': app['promo_code_id']})
    
    if not code:
        continue
    
    # Check if code is still valid (not expired)
    if code['status'] in ['active', 'paused']:
        # Check if this is the only application for this user+code combo
        other_active = user_promo_codes.find_one({
            'user_id': app['user_id'],
            'promo_code_id': app['promo_code_id'],
            'is_active': True,
            '_id': {'$ne': app['_id']}
        })
        
        if not other_active:
            # Reactivate this one
            user_promo_codes.update_one(
                {'_id': app['_id']},
                {'$set': {'is_active': True}}
            )
            print(f"✅ Reactivated: User {app['user_id']} - Code {code['code']}")
            reactivated += 1

print(f"\n✅ Reactivated {reactivated} applications\n")

# Step 2: Update usage counts for all codes
print("Step 2: Updating usage counts...\n")

all_codes = list(promo_codes.find())
updated = 0

for code in all_codes:
    # Count active applications
    actual_count = user_promo_codes.count_documents({
        'promo_code_id': code['_id'],
        'is_active': True
    })
    
    current_count = code.get('usage_count', 0)
    
    if actual_count != current_count:
        promo_codes.update_one(
            {'_id': code['_id']},
            {'$set': {'usage_count': actual_count, 'updated_at': datetime.utcnow()}}
        )
        print(f"✅ {code['code']}: {current_count} → {actual_count}")
        updated += 1

if updated == 0:
    print("✅ All usage counts are correct")

print(f"\n✅ Updated {updated} codes\n")

# Step 3: Show summary
print("="*70)
print("SUMMARY")
print("="*70 + "\n")

for code in promo_codes.find():
    active_apps = user_promo_codes.count_documents({
        'promo_code_id': code['_id'],
        'is_active': True
    })
    
    if active_apps > 0:
        print(f"Code: {code['code']}")
        print(f"  Status: {code['status']}")
        print(f"  Usage: {code.get('usage_count', 0)} / {code.get('max_uses', 0)}")
        print(f"  Active Applications: {active_apps}")
        print()

print("="*70)
print("✅ ALL DONE!")
print("="*70 + "\n")
