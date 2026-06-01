"""
Fix device_targeting for existing offers by detecting from offer name.
Offers with 'iOS', 'Android', 'Desktop' etc. in their name get proper targeting.
Offers with empty or 'all' device_targeting that clearly mention a platform get updated.
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from database import db_instance
import re

offers_col = db_instance.get_collection('offers')

def detect_device(name):
    """Detect device from offer name"""
    if not name:
        return None
    name_lower = name.lower()
    
    has_ios = any(kw in name_lower for kw in ['ios', 'iphone', 'ipad'])
    has_android = 'android' in name_lower
    has_desktop = any(kw in name_lower for kw in ['desktop'])
    
    if has_ios and has_android:
        return 'mobile'
    elif has_ios:
        return 'ios'
    elif has_android:
        return 'android'
    elif has_desktop:
        return 'desktop'
    return None

# Find offers with empty or 'all' device_targeting
offers = list(offers_col.find(
    {'is_active': True, '$or': [
        {'device_targeting': ''},
        {'device_targeting': 'all'},
        {'device_targeting': {'$exists': False}}
    ]},
    {'name': 1, 'offer_id': 1, 'device_targeting': 1}
))

print(f"Checking {len(offers)} offers with empty/all device_targeting...")

fixed = 0
for offer in offers:
    name = offer.get('name', '')
    detected = detect_device(name)
    
    if detected:
        offers_col.update_one(
            {'_id': offer['_id']},
            {'$set': {'device_targeting': detected}}
        )
        fixed += 1
        if fixed <= 30:
            print(f"  ✅ {offer.get('offer_id', '?'):12s} | {name[:45]:45s} → {detected}")

if fixed > 30:
    print(f"  ... and {fixed - 30} more")

print(f"\nFixed: {fixed} offers")
print(f"Unchanged: {len(offers) - fixed} offers (no device keyword in name, stays 'all')")
