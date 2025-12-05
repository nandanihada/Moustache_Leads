#!/usr/bin/env python3
"""
Check the most recent postback forwarding logs
"""

from database import db_instance
from datetime import datetime, timedelta

print("\n" + "="*80)
print("🔍 CHECKING POSTBACK FORWARDING LOGS")
print("="*80)

# Check received postbacks
print("\n📥 Recent Received Postbacks:")
received = db_instance.get_collection('received_postbacks')
latest_received = list(received.find().sort('timestamp', -1).limit(3))

for i, pb in enumerate(latest_received, 1):
    print(f"\n{i}. Received at: {pb.get('timestamp')}")
    print(f"   Partner: {pb.get('partner_name')}")
    print(f"   Params: {pb.get('query_params')}")

# Check placement postback logs
print("\n" + "="*80)
print("📤 Placement Postback Forwarding Logs:")
print("="*80)

logs = db_instance.get_collection('placement_postback_logs')
if logs is None:
    print("❌ Cannot access placement_postback_logs collection")
else:
    # Get logs from last 5 minutes
    five_min_ago = datetime.utcnow() - timedelta(minutes=5)
    recent_logs = list(logs.find({
        'timestamp': {'$gte': five_min_ago}
    }).sort('timestamp', -1))
    
    if len(recent_logs) == 0:
        print("\n⚠️  No placement forwarding logs found in last 5 minutes")
        print("   This means the new forwarding code didn't run or no placements have postbackUrl")
        
        # Check if any placements have postbackUrl
        placements = db_instance.get_collection('placements')
        count = placements.count_documents({'postbackUrl': {'$exists': True, '$ne': '', '$ne': None}})
        print(f"\n📋 Placements with postbackUrl: {count}")
        
        if count > 0:
            print("\n⚠️  Placements exist but no logs - check backend logs for errors")
    else:
        print(f"\n✅ Found {len(recent_logs)} forwarding attempts:")
        for i, log in enumerate(recent_logs, 1):
            print(f"\n{i}. Placement: {log.get('placement_title', 'Unknown')}")
            print(f"   URL: {log.get('postback_url')}")
            print(f"   Status: {log.get('status')}")
            print(f"   Response Code: {log.get('response_code')}")
            print(f"   Time: {log.get('timestamp')}")
            if log.get('error'):
                print(f"   Error: {log.get('error')}")

print("\n" + "="*80)
