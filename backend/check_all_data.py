#!/usr/bin/env python3
"""
Check all tracking data in MongoDB
"""

import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from database import db_instance
from datetime import datetime, timedelta

def check_all_data():
    """Check all tracking data"""
    
    print("\n🔍 CHECKING ALL TRACKING DATA IN MONGODB")
    print("="*70)
    
    # Check clicks
    clicks_collection = db_instance.get_collection('clicks')
    impressions_collection = db_instance.get_collection('impressions')
    conversions_collection = db_instance.get_collection('conversions')
    
    if clicks_collection is None:
        print("❌ Could not access collections")
        return
    
    # Clicks
    total_clicks = clicks_collection.count_documents({})
    print(f"\n📊 CLICKS Collection: {total_clicks} records")
    
    if total_clicks > 0:
        latest_click = clicks_collection.find_one({}, sort=[('click_time', -1)])
        if latest_click:
            print(f"   Latest click:")
            print(f"   - Click ID: {latest_click.get('click_id')}")
            print(f"   - Offer ID: {latest_click.get('offer_id')}")
            print(f"   - User ID: {latest_click.get('user_id')}")
            print(f"   - Time: {latest_click.get('click_time')}")
            
            # Show all fields
            print(f"\n   All fields in clicks:")
            for key in latest_click.keys():
                if key != '_id':
                    print(f"   - {key}: {latest_click.get(key)}")
    
    # Impressions
    total_impressions = impressions_collection.count_documents({})
    print(f"\n📊 IMPRESSIONS Collection: {total_impressions} records")
    
    if total_impressions > 0:
        latest = impressions_collection.find_one({}, sort=[('timestamp', -1)])
        if latest:
            print(f"   Latest impression:")
            print(f"   - Offer ID: {latest.get('offer_id')}")
            print(f"   - User ID: {latest.get('user_id')}")
            print(f"   - Time: {latest.get('timestamp')}")
    
    # Conversions
    total_conversions = conversions_collection.count_documents({})
    print(f"\n📊 CONVERSIONS Collection: {total_conversions} records")
    
    if total_conversions > 0:
        latest = conversions_collection.find_one({}, sort=[('conversion_time', -1)])
        if latest:
            print(f"   Latest conversion:")
            print(f"   - Conversion ID: {latest.get('conversion_id')}")
            print(f"   - Click ID: {latest.get('click_id')}")
            print(f"   - Status: {latest.get('status')}")
            print(f"   - Payout: {latest.get('payout')}")
            print(f"   - Time: {latest.get('conversion_time')}")
    
    # Summary
    print(f"\n" + "="*70)
    print(f"📊 SUMMARY:")
    print(f"   Clicks: {total_clicks}")
    print(f"   Impressions: {total_impressions}")
    print(f"   Conversions: {total_conversions}")
    print("="*70)
    
    # Test query that reports would use
    print(f"\n🔍 TESTING REPORT QUERY:")
    print("="*70)
    
    # Get date range (last 30 days)
    end_date = datetime.utcnow()
    start_date = end_date - timedelta(days=30)
    
    print(f"Date range: {start_date.date()} to {end_date.date()}")
    
    # Query clicks in date range
    query = {
        'click_time': {
            '$gte': start_date,
            '$lte': end_date
        }
    }
    
    clicks_in_range = clicks_collection.count_documents(query)
    print(f"Clicks in date range: {clicks_in_range}")
    
    if clicks_in_range > 0:
        # Try aggregation like reports do
        pipeline = [
            {'$match': query},
            {'$group': {
                '_id': None,
                'total_clicks': {'$sum': 1},
                'unique_offers': {'$addToSet': '$offer_id'}
            }}
        ]
        
        result = list(clicks_collection.aggregate(pipeline))
        if result:
            print(f"\nAggregation result:")
            print(f"   Total clicks: {result[0].get('total_clicks')}")
            print(f"   Unique offers: {result[0].get('unique_offers')}")
    
    # Check conversions in date range
    conv_query = {
        'conversion_time': {
            '$gte': start_date,
            '$lte': end_date
        }
    }
    
    convs_in_range = conversions_collection.count_documents(conv_query)
    print(f"Conversions in date range: {convs_in_range}")
    
    print("\n" + "="*70)
    
    if total_clicks == 0 and total_impressions == 0 and total_conversions == 0:
        print("⚠️  NO DATA FOUND!")
        print("\n💡 To generate test data:")
        print("   1. Click tracking link from frontend")
        print("   2. Or run: python test_complete_flow.py")
    else:
        print("✅ DATA EXISTS IN MONGODB")
        print("\nIf reports are blank, the issue is:")
        print("   1. Frontend date range might not include this data")
        print("   2. Frontend filters might be excluding data")
        print("   3. API endpoint might have wrong mapping")
        print("   4. Frontend might not be calling correct API")

if __name__ == '__main__':
    check_all_data()
