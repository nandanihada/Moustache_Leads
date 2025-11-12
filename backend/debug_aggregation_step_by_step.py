"""
Debug aggregation step by step
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from models.user_reports import UserReports
from datetime import datetime

print("🔍 Debugging Aggregation Step by Step...")
print("=" * 60)

try:
    user_reports = UserReports()
    
    date_range = {
        'start': datetime(2025, 11, 1),
        'end': datetime(2025, 11, 15)
    }
    
    click_match = {
        'click_time': {
            '$gte': date_range['start'],
            '$lte': date_range['end']
        }
    }
    
    print("Step 1: Test basic match")
    basic_match_result = list(user_reports.clicks_collection.find(click_match).limit(2))
    print(f"Found {len(basic_match_result)} clicks")
    if basic_match_result:
        sample = basic_match_result[0]
        print(f"Sample click: is_unique={sample.get('is_unique')}, offer_id={sample.get('offer_id')}")
    
    print("\nStep 2: Test aggregation with match only")
    agg_match_only = list(user_reports.clicks_collection.aggregate([
        {'$match': click_match},
        {'$limit': 2}
    ]))
    print(f"Aggregation match result: {len(agg_match_only)}")
    if agg_match_only:
        sample = agg_match_only[0]
        print(f"Sample from agg: is_unique={sample.get('is_unique')}, offer_id={sample.get('offer_id')}")
    
    print("\nStep 3: Test simple grouping")
    simple_group = list(user_reports.clicks_collection.aggregate([
        {'$match': click_match},
        {
            '$group': {
                '_id': '$offer_id',
                'count': {'$sum': 1},
                'unique_count': {'$sum': {'$cond': [{'$eq': ['$is_unique', True]}, 1, 0]}}
            }
        }
    ]))
    print(f"Simple group result: {len(simple_group)}")
    for result in simple_group:
        print(f"  Offer {result['_id']}: total={result['count']}, unique={result['unique_count']}")
    
    print("\nStep 4: Test the exact grouping from our code")
    click_group_id = {
        'date': {
            '$dateToString': {'format': '%Y-%m-%d', 'date': '$click_time'}
        },
        'offer_id': '$offer_id'
    }
    
    exact_group = list(user_reports.clicks_collection.aggregate([
        {'$match': click_match},
        {
            '$group': {
                '_id': click_group_id,
                'clicks': {'$sum': 1},
                'unique_clicks': {'$sum': {'$cond': [{'$eq': ['$is_unique', True]}, 1, 0]}}
            }
        }
    ]))
    print(f"Exact group result: {len(exact_group)}")
    for result in exact_group[:3]:
        print(f"  {result['_id']}: clicks={result['clicks']}, unique={result['unique_clicks']}")
        
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()

print("\n" + "=" * 60)
print("🎯 STEP BY STEP DEBUG COMPLETE")
