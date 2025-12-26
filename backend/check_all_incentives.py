#!/usr/bin/env python3
"""
Check incentive types for all offers in the database
"""

import sys
sys.path.append('.')

from database import db_instance

def check_all_offers():
    """Check incentive types for all offers"""
    
    if not db_instance.is_connected():
        print("❌ Database not connected!")
        return
    
    offers_collection = db_instance.get_collection('offers')
    
    # Get all active offers
    offers = list(offers_collection.find({'is_active': True}))
    
    print(f"\n{'='*100}")
    print(f"  INCENTIVE TYPE CHECK - ALL OFFERS")
    print(f"{'='*100}\n")
    
    print(f"{'Offer ID':<15} {'Name':<30} {'Payout Type':<15} {'Rev Share %':<12} {'Incentive':<15}")
    print("-" * 100)
    
    for offer in offers:
        offer_id = offer.get('offer_id', 'N/A')
        name = offer.get('name', 'N/A')[:28]
        payout_type = offer.get('payout_type', 'N/A')
        revenue_share = offer.get('revenue_share_percent', 0)
        incentive_type = offer.get('incentive_type', 'N/A')
        
        print(f"{offer_id:<15} {name:<30} {payout_type:<15} {revenue_share:<12} {incentive_type:<15}")
    
    print(f"\n{'='*100}\n")

if __name__ == '__main__':
    check_all_offers()
