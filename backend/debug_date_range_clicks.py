"""
Debug clicks in the exact date range we're using
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from pymongo import MongoClient
from dotenv import load_dotenv
from datetime import datetime

load_dotenv()

client = MongoClient(os.getenv('MONGO_URI', 'mongodb://localhost:27017/'))
db = client['affiliate_system']

# Use the exact same date range as the API
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

print(f"Date range: {date_range['start']} to {date_range['end']}")

# Find clicks in this range
clicks_in_range = list(db.clicks.find(click_match))
print(f"Found {len(clicks_in_range)} clicks in date range")

if clicks_in_range:
    print("\nFirst few clicks:")
    for i, click in enumerate(clicks_in_range[:3]):
        print(f"  Click {i+1}:")
        print(f"    Date: {click.get('click_time')}")
        print(f"    Offer: {click.get('offer_id')}")
        print(f"    is_unique: {click.get('is_unique')} (type: {type(click.get('is_unique'))})")
        print(f"    is_suspicious: {click.get('is_suspicious')} (type: {type(click.get('is_suspicious'))})")
        print(f"    is_rejected: {click.get('is_rejected')} (type: {type(click.get('is_rejected'))})")
        print()

# Check all clicks to see their date ranges
all_clicks = list(db.clicks.find({}, {'click_time': 1, 'is_unique': 1}).sort('click_time', 1))
if all_clicks:
    print(f"All clicks date range:")
    print(f"  Earliest: {all_clicks[0]['click_time']}")
    print(f"  Latest: {all_clicks[-1]['click_time']}")
    
    # Check if any clicks are actually in our target range
    clicks_in_target = [c for c in all_clicks if date_range['start'] <= c['click_time'] <= date_range['end']]
    print(f"  Clicks in target range: {len(clicks_in_target)}")
    
    if clicks_in_target:
        print(f"  Sample from target range: {clicks_in_target[0]}")
else:
    print("No clicks found at all!")
