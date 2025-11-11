#!/usr/bin/env python3
"""
Fix offer tracking links to use real backend URL
"""

import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from database import db_instance
from bson import ObjectId

def fix_offer_tracking():
    """Update offer to use direct tracking links"""
    
    print("\n🔧 FIXING OFFER TRACKING LINKS")
    print("="*70)
    
    offers_collection = db_instance.get_collection('offers')
    domains_collection = db_instance.get_collection('masking_domains')
    
    if offers_collection is None:
        print("❌ Database connection failed")
        return
    
    # Get the active offer
    offer = offers_collection.find_one({'offer_id': 'ML-00057'})
    
    if not offer:
        print("❌ Offer ML-00057 not found")
        return
    
    print(f"\n📦 Current Offer: {offer.get('name')}")
    print(f"  Offer ID: {offer.get('offer_id')}")
    print(f"  Target URL: {offer.get('target_url')}")
    print(f"  Current Masked URL: {offer.get('masked_url', 'N/A')}")
    
    # Create/Update local testing domain
    local_domain = {
        'domain': 'localhost:5000',
        'is_active': True,
        'protocol': 'http',
        'created_at': __import__('datetime').datetime.utcnow()
    }
    
    # Check if localhost domain exists
    existing = domains_collection.find_one({'domain': 'localhost:5000'})
    if not existing:
        result = domains_collection.insert_one(local_domain)
        print(f"\n✅ Created local testing domain: localhost:5000")
    else:
        print(f"\n✅ Local testing domain exists: localhost:5000")
    
    # For now, we'll use direct tracking links instead of masked links
    # This is more reliable for testing
    
    # The tracking link format will be:
    # http://localhost:5000/track/{offer_id}?user_id={publisher_id}
    
    print("\n📍 TRACKING LINK FORMAT:")
    print("   http://localhost:5000/track/ML-00057?user_id={PUBLISHER_ID}")
    print("\n   Publishers will get personalized links with their user_id")
    
    # Update offer to remove broken masked URL for now
    offers_collection.update_one(
        {'offer_id': 'ML-00057'},
        {'$unset': {'masked_url': '', 'masked_link_id': ''}}
    )
    
    print("\n✅ Removed broken masked URL")
    print("✅ Offer will use direct tracking links")
    
    print("\n" + "="*70)
    print("\n📍 NEXT STEPS:")
    print("   1. Restart backend: python app.py")
    print("   2. Login as publisher")
    print("   3. Go to: http://localhost:8080/offers")
    print("   4. Click 'Details' on the offer")
    print("   5. Get your tracking link!")
    
    print("\n💡 TRACKING LINK WILL BE:")
    print("   http://localhost:5000/track/ML-00057?user_id=YOUR_ID&sub1=test")
    print("\n   When clicked:")
    print("   - Records click in database")
    print("   - Redirects to survey")
    print("   - Shows in Performance Report")

if __name__ == '__main__':
    fix_offer_tracking()
