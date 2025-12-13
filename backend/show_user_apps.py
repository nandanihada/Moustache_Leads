"""
Simple check: Show which users applied which codes
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import db_instance

user_promo_codes = db_instance.get_collection('user_promo_codes')
users = db_instance.get_collection('users')
promo_codes = db_instance.get_collection('promo_codes')

print("\nUSER PROMO CODE APPLICATIONS:\n")
print("="*60)

# Get all user applications
all_apps = list(user_promo_codes.find())

print(f"Total applications in database: {len(all_apps)}\n")

for app in all_apps:
    # Get user
    user = users.find_one({'_id': app['user_id']})
    username = user.get('username') if user else 'Unknown'
    
    # Get code
    code = promo_codes.find_one({'_id': app['promo_code_id']})
    code_name = code.get('code') if code else 'Unknown'
    
    active_status = "✅ ACTIVE" if app.get('is_active') else "❌ INACTIVE"
    
    print(f"User: {username}")
    print(f"Code: {code_name}")
    print(f"Status: {active_status}")
    print(f"Applied: {app.get('applied_at')}")
    print("-" * 60)

print("\n✅ Done!\n")
