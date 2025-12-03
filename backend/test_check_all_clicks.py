#!/usr/bin/env python3
"""Check all clicks to understand the pattern"""

from database import db_instance
import json

db = db_instance.get_db()

clicks_detailed_col = db_instance.get_collection('offerwall_clicks_detailed')
clicks_col = db_instance.get_collection('offerwall_clicks')

print("📊 Collection counts:")
print(f"  offerwall_clicks_detailed: {clicks_detailed_col.count_documents({})}")
print(f"  offerwall_clicks: {clicks_col.count_documents({})}")

# Get last 5 clicks from each
print("\n📋 Last 5 from offerwall_clicks_detailed:")
for click in clicks_detailed_col.find().sort('timestamp', -1).limit(5):
    print(f"  - {click.get('click_id')}: device={click.get('device', {}).get('browser')}")

print("\n📋 Last 5 from offerwall_clicks:")
for click in clicks_col.find().sort('timestamp', -1).limit(5):
    print(f"  - {click.get('click_id')}: user_id={click.get('user_id')}")

# Check if the comprehensive tracking is even being called
# by looking for a click that has both device and geo info
print("\n🔍 Checking if comprehensive tracking is working...")
comprehensive_click = clicks_detailed_col.find_one({
    'device.browser': {'$ne': None},
    'geo.country': {'$ne': 'Unknown'}
})

if comprehensive_click:
    print(f"✅ Found comprehensive click: {comprehensive_click.get('click_id')}")
else:
    print(f"❌ No comprehensive clicks found")
