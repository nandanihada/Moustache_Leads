#!/usr/bin/env python3
"""
Fix incentive types for all offers based on payout_type
"""

import sys
sys.path.append('.')

from database import db_instance
from datetime import datetime

def calculate_incentive_type(payout_type='fixed', revenue_share_percent=None):
    """Calculate incentive type based on payout_type"""
    if payout_type == 'percentage':
        return 'Non-Incent'
    if revenue_share_percent and float(revenue_share_percent) > 0:
        return 'Non-Incent'
    return 'Incent'

def fix_all_offers():
    """Fix incentive types for all offers"""
    
    if not db_instance.is_connected():
        print("❌ Database not connected!")
        return
    
    offers_collection = db_instance.get_collection('offers')
    
    # Get all active offers
    offers = list(offers_collection.find({'is_active': True}))
    
    print(f"\n{'='*100}")
    print(f"  FIXING INCENTIVE TYPES FOR ALL OFFERS")
    print(f"{'='*100}\n")
    
    print(f"{'Offer ID':<15} {'Payout Type':<15} {'Old Incentive':<15} {'New Incentive':<15} {'Status':<15}")
    print("-" * 100)
    
    fixed_count = 0
    
    for offer in offers:
        offer_id = offer.get('offer_id', 'N/A')
        payout_type = offer.get('payout_type', 'fixed')
        revenue_share = offer.get('revenue_share_percent', 0)
        old_incentive = offer.get('incentive_type', 'Unknown')
        
        # Calculate new incentive type
        new_incentive = calculate_incentive_type(payout_type, revenue_share)
        
        # Update if different
        if old_incentive != new_incentive:
            offers_collection.update_one(
                {'offer_id': offer_id},
                {'$set': {
                    'incentive_type': new_incentive,
                    'updated_at': datetime.utcnow()
                }}
            )
            status = "✅ UPDATED"
            fixed_count += 1
        else:
            status = "✓ OK"
        
        print(f"{offer_id:<15} {payout_type:<15} {old_incentive:<15} {new_incentive:<15} {status:<15}")
    
    print(f"\n{'='*100}")
    print(f"  SUMMARY")
    print(f"{'='*100}\n")
    print(f"Total offers: {len(offers)}")
    print(f"Fixed: {fixed_count}")
    print(f"Already correct: {len(offers) - fixed_count}")
    print(f"\n{'='*100}\n")

if __name__ == '__main__':
    fix_all_offers()
