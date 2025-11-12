"""
Debug the click aggregation to see why unique_clicks is 0
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from models.user_reports import UserReports
from datetime import datetime
import json

print("🔍 Debugging Click Aggregation...")
print("=" * 60)

try:
    user_reports = UserReports()
    
    # Test with the actual date range from our data
    date_range = {
        'start': datetime(2025, 11, 1),
        'end': datetime(2025, 11, 15)
    }
    
    print(f"📅 Date range: {date_range['start']} to {date_range['end']}")
    
    # Test click aggregation
    click_match = {
        'click_time': {
            '$gte': date_range['start'],
            '$lte': date_range['end']
        }
    }
    
    click_group_id = {
        'date': {
            '$dateToString': {'format': '%Y-%m-%d', 'date': '$click_time'}
        },
        'offer_id': '$offer_id'
    }
    
    # Test the aggregation pipeline
    click_pipeline = [
        {'$match': click_match},
        {
            '$group': {
                '_id': click_group_id,
                'clicks': {'$sum': 1},
                'gross_clicks': {'$sum': 1},
                'unique_clicks': {
                    '$sum': {'$cond': [{'$eq': ['$is_unique', True]}, 1, 0]}
                },
                'suspicious_clicks': {
                    '$sum': {'$cond': [{'$eq': ['$is_suspicious', True]}, 1, 0]}
                },
                'rejected_clicks': {
                    '$sum': {'$cond': [{'$eq': ['$is_rejected', True]}, 1, 0]}
                }
            }
        }
    ]
    
    print(f"\n🔍 TESTING CLICK AGGREGATION:")
    click_results = list(user_reports.clicks_collection.aggregate(click_pipeline))
    print(f"Results: {len(click_results)}")
    
    for result in click_results:
        print(f"  {result['_id']}: clicks={result['clicks']}, unique={result['unique_clicks']}, suspicious={result['suspicious_clicks']}, rejected={result['rejected_clicks']}")
    
    # Check individual clicks in this date range
    print(f"\n🔍 INDIVIDUAL CLICKS IN DATE RANGE:")
    clicks_in_range = list(user_reports.clicks_collection.find(click_match).limit(10))
    print(f"Found {len(clicks_in_range)} clicks in date range")
    
    for i, click in enumerate(clicks_in_range[:5]):
        print(f"  Click {i+1}: offer_id={click.get('offer_id')}, date={click.get('click_time')}, is_unique={click.get('is_unique')}, is_suspicious={click.get('is_suspicious')}, is_rejected={click.get('is_rejected')}")
        
    # Count flags in date range
    total_in_range = user_reports.clicks_collection.count_documents(click_match)
    unique_in_range = user_reports.clicks_collection.count_documents({**click_match, 'is_unique': True})
    suspicious_in_range = user_reports.clicks_collection.count_documents({**click_match, 'is_suspicious': True})
    rejected_in_range = user_reports.clicks_collection.count_documents({**click_match, 'is_rejected': True})
    
    print(f"\n📊 TOTALS IN DATE RANGE:")
    print(f"  Total clicks: {total_in_range}")
    print(f"  Unique clicks: {unique_in_range}")
    print(f"  Suspicious clicks: {suspicious_in_range}")
    print(f"  Rejected clicks: {rejected_in_range}")
        
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()

print("\n" + "=" * 60)
print("🎯 CLICK AGGREGATION DEBUG COMPLETE")
