#!/usr/bin/env python3
"""
Check clicks in database
"""

import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from database import db_instance
from datetime import datetime

def check_clicks():
    """Check clicks in database"""
    
    print("\n🔍 CHECKING CLICKS IN DATABASE")
    print("="*70)
    
    clicks_collection = db_instance.get_collection('clicks')
    
    if not clicks_collection:
        print("❌ Could not access clicks collection")
        return
    
    # Get total count
    total_clicks = clicks_collection.count_documents({})
    print(f"\n📊 Total Clicks: {total_clicks}")
    
    if total_clicks == 0:
        print("\n⚠️  No clicks found in database")
        print("\n💡 To test:")
        print("   1. Get tracking link from frontend")
        print("   2. Click it in your browser")
        print("   3. Run this script again")
        return
    
    # Get latest 5 clicks
    print(f"\n📝 Latest {min(5, total_clicks)} Clicks:")
    print("="*70)
    
    latest_clicks = list(clicks_collection.find().sort('click_time', -1).limit(5))
    
    for i, click in enumerate(latest_clicks, 1):
        print(f"\n#{i}:")
        print(f"  Click ID: {click.get('click_id')}")
        print(f"  Offer ID: {click.get('offer_id')}")
        print(f"  Publisher: {click.get('user_id')}")
        print(f"  IP: {click.get('ip_address', 'N/A')}")
        print(f"  Country: {click.get('country', 'N/A')}")
        print(f"  Device: {click.get('device_type', 'N/A')}")
        print(f"  Sub ID 1: {click.get('sub_id1', 'N/A')}")
        print(f"  Converted: {'✅ Yes' if click.get('converted') else '❌ No'}")
        
        click_time = click.get('click_time')
        if click_time:
            if isinstance(click_time, str):
                print(f"  Time: {click_time}")
            else:
                print(f"  Time: {click_time.strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Group by offer
    print(f"\n📊 Clicks by Offer:")
    print("="*70)
    
    pipeline = [
        {'$group': {
            '_id': '$offer_id',
            'count': {'$sum': 1}
        }},
        {'$sort': {'count': -1}}
    ]
    
    offer_stats = list(clicks_collection.aggregate(pipeline))
    
    for stat in offer_stats:
        print(f"  Offer {stat['_id']}: {stat['count']} clicks")
    
    # Group by user
    print(f"\n📊 Clicks by Publisher:")
    print("="*70)
    
    pipeline = [
        {'$group': {
            '_id': '$user_id',
            'count': {'$sum': 1}
        }},
        {'$sort': {'count': -1}}
    ]
    
    user_stats = list(clicks_collection.aggregate(pipeline))
    
    for stat in user_stats:
        print(f"  Publisher {stat['_id']}: {stat['count']} clicks")
    
    print("\n" + "="*70)
    print("✅ Click check complete!")
    print("="*70)

if __name__ == '__main__':
    check_clicks()
