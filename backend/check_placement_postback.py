#!/usr/bin/env python3
"""
Check specific placement details
"""

from database import db_instance
from bson import ObjectId
import logging

logging.basicConfig(level=logging.INFO, format='%(message)s')

def check_placement():
    """Check the specific placement"""
    
    try:
        placements = db_instance.get_collection('placements')
        
        if placements is None:
            print("❌ Could not access placements collection")
            return
        
        # Find the placement
        placement_id = "kSonv403NKleLqWV"
        placement = placements.find_one({'placementIdentifier': placement_id})
        
        if not placement:
            print(f"❌ Placement not found: {placement_id}")
            return
        
        print("\n" + "="*80)
        print(f"📋 Placement Details: {placement_id}")
        print("="*80)
        
        print(f"\n_id: {placement.get('_id')}")
        print(f"placementIdentifier: {placement.get('placementIdentifier')}")
        print(f"offerwallTitle: {placement.get('offerwallTitle')}")
        print(f"publisherId: {placement.get('publisherId')}")
        print(f"platformType: {placement.get('platformType')}")
        print(f"currencyName: {placement.get('currencyName')}")
        print(f"exchangeRate: {placement.get('exchangeRate')}")
        print(f"status: {placement.get('status')}")
        print(f"approvalStatus: {placement.get('approvalStatus')}")
        
        # CRITICAL: Check postback URL
        postback_url = placement.get('postbackUrl')
        print(f"\n🔔 postbackUrl: {postback_url}")
        
        if not postback_url:
            print("\n❌ PROBLEM FOUND: No postbackUrl configured!")
            print("   This is why postbacks aren't being forwarded!")
            print("\n💡 SOLUTION:")
            print("   The partner needs to configure their postback URL in the placement.")
            print(f"   It should be: https://surveytitans.com/postback/d8e1bff1f46a956173cc91e51de5db63")
        else:
            print(f"\n✅ Postback URL is configured: {postback_url}")
        
        # Check publisher
        publisher_id = placement.get('publisherId')
        if publisher_id:
            users = db_instance.get_collection('users')
            if users is not None:
                try:
                    publisher = users.find_one({'_id': ObjectId(publisher_id)})
                    if publisher:
                        print(f"\n👤 Publisher Details:")
                        print(f"   Username: {publisher.get('username')}")
                        print(f"   Email: {publisher.get('email')}")
                        print(f"   Role: {publisher.get('role')}")
                except:
                    # Try as string
                    publisher = users.find_one({'_id': publisher_id})
                    if publisher:
                        print(f"\n👤 Publisher Details:")
                        print(f"   Username: {publisher.get('username')}")
                        print(f"   Email: {publisher.get('email')}")
                        print(f"   Role: {publisher.get('role')}")
        
        print("\n" + "="*80)
        print("📊 Summary:")
        print("="*80)
        print(f"\n✅ Placement exists: YES")
        print(f"✅ placementIdentifier matches: YES ({placement_id})")
        print(f"{'✅' if postback_url else '❌'} postbackUrl configured: {'YES' if postback_url else 'NO'}")
        
        if not postback_url:
            print("\n🔧 TO FIX:")
            print("   1. Partner logs into their account")
            print("   2. Goes to Placements page")
            print("   3. Edits 'My Rewards' placement")
            print("   4. Sets Postback URL to:")
            print("      https://surveytitans.com/postback/d8e1bff1f46a956173cc91e51de5db63")
            print("   5. Saves the placement")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    check_placement()
