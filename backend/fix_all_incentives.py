#!/usr/bin/env python3
"""
COMPREHENSIVE FIX: Update all offers with correct incentive types
Run this script to fix all existing offers in the database
"""

import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database import db_instance
from datetime import datetime

def calculate_incentive_type(payout_type='fixed', revenue_share_percent=None):
    """
    Calculate incentive type based on payout_type
    
    Logic:
        - percentage payout → Non-Incent
        - fixed/tiered payout → Incent
    """
    if payout_type == 'percentage':
        return 'Non-Incent'
    if revenue_share_percent and float(revenue_share_percent) > 0:
        return 'Non-Incent'
    return 'Incent'

def main():
    print("\n" + "="*100)
    print("  COMPREHENSIVE INCENTIVE TYPE FIX")
    print("="*100 + "\n")
    
    if not db_instance.is_connected():
        print("❌ ERROR: Database not connected!")
        print("   Please ensure MongoDB is running and connection string is correct.")
        return 1
    
    offers_collection = db_instance.get_collection('offers')
    
    # Get all offers (including inactive for complete fix)
    all_offers = list(offers_collection.find({}))
    active_offers = [o for o in all_offers if o.get('is_active', True)]
    
    print(f"📊 Found {len(all_offers)} total offers ({len(active_offers)} active)\n")
    
    if len(active_offers) == 0:
        print("⚠️  No active offers found. Nothing to fix.")
        return 0
    
    print("🔍 Analyzing offers...\n")
    print(f"{'Offer ID':<15} {'Name':<30} {'Payout Type':<15} {'Old':<15} {'New':<15} {'Action':<15}")
    print("-" * 105)
    
    fixed_count = 0
    already_correct = 0
    errors = []
    
    for offer in active_offers:
        try:
            offer_id = offer.get('offer_id', 'UNKNOWN')
            name = (offer.get('name', 'Unnamed'))[:28]
            payout_type = offer.get('payout_type', 'fixed')
            revenue_share = offer.get('revenue_share_percent', 0)
            old_incentive = offer.get('incentive_type', 'Not Set')
            
            # Calculate correct incentive type
            new_incentive = calculate_incentive_type(payout_type, revenue_share)
            
            # Determine action
            if old_incentive != new_incentive:
                # Update the offer
                result = offers_collection.update_one(
                    {'_id': offer['_id']},
                    {'$set': {
                        'incentive_type': new_incentive,
                        'updated_at': datetime.utcnow()
                    }}
                )
                
                if result.modified_count > 0:
                    action = "✅ FIXED"
                    fixed_count += 1
                else:
                    action = "⚠️  UPDATE FAILED"
                    errors.append(f"{offer_id}: Update failed")
            else:
                action = "✓ OK"
                already_correct += 1
            
            print(f"{offer_id:<15} {name:<30} {payout_type:<15} {old_incentive:<15} {new_incentive:<15} {action:<15}")
            
        except Exception as e:
            error_msg = f"{offer.get('offer_id', 'UNKNOWN')}: {str(e)}"
            errors.append(error_msg)
            print(f"{'ERROR':<15} {'':<30} {'':<15} {'':<15} {'':<15} ❌ {str(e)[:30]}")
    
    # Summary
    print("\n" + "="*100)
    print("  SUMMARY")
    print("="*100 + "\n")
    
    print(f"📊 Total active offers: {len(active_offers)}")
    print(f"✅ Fixed: {fixed_count}")
    print(f"✓  Already correct: {already_correct}")
    
    if errors:
        print(f"\n❌ Errors: {len(errors)}")
        for error in errors:
            print(f"   - {error}")
    
    print(f"\n{'='*100}\n")
    
    if fixed_count > 0:
        print("✅ SUCCESS! All offers have been updated with correct incentive types.")
        print("   Please refresh your browser to see the changes.")
    elif already_correct == len(active_offers):
        print("✅ All offers already have correct incentive types. No changes needed.")
    else:
        print("⚠️  Some offers could not be updated. Check errors above.")
    
    print()
    return 0 if len(errors) == 0 else 1

if __name__ == '__main__':
    try:
        exit_code = main()
        sys.exit(exit_code)
    except KeyboardInterrupt:
        print("\n\n⚠️  Operation cancelled by user.")
        sys.exit(1)
    except Exception as e:
        print(f"\n\n❌ FATAL ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
