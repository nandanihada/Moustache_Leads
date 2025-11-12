"""
Debug the exact merging logic to see why conversions aren't being merged
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from models.user_reports import UserReports
from datetime import datetime
import json

print("🔍 Debugging Merge Logic...")
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
    
    # Run conversion aggregation  
    conv_pipeline = [
        {'$match': conversion_match},
        {
            '$group': {
                '_id': conv_group_id,
                'conversions': {'$sum': 1},
                'total_payout': {'$sum': '$payout'},
                'approved_conversions': {
                    '$sum': {'$cond': [{'$eq': ['$status', 'approved']}, 1, 0]}
                },
                'pending_conversions': {
                    '$sum': {'$cond': [{'$eq': ['$status', 'pending']}, 1, 0]}
                },
                'rejected_conversions': {
                    '$sum': {'$cond': [{'$eq': ['$status', 'rejected']}, 1, 0]}
                }
            }
        }
    ]
    
    conversion_results = list(user_reports.conversions_collection.aggregate(conv_pipeline))
    
    print(f"\n📊 CLICK RESULTS ({len(click_results)}):")
    for result in click_results:
        key = str(result['_id'])
        print(f"  Key: '{key}' | Clicks: {result['clicks']}")
    
    print(f"\n💰 CONVERSION RESULTS ({len(conversion_results)}):")
    for result in conversion_results:
        key = str(result['_id'])
        print(f"  Key: '{key}' | Conversions: {result['conversions']} | Payout: ${result['total_payout']:.2f}")
    
    # Test the merge logic
    print(f"\n🔄 MERGE LOGIC TEST:")
    merged_data = {}
    
    # Add clicks first
    for click_row in click_results:
        key = str(click_row['_id'])
        merged_data[key] = {
            **click_row['_id'],
            'clicks': click_row['clicks'],
            'conversions': 0,
            'total_payout': 0.0
        }
        print(f"  Added click key: '{key}'")
    
    # Try to merge conversions
    for conv_row in conversion_results:
        key = str(conv_row['_id'])
        print(f"  Looking for conversion key: '{key}'")
        if key in merged_data:
            print(f"    ✅ MATCH FOUND! Updating with {conv_row['conversions']} conversions")
            merged_data[key].update({
                'conversions': conv_row['conversions'],
                'total_payout': conv_row['total_payout']
            })
        else:
            print(f"    ❌ NO MATCH! Available keys: {list(merged_data.keys())}")
    
    print(f"\n📋 FINAL MERGED DATA:")
    for key, data in merged_data.items():
        print(f"  {key}: Clicks={data['clicks']}, Conversions={data['conversions']}, Payout=${data['total_payout']}")
        
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()

print("\n" + "=" * 60)
print("🎯 MERGE DEBUG COMPLETE")
