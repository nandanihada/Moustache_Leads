#!/usr/bin/env python3
"""
Update Incentive Type for All Existing Offers
Auto-calculates and sets incentive_type based on payout_type
"""

import sys
sys.path.append('.')

from database import db_instance
from models.offer import calculate_incentive_type
from datetime import datetime

def update_all_offers_incentive():
    """Update incentive_type for all existing offers"""
    
    if not db_instance.is_connected():
        print("❌ Database not connected!")
        return
    
    offers_collection = db_instance.get_collection('offers')
    
    # Get all offers
    all_offers = list(offers_collection.find({'is_active': True}))
    
    print(f"\n{'='*80}")
    print(f"  UPDATING INCENTIVE TYPE FOR ALL OFFERS")
    print(f"{'='*80}\n")
    
    print(f"📊 Total offers found: {len(all_offers)}\n")
    
    updated_count = 0
    incent_count = 0
    non_incent_count = 0
    
    for offer in all_offers:
        offer_id = offer.get('offer_id')
        payout_type = offer.get('payout_type', 'fixed')
        revenue_share_percent = offer.get('revenue_share_percent', 0)
        current_incentive = offer.get('incentive_type', 'Unknown')
        
        # Calculate new incentive type
        new_incentive = calculate_incentive_type(payout_type, revenue_share_percent)
        
        # Update if different
        if current_incentive != new_incentive:
            offers_collection.update_one(
                {'offer_id': offer_id},
                {'$set': {
                    'incentive_type': new_incentive,
                    'updated_at': datetime.utcnow()
                }}
            )
            
            print(f"✅ Updated {offer_id}: {current_incentive} → {new_incentive} (payout_type: {payout_type})")
            updated_count += 1
        else:
            print(f"✓  {offer_id}: Already correct ({new_incentive})")
        
        # Count totals
        if new_incentive == 'Incent':
            incent_count += 1
        else:
            non_incent_count += 1
    
    print(f"\n{'='*80}")
    print(f"  UPDATE COMPLETE")
    print(f"{'='*80}\n")
    
    print(f"📊 Statistics:")
    print(f"   Total offers: {len(all_offers)}")
    print(f"   Updated: {updated_count}")
    print(f"   Already correct: {len(all_offers) - updated_count}")
    print(f"\n   Incent offers: {incent_count}")
    print(f"   Non-Incent offers: {non_incent_count}")
    
    print(f"\n{'='*80}\n")


def show_incentive_breakdown():
    """Show breakdown of offers by incentive type"""
    
    if not db_instance.is_connected():
        print("❌ Database not connected!")
        return
    
    offers_collection = db_instance.get_collection('offers')
    
    print(f"\n{'='*80}")
    print(f"  INCENTIVE TYPE BREAKDOWN")
    print(f"{'='*80}\n")
    
    # Get breakdown by payout_type
    pipeline = [
        {'$match': {'is_active': True}},
        {'$group': {
            '_id': {
                'payout_type': '$payout_type',
                'incentive_type': '$incentive_type'
            },
            'count': {'$sum': 1}
        }},
        {'$sort': {'_id.payout_type': 1}}
    ]
    
    results = list(offers_collection.aggregate(pipeline))
    
    print("Breakdown by Payout Type and Incentive Type:")
    print(f"{'Payout Type':<15} {'Incentive Type':<15} {'Count':<10}")
    print("-" * 40)
    
    for result in results:
        payout_type = result['_id'].get('payout_type', 'unknown')
        incentive_type = result['_id'].get('incentive_type', 'unknown')
        count = result['count']
        print(f"{payout_type:<15} {incentive_type:<15} {count:<10}")
    
    print(f"\n{'='*80}\n")


if __name__ == '__main__':
    # Show current breakdown
    show_incentive_breakdown()
    
    # Update all offers
    update_all_offers_incentive()
    
    # Show new breakdown
    show_incentive_breakdown()
