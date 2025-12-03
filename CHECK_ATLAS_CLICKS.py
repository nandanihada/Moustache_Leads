#!/usr/bin/env python3
"""
Check clicks in MongoDB Atlas
"""

import sys
sys.path.insert(0, 'd:\\pepeleads\\ascend\\lovable-ascend\\backend')

from database import db_instance

USER_ID = "test_user"
PLACEMENT_ID = "4hN81lEwE7Fw1hnI"

print("=" * 80)
print("🔍 CHECKING ATLAS CLICKS")
print("=" * 80)

db = db_instance.get_db()

# Check offerwall_clicks
print("\n📊 OFFERWALL_CLICKS Collection:")
clicks_col = db['offerwall_clicks']
total = clicks_col.count_documents({})
print(f"  Total documents: {total}")

# Get all clicks
all_clicks = list(clicks_col.find().sort('timestamp', -1).limit(10))
print(f"\n  Recent clicks:")
for i, click in enumerate(all_clicks, 1):
    print(f"  {i}. {click.get('offer_name')} ({click.get('offer_id')})")
    print(f"     User: {click.get('user_id')}")
    print(f"     Placement: {click.get('placement_id')}")
    print(f"     Time: {click.get('timestamp')}")
    print()

# Check for test_user specifically
print(f"\n  Clicks for user '{USER_ID}':")
user_clicks = list(clicks_col.find({'user_id': USER_ID}).sort('timestamp', -1))
print(f"  Total: {len(user_clicks)}")
for click in user_clicks:
    print(f"    - {click.get('offer_name')} at {click.get('timestamp')}")

# Check offerwall_activities
print("\n📊 OFFERWALL_ACTIVITIES Collection:")
activities_col = db['offerwall_activities']
total = activities_col.count_documents({})
print(f"  Total documents: {total}")

all_activities = list(activities_col.find().sort('completed_at', -1).limit(5))
print(f"\n  Recent activities:")
for i, activity in enumerate(all_activities, 1):
    print(f"  {i}. {activity.get('offer_title')} ({activity.get('offer_id')})")
    print(f"     User: {activity.get('user_id')}")
    print(f"     Status: {activity.get('status')}")
    print()

print("=" * 80)
print("✅ CHECK COMPLETE")
print("=" * 80)
