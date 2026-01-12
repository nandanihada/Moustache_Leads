"""
Check Offers Visibility - Debug Script
Checks why offers aren't showing in offerwall and fixes any issues
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database import db_instance
from datetime import datetime

def check_offers():
    """Check all offers and their visibility status"""
    
    print("="*80)
    print("🔍 CHECKING OFFERS VISIBILITY")
    print("="*80)
    
    offers_collection = db_instance.get_collection('offers')
    
    if offers_collection is None:
        print("❌ Could not connect to database")
        return
    
    # Get all offers
    all_offers = list(offers_collection.find({}))
    print(f"\n📊 Total offers in database: {len(all_offers)}")
    
    # Check offers by status
    active_offers = list(offers_collection.find({'status': 'active'}))
    print(f"   Offers with status='active': {len(active_offers)}")
    
    Active_offers = list(offers_collection.find({'status': 'Active'}))
    print(f"   Offers with status='Active' (capitalized): {len(Active_offers)}")
    
    # Check offers by is_active
    is_active_true = list(offers_collection.find({'is_active': True}))
    print(f"   Offers with is_active=True: {len(is_active_true)}")
    
    is_active_false = list(offers_collection.find({'is_active': False}))
    print(f"   Offers with is_active=False: {len(is_active_false)}")
    
    is_active_missing = list(offers_collection.find({'is_active': {'$exists': False}}))
    print(f"   Offers missing is_active field: {len(is_active_missing)}")
    
    # Check offers that match offerwall query
    offerwall_query = {
        'is_active': True,
        'status': 'active'
    }
    offerwall_offers = list(offers_collection.find(offerwall_query))
    print(f"\n✅ Offers visible in offerwall (is_active=True AND status='active'): {len(offerwall_offers)}")
    
    # Show sample of offers that DON'T match
    print(f"\n🔍 ANALYZING OFFERS NOT VISIBLE IN OFFERWALL:")
    print("="*80)
    
    invisible_offers = []
    for offer in all_offers:
        is_active = offer.get('is_active')
        status = offer.get('status')
        
        # Check if offer would be visible
        if is_active != True or status != 'active':
            invisible_offers.append({
                'offer_id': offer.get('offer_id'),
                'name': offer.get('name'),
                'is_active': is_active,
                'status': status,
                'network': offer.get('network'),
                'created_at': offer.get('created_at')
            })
    
    print(f"\n📋 Found {len(invisible_offers)} offers NOT visible in offerwall:")
    
    # Group by issue type
    missing_is_active = [o for o in invisible_offers if o['is_active'] is None]
    is_active_false_list = [o for o in invisible_offers if o['is_active'] == False]
    wrong_status = [o for o in invisible_offers if o['is_active'] == True and o['status'] != 'active']
    
    print(f"\n   Missing is_active field: {len(missing_is_active)}")
    print(f"   is_active=False: {len(is_active_false_list)}")
    print(f"   is_active=True but status != 'active': {len(wrong_status)}")
    
    # Show details of first 10 invisible offers
    print(f"\n📝 First 10 invisible offers:")
    for i, offer in enumerate(invisible_offers[:10], 1):
        print(f"\n   {i}. {offer['name']}")
        print(f"      Offer ID: {offer['offer_id']}")
        print(f"      Network: {offer['network']}")
        print(f"      is_active: {offer['is_active']}")
        print(f"      status: '{offer['status']}'")
        print(f"      Created: {offer['created_at']}")
    
    return invisible_offers


def fix_offers(invisible_offers):
    """Fix offers that aren't visible"""
    
    print(f"\n{'='*80}")
    print("🔧 FIXING INVISIBLE OFFERS")
    print("="*80)
    
    offers_collection = db_instance.get_collection('offers')
    
    if offers_collection is None:
        print("❌ Could not connect to database")
        return
    
    fixed_count = 0
    
    for offer in invisible_offers:
        offer_id = offer['offer_id']
        updates = {}
        
        # Fix is_active if missing or False
        if offer['is_active'] != True:
            updates['is_active'] = True
            print(f"   Setting is_active=True for {offer_id}")
        
        # Fix status if not 'active' (lowercase)
        if offer['status'] != 'active':
            # Check if it's just a case issue
            if offer['status'] and offer['status'].lower() == 'active':
                updates['status'] = 'active'
                print(f"   Fixing status case for {offer_id}: '{offer['status']}' → 'active'")
            elif offer['status'] in ['Active', 'ACTIVE', 'pending', 'Pending']:
                # Set to active if it was Active or pending
                updates['status'] = 'active'
                print(f"   Activating {offer_id}: '{offer['status']}' → 'active'")
        
        # Apply updates
        if updates:
            updates['updated_at'] = datetime.utcnow()
            result = offers_collection.update_one(
                {'offer_id': offer_id},
                {'$set': updates}
            )
            if result.modified_count > 0:
                fixed_count += 1
                print(f"   ✅ Fixed {offer_id}")
    
    print(f"\n✅ Fixed {fixed_count} offers")
    
    # Verify fix
    print(f"\n{'='*80}")
    print("🔍 VERIFYING FIX")
    print("="*80)
    
    offerwall_query = {
        'is_active': True,
        'status': 'active'
    }
    offerwall_offers = list(offers_collection.find(offerwall_query))
    print(f"✅ Offers now visible in offerwall: {len(offerwall_offers)}")


if __name__ == '__main__':
    print("\n" + "="*80)
    print("OFFERWALL VISIBILITY CHECKER")
    print("="*80)
    
    # Check offers
    invisible_offers = check_offers()
    
    if invisible_offers:
        print(f"\n{'='*80}")
        response = input(f"\n❓ Fix {len(invisible_offers)} invisible offers? (yes/no): ")
        
        if response.lower() in ['yes', 'y']:
            fix_offers(invisible_offers)
        else:
            print("\n⏭️  Skipping fix")
    else:
        print("\n✅ All offers are visible in offerwall!")
    
    print(f"\n{'='*80}")
    print("DONE")
    print("="*80 + "\n")
