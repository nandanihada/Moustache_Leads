#!/usr/bin/env python3
"""
Fix offers that have approval workflow settings but wrong affiliates field
"""

from database import db_instance

offers_collection = db_instance.get_collection('offers')

# Find all offers that need fixing
# These are offers with approval settings but affiliates != 'request'
offers_to_fix = list(offers_collection.find({
    'approval_settings': {'$exists': True},
    '$or': [
        {'approval_settings.type': {'$in': ['time_based', 'manual']}},
        {'approval_settings.require_approval': True}
    ],
    'affiliates': {'$ne': 'request'}
}))

print("\n" + "="*80)
print("🔧 FIXING OFFERS WITH APPROVAL WORKFLOW SETTINGS")
print("="*80)

if not offers_to_fix:
    print("\n✅ No offers need fixing!")
else:
    print(f"\n📋 Found {len(offers_to_fix)} offer(s) that need fixing:\n")
    
    for offer in offers_to_fix:
        print(f"  Offer ID: {offer.get('offer_id')}")
        print(f"  Name: {offer.get('name')}")
        print(f"  Current Affiliates: {offer.get('affiliates')}")
        approval_settings = offer.get('approval_settings', {})
        print(f"  Approval Type: {approval_settings.get('type')}")
        print(f"  Require Approval: {approval_settings.get('require_approval')}")
        print()
    
    # Fix them
    print("⚙️  Fixing offers...\n")
    
    for offer in offers_to_fix:
        result = offers_collection.update_one(
            {'offer_id': offer['offer_id']},
            {'$set': {'affiliates': 'request'}}
        )
        
        if result.modified_count > 0:
            print(f"  ✅ {offer['offer_id']}: Fixed (affiliates set to 'request')")
        else:
            print(f"  ❌ {offer['offer_id']}: Failed to fix")
    
    print("\n" + "="*80)
    print("✅ ALL OFFERS FIXED!")
    print("="*80)
