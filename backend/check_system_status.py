#!/usr/bin/env python3
"""
Check current system status - offers, clicks, conversions
"""

import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from database import db_instance

def check_system_status():
    """Check what data exists in the system"""
    
    print("\n🔍 SYSTEM STATUS CHECK")
    print("="*70)
    
    offers_collection = db_instance.get_collection('offers')
    clicks_collection = db_instance.get_collection('clicks')
    conversions_collection = db_instance.get_collection('conversions')
    
    if offers_collection is None:
        print("❌ Database connection failed")
        return
    
    # Check offers
    total_offers = offers_collection.count_documents({})
    active_offers = offers_collection.count_documents({'status': 'active'})
    
    print(f"\n📦 OFFERS:")
    print(f"  Total: {total_offers}")
    print(f"  Active: {active_offers}")
    
    if total_offers > 0:
        print(f"\n📋 Offer Details:")
        offers = list(offers_collection.find({}).limit(5))
        for offer in offers:
            print(f"\n  Offer ID: {offer.get('offer_id')}")
            print(f"    Name: {offer.get('name')}")
            print(f"    Status: {offer.get('status')}")
            print(f"    Payout: ${offer.get('payout', 0)}")
            print(f"    Target URL: {offer.get('target_url', 'N/A')}")
            print(f"    Preview URL: {offer.get('preview_url', 'N/A')}")
    
    # Check clicks (all users)
    total_clicks = clicks_collection.count_documents({})
    print(f"\n📊 CLICKS:")
    print(f"  Total: {total_clicks}")
    
    if total_clicks > 0:
        # Get unique users
        unique_users = clicks_collection.distinct('user_id')
        unique_affiliates = clicks_collection.distinct('affiliate_id')
        print(f"  Unique user_ids: {len(unique_users)}")
        print(f"  Unique affiliate_ids: {len(unique_affiliates)}")
        
        # Latest clicks
        latest_clicks = list(clicks_collection.find({}).sort('click_time', -1).limit(3))
        print(f"\n  📝 Latest Clicks:")
        for click in latest_clicks:
            print(f"    - {click.get('click_time')} | Offer: {click.get('offer_id')} | Country: {click.get('country', 'N/A')}")
    
    # Check conversions (all users)
    total_conversions = conversions_collection.count_documents({})
    print(f"\n💰 CONVERSIONS:")
    print(f"  Total: {total_conversions}")
    
    if total_conversions > 0:
        approved = conversions_collection.count_documents({'status': 'approved'})
        pending = conversions_collection.count_documents({'status': 'pending'})
        rejected = conversions_collection.count_documents({'status': 'rejected'})
        
        print(f"  ✅ Approved: {approved}")
        print(f"  ⏰ Pending: {pending}")
        print(f"  ❌ Rejected: {rejected}")
    
    print("\n" + "="*70)
    
    # Recommendations
    if total_offers == 0:
        print("\n⚠️  NO OFFERS FOUND!")
        print("\n💡 SOLUTION:")
        print("   1. Go to: http://localhost:8080/admin/offers")
        print("   2. Create a new offer (with real survey URL)")
        print("   3. Make sure status is 'active'")
    elif total_clicks == 0:
        print("\n⚠️  NO REAL CLICKS YET!")
        print("\n💡 TO GET REAL CLICKS:")
        print("   1. Login as a publisher/user")
        print("   2. Go to: http://localhost:8080/dashboard")
        print("   3. Browse offers and get tracking link")
        print("   4. Share tracking link (or test it yourself)")
        print("   5. When someone clicks → shows in reports!")
    else:
        print("\n✅ SYSTEM HAS DATA!")
        print(f"   - {total_offers} offer(s)")
        print(f"   - {total_clicks} click(s)")
        print(f"   - {total_conversions} conversion(s)")
        
        if total_clicks > 100 and total_conversions == 0:
            print("\n⚠️  Test data detected (no real clicks)")
            print("\n💡 TO CLEAR TEST DATA:")
            print("   Run: python clear_test_data.py")

if __name__ == '__main__':
    check_system_status()
