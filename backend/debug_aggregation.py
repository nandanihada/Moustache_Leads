"""
Debug the aggregation to see why fields are empty
"""

from pymongo import MongoClient
import os
from dotenv import load_dotenv
from datetime import datetime

load_dotenv()

client = MongoClient(os.getenv('MONGO_URI', 'mongodb://localhost:27017/'))
db = client['affiliate_system']

print("🔍 Debugging Aggregation...")
print("=" * 50)

# Check what fields actually exist in clicks
print("📊 Sample click document:")
sample_click = db.clicks.find_one()
if sample_click:
    for key, value in sample_click.items():
        print(f"  {key}: {value}")
else:
    print("  No clicks found!")

print("\n📊 Sample offer document:")
sample_offer = db.offers.find_one()
if sample_offer:
    for key, value in sample_offer.items():
        print(f"  {key}: {value}")
else:
    print("  No offers found!")

# Test the aggregation pipeline manually
print("\n🔍 Testing aggregation pipeline...")

# Get date range
all_dates = [c['click_time'] for c in db.clicks.find({}, {'click_time': 1})]
if all_dates:
    min_date = min(all_dates)
    max_date = max(all_dates)
    
    print(f"📅 Using date range: {min_date} to {max_date}")
    
    # Build match query
    match_query = {
        'click_time': {
            '$gte': min_date,
            '$lte': max_date
        }
    }
    
    # Test basic aggregation
    pipeline = [
        {'$match': match_query},
        {'$limit': 1}
    ]
    
    result = list(db.clicks.aggregate(pipeline))
    print(f"\n📊 Basic aggregation result:")
    if result:
        click = result[0]
        print("Available fields:")
        for key, value in click.items():
            print(f"  {key}: {value}")
            
        # Check the specific fields we need
        print(f"\n🎯 Field values:")
        fields_to_check = ['country', 'browser', 'device_type', 'referer', 'creative', 'advertiser_sub_id1']
        for field in fields_to_check:
            value = click.get(field, 'MISSING')
            print(f"  {field}: {value}")
    
    # Test grouping aggregation
    print(f"\n🔍 Testing grouping aggregation...")
    group_pipeline = [
        {'$match': match_query},
        {
            '$group': {
                '_id': {
                    'date': {'$dateToString': {'format': '%Y-%m-%d', 'date': '$click_time'}},
                    'offer_id': '$offer_id',
                    'country': '$country',
                    'browser': '$browser',
                    'device_type': '$device_type',
                    'source': '$referer',
                    'creative': '$creative',
                    'advertiser_sub_id1': '$advertiser_sub_id1'
                },
                'clicks': {'$sum': 1},
                'gross_clicks': {'$sum': 1}
            }
        },
        {'$limit': 1}
    ]
    
    group_result = list(db.clicks.aggregate(group_pipeline))
    print(f"📊 Group aggregation result:")
    if group_result:
        row = group_result[0]
        print(f"  _id: {row['_id']}")
        print(f"  clicks: {row['clicks']}")
        print(f"  gross_clicks: {row['gross_clicks']}")
    else:
        print("  No results from grouping!")

client.close()
