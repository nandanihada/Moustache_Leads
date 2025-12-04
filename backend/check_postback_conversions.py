#!/usr/bin/env python3
"""
Check postback and conversion linkage
"""

from database import db_instance
from datetime import datetime
import logging

logging.basicConfig(level=logging.INFO, format='%(message)s')

def check_postback_conversions():
    """Check if postbacks are creating conversions"""
    
    try:
        # Get collections
        received_postbacks = db_instance.get_collection('received_postback')
        conversions = db_instance.get_collection('conversions')
        
        if received_postbacks is None or conversions is None:
            print("❌ Could not access collections")
            return
        
        print("\n" + "="*80)
        print("🔍 Checking Postback → Conversion Linkage")
        print("="*80)
        
        # Get the specific postback mentioned by user
        postback = received_postbacks.find_one({'conversion_id': 'CONV-ECC4678F1387'})
        
        if postback:
            print("\n✅ Found Postback:")
            print(f"  Conversion ID: {postback.get('conversion_id')}")
            print(f"  Partner ID: {postback.get('partner_id')}")
            print(f"  Partner Name: {postback.get('partner_name')}")
            print(f"  Timestamp: {postback.get('timestamp')}")
            print(f"  Status: {postback.get('status')}")
            print(f"  Query Params: {postback.get('query_params', {})}")
            print(f"  Post Data: {postback.get('post_data', {})}")
        else:
            print("\n❌ Postback not found")
            return
        
        # Check if there's a matching conversion
        conversion = conversions.find_one({'conversion_id': 'CONV-ECC4678F1387'})
        
        if conversion:
            print("\n✅ Found Matching Conversion:")
            print(f"  Conversion ID: {conversion.get('conversion_id')}")
            print(f"  User ID: {conversion.get('user_id')}")
            print(f"  Affiliate ID: {conversion.get('affiliate_id')}")
            print(f"  Offer ID: {conversion.get('offer_id')}")
            print(f"  Payout: {conversion.get('payout')}")
            print(f"  Status: {conversion.get('status')}")
            print(f"  Timestamp: {conversion.get('conversion_time')}")
        else:
            print("\n❌ NO Matching Conversion Found!")
            print("   This means the postback was received but didn't create a conversion record")
        
        # Check all recent postbacks
        print("\n" + "="*80)
        print("📊 Recent Postbacks (last 10):")
        print("="*80)
        
        recent_postbacks = list(received_postbacks.find().sort('timestamp', -1).limit(10))
        print(f"\nTotal recent postbacks: {len(recent_postbacks)}")
        
        for i, pb in enumerate(recent_postbacks, 1):
            conv_id = pb.get('conversion_id', 'N/A')
            timestamp = pb.get('timestamp', 'N/A')
            status = pb.get('status', 'N/A')
            
            # Check if conversion exists
            conv_exists = conversions.find_one({'conversion_id': conv_id}) is not None
            
            print(f"\n{i}. Conversion ID: {conv_id}")
            print(f"   Timestamp: {timestamp}")
            print(f"   Status: {status}")
            print(f"   Has Conversion Record: {'✅ YES' if conv_exists else '❌ NO'}")
        
        # Check all conversions
        print("\n" + "="*80)
        print("📊 Recent Conversions (last 10):")
        print("="*80)
        
        recent_conversions = list(conversions.find().sort('conversion_time', -1).limit(10))
        print(f"\nTotal recent conversions: {len(recent_conversions)}")
        
        for i, conv in enumerate(recent_conversions, 1):
            print(f"\n{i}. Conversion ID: {conv.get('conversion_id', 'N/A')}")
            print(f"   User ID: {conv.get('user_id', 'N/A')}")
            print(f"   Offer ID: {conv.get('offer_id', 'N/A')}")
            print(f"   Payout: {conv.get('payout', 0)}")
            print(f"   Status: {conv.get('status', 'N/A')}")
            print(f"   Time: {conv.get('conversion_time', 'N/A')}")
        
        # Summary
        print("\n" + "="*80)
        print("📈 Summary:")
        print("="*80)
        total_postbacks = received_postbacks.count_documents({})
        total_conversions = conversions.count_documents({})
        
        print(f"\nTotal Postbacks: {total_postbacks}")
        print(f"Total Conversions: {total_conversions}")
        print(f"Difference: {total_postbacks - total_conversions}")
        
        if total_postbacks > total_conversions:
            print(f"\n⚠️  WARNING: {total_postbacks - total_conversions} postbacks did NOT create conversions!")
            print("   This means the postback processing is not working correctly.")
        elif total_conversions > total_postbacks:
            print(f"\n✅ Good: Some conversions were created without postbacks (manual/direct)")
        else:
            print(f"\n✅ Perfect: All postbacks created conversions!")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    check_postback_conversions()
