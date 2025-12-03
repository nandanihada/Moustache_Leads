#!/usr/bin/env python3
"""
Comprehensive diagnostic to find where clicks are being saved
"""

from pymongo import MongoClient
import json

# Connect to MongoDB
client = MongoClient('mongodb://localhost:27017/')
db = client['ascend_db']

print("=" * 80)
print("🔍 COMPREHENSIVE DIAGNOSTIC")
print("=" * 80)

# List all collections
print("\n📋 All Collections in Database:")
collections = db.list_collection_names()
for col in sorted(collections):
    count = db[col].count_documents({})
    print(f"  - {col}: {count} documents")

# Look for any clicks collection
print("\n🔎 Looking for click-related collections:")
for col in collections:
    if 'click' in col.lower():
        print(f"\n  📌 Found: {col}")
        count = db[col].count_documents({})
        print(f"     Total documents: {count}")
        
        # Get sample documents
        samples = list(db[col].find().limit(3))
        if samples:
            print(f"     Sample documents:")
            for sample in samples:
                print(f"       - {json.dumps({k: str(v)[:50] for k, v in sample.items()}, indent=10)}")

# Look for any activity collection
print("\n🔎 Looking for activity-related collections:")
for col in collections:
    if 'activity' in col.lower() or 'conversion' in col.lower():
        print(f"\n  📌 Found: {col}")
        count = db[col].count_documents({})
        print(f"     Total documents: {count}")

# Check offerwall_clicks specifically
print("\n🔎 Checking offerwall_clicks collection:")
clicks_col = db['offerwall_clicks']
total = clicks_col.count_documents({})
print(f"  Total documents: {total}")

if total > 0:
    # Get all unique user_ids
    user_ids = clicks_col.distinct('user_id')
    print(f"  Unique users: {user_ids}")
    
    # Get all unique placement_ids
    placement_ids = clicks_col.distinct('placement_id')
    print(f"  Unique placements: {placement_ids}")
    
    # Get recent clicks
    recent = list(clicks_col.find().sort('timestamp', -1).limit(5))
    print(f"  Recent clicks:")
    for click in recent:
        print(f"    - {click.get('offer_name')} ({click.get('user_id')}) at {click.get('timestamp')}")

# Check if there's a different database being used
print("\n🔎 Checking all databases:")
admin_db = client['admin']
db_list = admin_db.command('listDatabases')
for db_info in db_list['databases']:
    print(f"  - {db_info['name']}: {db_info['sizeOnDisk']} bytes")

print("\n" + "=" * 80)
print("✅ DIAGNOSTIC COMPLETE")
print("=" * 80)
