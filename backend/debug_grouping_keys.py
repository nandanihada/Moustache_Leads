"""
Debug the grouping keys to see why clicks and conversions aren't matching
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from models.user_reports import UserReports
from datetime import datetime
import json

print("🔍 Debugging Grouping Keys...")
print("=" * 60)

try:
    user_reports = UserReports()
    
    # Test with the actual date range from our data
    date_range = {
        'start': datetime(2025, 11, 1),
        'end': datetime(2025, 11, 15)
    }
    
    # Test with simple grouping first
    group_by = ['date', 'offer_id']
    
    print(f"📅 Date range: {date_range['start']} to {date_range['end']}")
    print(f"📊 Group by: {group_by}")
    
    # Let's manually run the aggregation to see what's happening
    start_date = date_range['start']
    end_date = date_range['end']
    
    # Build match queries
    click_match = {
        'click_time': {
            '$gte': start_date,
            '$lte': end_date
        }
    }
    
    conversion_match = {
        'conversion_time': {
            '$gte': start_date,
            '$lte': end_date
        }
    }
    
    # Build group IDs
    click_group_id = {}
    conv_group_id = {}
    
    for field in group_by:
        if field == 'date':
            click_group_id['date'] = {
                '$dateToString': {'format': '%Y-%m-%d', 'date': '$click_time'}
            }
            conv_group_id['date'] = {
                '$dateToString': {'format': '%Y-%m-%d', 'date': '$conversion_time'}
            }
        elif field == 'offer_id':
            click_group_id['offer_id'] = '$offer_id'
            conv_group_id['offer_id'] = '$offer_id'
    
    # Run click aggregation
    click_pipeline = [
        {'$match': click_match},
        {
            '$group': {
                '_id': click_group_id,
                'clicks': {'$sum': 1}
            }
        }
    ]
    
    click_results = list(user_reports.clicks_collection.aggregate(click_pipeline))
    print(f"\n📊 CLICK RESULTS ({len(click_results)}):")
    for i, result in enumerate(click_results[:3]):
        print(f"  {i+1}. Key: {result['_id']} | Clicks: {result['clicks']}")
    
    # Run conversion aggregation  
    conv_pipeline = [
        {'$match': conversion_match},
        {
            '$group': {
                '_id': conv_group_id,
                'conversions': {'$sum': 1},
                'total_payout': {'$sum': '$payout'}
            }
        }
    ]
    
    conversion_results = list(user_reports.conversions_collection.aggregate(conv_pipeline))
    print(f"\n💰 CONVERSION RESULTS ({len(conversion_results)}):")
    for i, result in enumerate(conversion_results[:3]):
        print(f"  {i+1}. Key: {result['_id']} | Conversions: {result['conversions']} | Payout: ${result['total_payout']:.2f}")
    
    # Check for matching keys
    click_keys = set(str(r['_id']) for r in click_results)
    conv_keys = set(str(r['_id']) for r in conversion_results)
    
    print(f"\n🔑 KEY ANALYSIS:")
    print(f"  Click keys: {len(click_keys)}")
    print(f"  Conversion keys: {len(conv_keys)}")
    print(f"  Matching keys: {len(click_keys & conv_keys)}")
    print(f"  Click-only keys: {len(click_keys - conv_keys)}")
    print(f"  Conversion-only keys: {len(conv_keys - click_keys)}")
    
    if click_keys & conv_keys:
        print(f"\n✅ MATCHING KEYS:")
        for key in list(click_keys & conv_keys)[:3]:
            print(f"  {key}")
    
    if conv_keys - click_keys:
        print(f"\n❌ CONVERSION-ONLY KEYS (no matching clicks):")
        for key in list(conv_keys - click_keys)[:3]:
            print(f"  {key}")
        
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()

print("\n" + "=" * 60)
print("🎯 DIAGNOSIS COMPLETE")
