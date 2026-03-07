"""
One-time migration: Fix offers that have approval_type='auto_approve' at top level
but missing or wrong approval_settings.type in the DB.

Also upgrades any pending affiliate_requests for auto_approve offers to 'approved'.

Run: python migrations/fix_approval_settings.py
"""
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from database import db_instance
from datetime import datetime

def fix_approval_settings():
    offers_col = db_instance.get_collection('offers')
    requests_col = db_instance.get_collection('affiliate_requests')
    
    if offers_col is None:
        print("❌ Database not connected")
        return
    
    # Find all offers
    all_offers = list(offers_col.find({}))
    print(f"📊 Total offers: {len(all_offers)}")
    
    fixed_count = 0
    requests_fixed = 0
    
    for offer in all_offers:
        offer_id = offer.get('offer_id', 'unknown')
        approval_settings = offer.get('approval_settings', {})
        top_level_type = offer.get('approval_type')
        nested_type = approval_settings.get('type') if isinstance(approval_settings, dict) else None
        
        # Determine the intended approval type
        intended_type = top_level_type or nested_type or 'auto_approve'
        
        needs_fix = False
        update = {}
        
        # Fix missing or mismatched approval_settings.type
        if not isinstance(approval_settings, dict) or approval_settings.get('type') != intended_type:
            if not isinstance(approval_settings, dict):
                approval_settings = {}
            approval_settings['type'] = intended_type
            update['approval_settings'] = approval_settings
            needs_fix = True
        
        # Fix missing top-level approval_type
        if top_level_type != intended_type:
            update['approval_type'] = intended_type
            needs_fix = True
        
        # For auto_approve offers, ensure affiliates is 'all'
        if intended_type == 'auto_approve' and offer.get('affiliates') == 'request':
            update['affiliates'] = 'all'
            needs_fix = True
        
        if needs_fix:
            offers_col.update_one({'_id': offer['_id']}, {'$set': update})
            fixed_count += 1
            print(f"  ✅ Fixed offer {offer_id}: {update}")
        
        # For auto_approve offers, upgrade any pending requests to approved
        if intended_type == 'auto_approve':
            result = requests_col.update_many(
                {'offer_id': offer_id, 'status': 'pending'},
                {'$set': {
                    'status': 'approved',
                    'approved_at': datetime.utcnow(),
                    'approved_by': 'system_migration'
                }}
            )
            if result.modified_count > 0:
                requests_fixed += result.modified_count
                print(f"  ✅ Auto-approved {result.modified_count} pending requests for offer {offer_id}")
    
    print(f"\n📊 Summary: Fixed {fixed_count} offers, auto-approved {requests_fixed} pending requests")

if __name__ == '__main__':
    fix_approval_settings()
