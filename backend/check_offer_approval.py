#!/usr/bin/env python3
"""
Quick diagnostic to check offer approval settings
"""

from database import db_instance

# Get the offer
offers_collection = db_instance.get_collection('offers')
offer = offers_collection.find_one({'name': {'$regex': 'offer workflow test', '$options': 'i'}})

if offer:
    print("\n" + "="*80)
    print("📋 OFFER DETAILS: Offer workflow test")
    print("="*80)
    print(f"\nOffer ID: {offer.get('offer_id')}")
    print(f"Name: {offer.get('name')}")
    print(f"Status: {offer.get('status')}")
    print(f"Approval Status: {offer.get('approval_status', 'NOT SET')}")
    print(f"\n🔑 CRITICAL FIELD - Affiliates: {offer.get('affiliates', 'NOT SET')}")
    print(f"\n📋 Approval Settings:")
    approval_settings = offer.get('approval_settings', {})
    print(f"  - Type: {approval_settings.get('type', 'NOT SET')}")
    print(f"  - Require Approval: {approval_settings.get('require_approval', 'NOT SET')}")
    print(f"  - Auto-approve Delay: {approval_settings.get('auto_approve_delay', 'NOT SET')}")
    print(f"  - Approval Message: {approval_settings.get('approval_message', 'NOT SET')}")
    print(f"  - Max Inactive Days: {approval_settings.get('max_inactive_days', 'NOT SET')}")
    
    print(f"\n📊 Other Fields:")
    print(f"  - Created At: {offer.get('created_at')}")
    print(f"  - Created By: {offer.get('created_by')}")
    print(f"  - Is Active: {offer.get('is_active')}")
    
    print("\n" + "="*80)
    print("🔍 ANALYSIS:")
    print("="*80)
    
    affiliates = offer.get('affiliates', 'all')
    if affiliates == 'request':
        print("✅ Affiliates is correctly set to 'request'")
        print("   Publishers should NOT have access without approval")
    else:
        print(f"❌ Affiliates is set to '{affiliates}' - SHOULD BE 'request'")
        print("   This is why publishers are getting full access!")
        print("\n🔧 FIX: Need to update affiliates field to 'request'")
        
        # Try to fix it
        print("\n⚙️  Attempting to fix...")
        result = offers_collection.update_one(
            {'offer_id': offer.get('offer_id')},
            {'$set': {'affiliates': 'request'}}
        )
        if result.modified_count > 0:
            print("✅ Fixed! Affiliates field updated to 'request'")
        else:
            print("❌ Failed to update")
    
else:
    print("❌ Offer not found")
