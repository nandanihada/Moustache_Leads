"""
Test the aggregation pipeline step by step
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from models.user_reports import UserReports
from datetime import datetime
import json

print("🔍 Testing Aggregation Pipeline...")
print("=" * 60)

try:
    user_reports = UserReports()
    
    # Test with the actual date range from our data
    date_range = {
        'start': datetime(2025, 11, 1),
        'end': datetime(2025, 11, 15)
    }
    
    print(f"📅 Date range: {date_range['start']} to {date_range['end']}")
    
    # Test conversion aggregation with fixed pipeline
    conversion_match = {
        'conversion_time': {
            '$gte': date_range['start'],
            '$lte': date_range['end']
        }
    }
    
    conv_group_id = {
        'date': {
            '$dateToString': {'format': '%Y-%m-%d', 'date': '$conversion_time'}
        },
        'offer_id': '$offer_id'
    }
    
    # Fixed pipeline without revenue field
    conv_pipeline = [
        {'$match': conversion_match},
        {
            '$group': {
                '_id': conv_group_id,
                'conversions': {'$sum': 1},
                'approved_conversions': {
                    '$sum': {'$cond': [{'$eq': ['$status', 'approved']}, 1, 0]}
                },
                'pending_conversions': {
                    '$sum': {'$cond': [{'$eq': ['$status', 'pending']}, 1, 0]}
                },
                'rejected_conversions': {
                    '$sum': {'$cond': [{'$eq': ['$status', 'rejected']}, 1, 0]}
                },
                'total_payout': {'$sum': '$payout'}
            }
        }
    ]
    
    print(f"\n🔍 TESTING CONVERSION AGGREGATION:")
    conversion_results = list(user_reports.conversions_collection.aggregate(conv_pipeline))
    print(f"Results: {len(conversion_results)}")
    
    for result in conversion_results:
        print(f"  {result['_id']}: {result['conversions']} conversions, ${result['total_payout']:.2f}")
    
    if conversion_results:
        print(f"\n✅ AGGREGATION WORKS! Found {len(conversion_results)} conversion groups")
        total_conversions = sum(r['conversions'] for r in conversion_results)
        total_payout = sum(r['total_payout'] for r in conversion_results)
        print(f"Total conversions: {total_conversions}")
        print(f"Total payout: ${total_payout:.2f}")
    else:
        print(f"\n❌ NO RESULTS FROM AGGREGATION")
        
    # Test if the issue is in the user_id filtering
    print(f"\n🔍 TESTING USER_ID FILTERING:")
    conversion_match_with_user = {
        'conversion_time': {
            '$gte': date_range['start'],
            '$lte': date_range['end']
        },
        'user_id': 'test-user'  # This might be the issue!
    }
    
    conv_pipeline_with_user = [
        {'$match': conversion_match_with_user},
        {
            '$group': {
                '_id': conv_group_id,
                'conversions': {'$sum': 1},
                'total_payout': {'$sum': '$payout'}
            }
        }
    ]
    
    conversion_results_with_user = list(user_reports.conversions_collection.aggregate(conv_pipeline_with_user))
    print(f"Results with user_id filter: {len(conversion_results_with_user)}")
    
    if not conversion_results_with_user:
        print(f"❌ USER_ID FILTER IS THE PROBLEM!")
        # Check what user_ids exist
        user_ids = user_reports.conversions_collection.distinct('user_id')
        print(f"Available user_ids: {user_ids}")
        
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()

print("\n" + "=" * 60)
print("🎯 AGGREGATION TEST COMPLETE")
