#!/usr/bin/env python3
"""
Debug why query isn't returning clicks
"""

import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from database import db_instance
from datetime import datetime, timedelta
import jwt

def debug_query():
    """Debug the performance report query"""
    
    print("\n🔍 DEBUGGING PERFORMANCE REPORT QUERY")
    print("="*70)
    
    # Get user ID from token
    try:
        with open('jwt_token.txt', 'r') as f:
            token = f.read().strip()
        decoded = jwt.decode(token, options={"verify_signature": False})
        user_id = decoded.get('user_id')
        print(f"User ID from token: {user_id}")
        print(f"Type: {type(user_id)}")
    except Exception as e:
        print(f"❌ Error: {e}")
        return
    
    # Get clicks collection
    clicks_collection = db_instance.get_collection('clicks')
    
    # Check what user_id looks like in database
    print(f"\n📊 Checking clicks in database:")
    all_clicks = list(clicks_collection.find({}, {'click_id': 1, 'user_id': 1, 'affiliate_id': 1, 'click_time': 1}))
    
    for click in all_clicks:
        print(f"\n  Click: {click.get('click_id')}")
        print(f"    user_id: {click.get('user_id')} (type: {type(click.get('user_id'))})")
        print(f"    affiliate_id: {click.get('affiliate_id')} (type: {type(click.get('affiliate_id'))})")
        print(f"    click_time: {click.get('click_time')}")
    
    # Test different query variations
    print(f"\n🧪 TESTING QUERIES:")
    print("="*70)
    
    # Query 1: Exact user_id match
    print(f"\n1. Exact user_id match:")
    query1 = {'user_id': user_id}
    count1 = clicks_collection.count_documents(query1)
    print(f"   Query: {query1}")
    print(f"   Result: {count1} clicks")
    
    # Query 2: Exact affiliate_id match
    print(f"\n2. Exact affiliate_id match:")
    query2 = {'affiliate_id': user_id}
    count2 = clicks_collection.count_documents(query2)
    print(f"   Query: {query2}")
    print(f"   Result: {count2} clicks")
    
    # Query 3: $or query (what the API uses)
    print(f"\n3. $or query (API uses this):")
    query3 = {
        '$or': [
            {'affiliate_id': user_id},
            {'user_id': user_id}
        ]
    }
    count3 = clicks_collection.count_documents(query3)
    print(f"   Query: {query3}")
    print(f"   Result: {count3} clicks")
    
    # Query 4: With date range
    print(f"\n4. With date range:")
    end_date = datetime.utcnow()
    start_date = end_date - timedelta(days=30)
    
    query4 = {
        '$or': [
            {'affiliate_id': user_id},
            {'user_id': user_id}
        ],
        'click_time': {
            '$gte': start_date,
            '$lte': end_date
        }
    }
    count4 = clicks_collection.count_documents(query4)
    print(f"   Query: {query4}")
    print(f"   Date range: {start_date.date()} to {end_date.date()}")
    print(f"   Result: {count4} clicks")
    
    # Query 5: Test aggregation
    print(f"\n5. Test aggregation (what reports do):")
    
    pipeline = [
        {'$match': query4},
        {
            '$group': {
                '_id': {
                    'date': {
                        '$dateToString': {'format': '%Y-%m-%d', 'date': '$click_time'}
                    }
                },
                'clicks': {'$sum': 1}
            }
        }
    ]
    
    print(f"   Pipeline: {pipeline}")
    
    try:
        results = list(clicks_collection.aggregate(pipeline))
        print(f"   Result: {len(results)} groups")
        
        for result in results:
            print(f"     Date: {result['_id']['date']}, Clicks: {result['clicks']}")
    except Exception as e:
        print(f"   ❌ Aggregation error: {e}")
    
    print("\n" + "="*70)
    print("🎯 DIAGNOSIS:")
    print("="*70)
    
    if count1 > 0 or count2 > 0:
        print("\n✅ User ID matches!")
        
        if count4 > 0:
            print("✅ Date range includes the click!")
            print("\n⚠️  If reports are still empty, the issue is:")
            print("   - Frontend might be using different date range")
            print("   - Aggregation might have an error")
            print("   - Check browser console for errors")
        else:
            print("\n❌ Date range excludes the click!")
            print("   Click is outside the last 30 days")
            print("   Frontend needs wider date range")
    else:
        print("\n❌ User ID doesn't match!")
        print(f"   Token user_id: {user_id}")
        print(f"   Database user_id: {all_clicks[0].get('user_id') if all_clicks else 'None'}")
        print("\n   Possible fixes:")
        print("   1. Re-click the tracking link")
        print("   2. Check if user_id is being saved correctly")

if __name__ == '__main__':
    debug_query()
