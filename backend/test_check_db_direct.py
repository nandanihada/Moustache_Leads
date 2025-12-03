#!/usr/bin/env python3
"""Check database directly for the click"""

from database import db_instance
import json

db = db_instance.get_db()

# Check both collections
clicks_detailed_col = db_instance.get_collection('offerwall_clicks_detailed')
clicks_col = db_instance.get_collection('offerwall_clicks')

print("📊 Checking collections...")
print(f"  offerwall_clicks_detailed: {clicks_detailed_col.count_documents({})}")
print(f"  offerwall_clicks: {clicks_col.count_documents({})}")

# Get the most recent click from each
print("\n📋 Most recent from offerwall_clicks_detailed:")
recent_detailed = clicks_detailed_col.find_one({}, sort=[('timestamp', -1)])
if recent_detailed:
    print(f"  Click ID: {recent_detailed.get('click_id')}")
    print(f"  Device: {recent_detailed.get('device', {})}")
    print(f"  Geo: {recent_detailed.get('geo', {})}")
else:
    print("  (empty)")

print("\n📋 Most recent from offerwall_clicks:")
recent_old = clicks_col.find_one({}, sort=[('timestamp', -1)])
if recent_old:
    print(f"  Click ID: {recent_old.get('click_id')}")
    print(f"  Data: {recent_old.get('data', {})}")
else:
    print("  (empty)")
