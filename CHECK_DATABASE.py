#!/usr/bin/env python3
"""
Check what's in the database for clicks and activities
"""

from pymongo import MongoClient
from datetime import datetime

# Connect to MongoDB
client = MongoClient('mongodb://localhost:27017/')
db = client['ascend_db']

USER_ID = "test_user"
PLACEMENT_ID = "4hN81lEwE7Fw1hnI"

print("=" * 80)
print("🔍 DATABASE CHECK - OFFERWALL TRACKING")
print("=" * 80)

# Check clicks
print("\n📊 CHECKING OFFERWALL_CLICKS COLLECTION")
print("-" * 80)
clicks_col = db['offerwall_clicks']
clicks = list(clicks_col.find({
    'user_id': USER_ID,
    'placement_id': PLACEMENT_ID
}).sort('timestamp', -1).limit(10))

print(f"Total clicks for user {USER_ID}: {clicks_col.count_documents({'user_id': USER_ID, 'placement_id': PLACEMENT_ID})}")
print(f"Recent clicks:")
for i, click in enumerate(clicks, 1):
    print(f"  {i}. {click.get('offer_name')} ({click.get('offer_id')})")
    print(f"     Time: {click.get('timestamp')}")
    print(f"     Click ID: {click.get('click_id')}")
    print()

# Check activities
print("\n📊 CHECKING OFFERWALL_ACTIVITIES COLLECTION")
print("-" * 80)
activities_col = db['offerwall_activities']
activities = list(activities_col.find({
    'user_id': USER_ID,
    'placement_id': PLACEMENT_ID
}).sort('completed_at', -1).limit(10))

print(f"Total activities for user {USER_ID}: {activities_col.count_documents({'user_id': USER_ID, 'placement_id': PLACEMENT_ID})}")
print(f"Recent activities:")
for i, activity in enumerate(activities, 1):
    print(f"  {i}. {activity.get('offer_title')} ({activity.get('offer_id')})")
    print(f"     Status: {activity.get('status')}")
    print(f"     Completed at: {activity.get('completed_at')}")
    print()

# Check sessions
print("\n📊 CHECKING OFFERWALL_SESSIONS COLLECTION")
print("-" * 80)
sessions_col = db['offerwall_sessions']
sessions = list(sessions_col.find({
    'user_id': USER_ID,
    'placement_id': PLACEMENT_ID
}).sort('created_at', -1).limit(5))

print(f"Total sessions for user {USER_ID}: {sessions_col.count_documents({'user_id': USER_ID, 'placement_id': PLACEMENT_ID})}")
print(f"Recent sessions:")
for i, session in enumerate(sessions, 1):
    print(f"  {i}. Session ID: {session.get('session_id')}")
    print(f"     Created: {session.get('created_at')}")
    print(f"     Clicks: {session.get('clicks_count', 0)}")
    print()

print("\n" + "=" * 80)
print("✅ DATABASE CHECK COMPLETE")
print("=" * 80)
