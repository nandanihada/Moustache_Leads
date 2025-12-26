#!/usr/bin/env python3
"""
List all postbacks and conversions
"""

from database import db_instance
import logging

logging.basicConfig(level=logging.INFO, format='%(message)s')

def list_all():
    """List all postbacks and conversions"""
    
    try:
        received_postbacks = db_instance.get_collection('received_postback')
        conversions = db_instance.get_collection('conversions')
        
        if received_postbacks is None or conversions is None:
            print("❌ Could not access collections")
            return
        
        print("\n" + "="*80)
        print("📊 ALL Postbacks:")
        print("="*80)
        
        all_postbacks = list(received_postbacks.find().sort('timestamp', -1))
        print(f"\nTotal postbacks: {len(all_postbacks)}")
        
        for i, pb in enumerate(all_postbacks, 1):
            print(f"\n{i}. _id: {pb.get('_id')}")
            print(f"   Conversion ID: {pb.get('conversion_id', 'N/A')}")
            print(f"   Partner ID: {pb.get('partner_id', 'N/A')}")
            print(f"   Partner Name: {pb.get('partner_name', 'N/A')}")
            print(f"   Timestamp: {pb.get('timestamp', 'N/A')}")
            print(f"   Status: {pb.get('status', 'N/A')}")
        
        print("\n" + "="*80)
        print("📊 ALL Conversions:")
        print("="*80)
        
        all_conversions = list(conversions.find().sort('conversion_time', -1))
        print(f"\nTotal conversions: {len(all_conversions)}")
        
        for i, conv in enumerate(all_conversions, 1):
            print(f"\n{i}. _id: {conv.get('_id')}")
            print(f"   Conversion ID: {conv.get('conversion_id', 'N/A')}")
            print(f"   User ID: {conv.get('user_id', 'N/A')}")
            print(f"   Offer ID: {conv.get('offer_id', 'N/A')}")
            print(f"   Payout: {conv.get('payout', 0)}")
            print(f"   Status: {conv.get('status', 'N/A')}")
            print(f"   Time: {conv.get('conversion_time', 'N/A')}")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    list_all()
