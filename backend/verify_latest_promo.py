"""
Verify the latest promo code application
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import db_instance
from datetime import datetime, timedelta

print("\n" + "="*70)
print("LATEST PROMO CODE APPLICATIONS")
print("="*70 + "\n")

user_promo_codes = db_instance.get_collection('user_promo_codes')
users = db_instance.get_collection('users')
promo_codes = db_instance.get_collection('promo_codes')

# Get applications from last 5 minutes
five_mins_ago = datetime.utcnow() - timedelta(minutes=5)

recent_apps = list(user_promo_codes.find({
    'applied_at': {'$gte': five_mins_ago}
}).sort('applied_at', -1))

print(f"Applications in last 5 minutes: {len(recent_apps)}\n")

if recent_apps:
    for app in recent_apps:
        user = users.find_one({'_id': app['user_id']})
        code = promo_codes.find_one({'_id': app['promo_code_id']})
        
        username = user.get('username') if user else 'Unknown'
        code_name = code.get('code') if code else 'Unknown'
        code_usage = code.get('usage_count', 0) if code else 0
        code_max = code.get('max_uses', 0) if code else 0
        
        print(f"✅ User: {username}")
        print(f"   Code: {code_name}")
        print(f"   Code Usage: {code_usage} / {code_max}")
        print(f"   Applied: {app.get('applied_at')}")
        print(f"   Active: {app.get('is_active')}")
        print(f"   Code ID: {app['promo_code_id']}")
        print()
else:
    print("⚠️ No recent applications found\n")

# Show all active codes with their current usage
print("="*70)
print("ALL ACTIVE PROMO CODES - CURRENT STATUS")
print("="*70 + "\n")

active_codes = list(promo_codes.find({'status': 'active'}))

for code in active_codes:
    active_apps = user_promo_codes.count_documents({
        'promo_code_id': code['_id'],
        'is_active': True
    })
    
    print(f"Code: {code['code']}")
    print(f"  ID: {code['_id']}")
    print(f"  Usage Count (stored): {code.get('usage_count', 0)}")
    print(f"  Active Applications (actual): {active_apps}")
    print(f"  Max Uses: {code.get('max_uses', 0)}")
    print(f"  Status: {code['status']}")
    
    if code.get('usage_count', 0) != active_apps:
        print(f"  ⚠️ MISMATCH! Stored: {code.get('usage_count', 0)}, Actual: {active_apps}")
    
    print()

print("="*70)
print("✅ Done!")
print("="*70 + "\n")
