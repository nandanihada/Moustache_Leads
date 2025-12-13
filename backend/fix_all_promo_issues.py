"""
Complete diagnostic and fix for promo code issues
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import db_instance
from bson import ObjectId
from datetime import datetime

print("\n" + "="*70)
print("PROMO CODE COMPLETE DIAGNOSTIC")
print("="*70 + "\n")

promo_codes = db_instance.get_collection('promo_codes')
user_promo_codes = db_instance.get_collection('user_promo_codes')
users_collection = db_instance.get_collection('users')

# Get all promo codes
all_codes = list(promo_codes.find())
print(f"📊 Total Promo Codes: {len(all_codes)}\n")

for code in all_codes:
    print(f"\n{'='*70}")
    print(f"Code: {code['code']}")
    print(f"ID: {code['_id']}")
    print(f"Status: {code['status']}")
    print(f"Usage Count: {code.get('usage_count', 0)} / {code.get('max_uses', 0)}")
    print(f"Created: {code.get('created_at')}")
    print(f"End Date: {code.get('end_date')}")
    
    # Check if expired
    if code.get('end_date'):
        if code['end_date'] < datetime.utcnow():
            print(f"⚠️ EXPIRED (past end_date)")
    
    # Find ALL user applications (active and inactive)
    all_user_apps = list(user_promo_codes.find({
        'promo_code_id': code['_id']
    }))
    
    active_user_apps = list(user_promo_codes.find({
        'promo_code_id': code['_id'],
        'is_active': True
    }))
    
    print(f"\n📋 User Applications:")
    print(f"   Total (all): {len(all_user_apps)}")
    print(f"   Active only: {len(active_user_apps)}")
    
    if all_user_apps:
        print(f"\n   Details:")
        for i, app in enumerate(all_user_apps, 1):
            user = users_collection.find_one({'_id': app['user_id']})
            username = user.get('username', 'Unknown') if user else 'Unknown'
            
            status_icon = "✅" if app.get('is_active') else "❌"
            print(f"   {i}. {status_icon} {username}")
            print(f"      User ID: {app['user_id']}")
            print(f"      Active: {app.get('is_active', False)}")
            print(f"      Applied: {app.get('applied_at')}")
            print(f"      Bonus Earned: ${app.get('total_bonus_earned', 0)}")
            print(f"      Conversions: {app.get('conversions_count', 0)}")
            
            # Check offer applications
            offer_apps = app.get('offer_applications', [])
            if offer_apps:
                print(f"      Offers Used: {len(offer_apps)}")
            else:
                print(f"      Offers Used: 0 (not used yet)")
    else:
        print(f"   ⚠️ NO USERS HAVE APPLIED THIS CODE")

print(f"\n{'='*70}")
print("ISSUES FOUND:")
print("="*70 + "\n")

# Check for issues
issues = []

# Issue 1: Usage count mismatch
for code in all_codes:
    actual_count = user_promo_codes.count_documents({
        'promo_code_id': code['_id'],
        'is_active': True
    })
    stored_count = code.get('usage_count', 0)
    
    if actual_count != stored_count:
        issues.append({
            'type': 'usage_count_mismatch',
            'code': code['code'],
            'stored': stored_count,
            'actual': actual_count
        })

# Issue 2: Expired codes still active
for code in all_codes:
    if code.get('end_date') and code['end_date'] < datetime.utcnow():
        if code['status'] == 'active':
            issues.append({
                'type': 'expired_but_active',
                'code': code['code'],
                'end_date': code['end_date']
            })

# Issue 3: Codes at max uses still active
for code in all_codes:
    max_uses = code.get('max_uses', 0)
    usage_count = code.get('usage_count', 0)
    auto_deactivate = code.get('auto_deactivate_on_max_uses', True)
    
    if max_uses > 0 and usage_count >= max_uses and auto_deactivate:
        if code['status'] == 'active':
            issues.append({
                'type': 'max_uses_reached_but_active',
                'code': code['code'],
                'usage': usage_count,
                'max': max_uses
            })

if issues:
    for i, issue in enumerate(issues, 1):
        print(f"{i}. {issue['type'].upper()}")
        print(f"   Code: {issue['code']}")
        if 'stored' in issue:
            print(f"   Stored count: {issue['stored']}, Actual count: {issue['actual']}")
        if 'end_date' in issue:
            print(f"   End date: {issue['end_date']}")
        if 'usage' in issue:
            print(f"   Usage: {issue['usage']} / {issue['max']}")
        print()
else:
    print("✅ No issues found!")

print(f"\n{'='*70}")
print("FIXING ISSUES...")
print("="*70 + "\n")

# Fix 1: Update usage counts
print("1. Fixing usage counts...")
fixed_count = 0
for code in all_codes:
    actual_count = user_promo_codes.count_documents({
        'promo_code_id': code['_id'],
        'is_active': True
    })
    
    if code.get('usage_count', 0) != actual_count:
        promo_codes.update_one(
            {'_id': code['_id']},
            {'$set': {'usage_count': actual_count}}
        )
        print(f"   ✅ {code['code']}: {code.get('usage_count', 0)} → {actual_count}")
        fixed_count += 1

if fixed_count == 0:
    print("   ✅ All usage counts are correct")

# Fix 2: Expire old codes
print("\n2. Expiring old codes...")
result = promo_codes.update_many(
    {
        'status': 'active',
        'end_date': {'$lt': datetime.utcnow()}
    },
    {
        '$set': {
            'status': 'expired',
            'updated_at': datetime.utcnow()
        }
    }
)
print(f"   ✅ Expired {result.modified_count} codes")

# Fix 3: Auto-deactivate codes at max uses
print("\n3. Auto-deactivating codes at max uses...")
deactivated = 0
for code in promo_codes.find({'status': 'active'}):
    max_uses = code.get('max_uses', 0)
    usage_count = code.get('usage_count', 0)
    auto_deactivate = code.get('auto_deactivate_on_max_uses', True)
    
    if max_uses > 0 and usage_count >= max_uses and auto_deactivate:
        promo_codes.update_one(
            {'_id': code['_id']},
            {
                '$set': {
                    'status': 'expired',
                    'updated_at': datetime.utcnow(),
                    'auto_deactivated_at': datetime.utcnow()
                }
            }
        )
        print(f"   ✅ {code['code']}: Deactivated (reached {usage_count}/{max_uses})")
        deactivated += 1

if deactivated == 0:
    print("   ✅ No codes need deactivation")

print(f"\n{'='*70}")
print("✅ ALL FIXES COMPLETE!")
print("="*70 + "\n")
