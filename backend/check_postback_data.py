#!/usr/bin/env python3
"""
Check what data is in the received postback
"""

from database import db_instance
import logging

logging.basicConfig(level=logging.INFO, format='%(message)s')

def check_postback_data():
    """Check the received postback data"""
    
    try:
        received_postbacks = db_instance.get_collection('received_postbacks')
        
        if received_postbacks is None:
            print("❌ Could not access received_postbacks collection")
            return
        
        print("\n" + "="*80)
        print("📥 Checking Received Postback Data")
        print("="*80)
        
        # Get the specific postback
        postback = received_postbacks.find_one({}, sort=[('timestamp', -1)])
        
        if not postback:
            print("\n❌ No postbacks found")
            return
        
        print(f"\n📋 Latest Postback:")
        print(f"   Unique Key: {postback.get('unique_key')}")
        print(f"   Partner: {postback.get('partner_name')}")
        print(f"   Timestamp: {postback.get('timestamp')}")
        print(f"   Status: {postback.get('status')}")
        
        print(f"\n📦 Query Parameters:")
        query_params = postback.get('query_params', {})
        for key, value in query_params.items():
            print(f"   {key}: {value}")
        
        print(f"\n📦 POST Data:")
        post_data = postback.get('post_data', {})
        if post_data:
            for key, value in post_data.items():
                print(f"   {key}: {value}")
        else:
            print("   (empty)")
        
        # Check if placement_id is present
        print("\n" + "="*80)
        print("🔍 Checking for placement_id:")
        print("="*80)
        
        placement_id = None
        
        # Check in query params
        if 'placement_id' in query_params:
            placement_id = query_params['placement_id']
            print(f"\n✅ Found in query_params: {placement_id}")
        elif 'sub_id1' in query_params:
            placement_id = query_params['sub_id1']
            print(f"\n✅ Found in sub_id1: {placement_id}")
        elif 'sub1' in query_params:
            placement_id = query_params['sub1']
            print(f"\n✅ Found in sub1: {placement_id}")
        else:
            print("\n❌ placement_id NOT found in postback data!")
            print("\n💡 This is the problem!")
            print("   The postback doesn't include which placement it's for.")
            print("   So we can't look up the placement's postbackUrl.")
        
        # Check if click_id is present
        click_id = query_params.get('click_id')
        if click_id:
            print(f"\n✅ click_id found: {click_id}")
            print("   We can use this to look up the click and get placement_id!")
            
            # Try to find the click
            clicks = db_instance.get_collection('clicks')
            if clicks is not None:
                click = clicks.find_one({'click_id': click_id})
                if click:
                    print(f"\n✅ Found click record:")
                    print(f"   user_id: {click.get('user_id')}")
                    print(f"   offer_id: {click.get('offer_id')}")
                    print(f"   sub1: {click.get('sub1')}")
                    print(f"   sub_id1: {click.get('sub_id1')}")
                    
                    # Check if placement_id is in click
                    click_placement = click.get('sub1') or click.get('sub_id1') or click.get('placement_id')
                    if click_placement:
                        print(f"\n✅ Found placement_id in click: {click_placement}")
                    else:
                        print(f"\n❌ No placement_id in click record")
                else:
                    print(f"\n❌ Click not found: {click_id}")
        
        print("\n" + "="*80)
        print("💡 Solution:")
        print("="*80)
        
        if placement_id:
            print(f"\n✅ We have placement_id: {placement_id}")
            print("   We can look up the placement and send to its postbackUrl!")
        elif click_id:
            print(f"\n✅ We have click_id: {click_id}")
            print("   We can look up the click, get placement_id, then send postback!")
        else:
            print("\n❌ We don't have placement_id or click_id")
            print("   Need to modify the tracking system to include this data.")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    check_postback_data()
