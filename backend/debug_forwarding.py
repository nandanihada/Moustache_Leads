#!/usr/bin/env python3
"""
Check the most recent received postback and see what happened
"""

from database import db_instance
from datetime import datetime

print("\n" + "="*80)
print("🔍 DEBUGGING POSTBACK FORWARDING")
print("="*80)

# Get the most recent postback
received = db_instance.get_collection('received_postbacks')
latest = received.find_one(sort=[('timestamp', -1)])

if not latest:
    print("\n❌ No postbacks found")
    exit(1)

print("\n📥 Latest Received Postback:")
print(f"   ID: {latest.get('_id')}")
print(f"   Partner: {latest.get('partner_name')}")
print(f"   Timestamp: {latest.get('timestamp')}")
print(f"   Status: {latest.get('status')}")
print(f"   Query Params: {latest.get('query_params')}")

# Check if there are any forwarding logs for this postback
logs = db_instance.get_collection('placement_postback_logs')
source_id = str(latest.get('_id'))
related_logs = list(logs.find({'source_postback_id': source_id}))

print(f"\n📤 Forwarding Logs for this Postback:")
print(f"   Found: {len(related_logs)} logs")

if len(related_logs) == 0:
    print("\n❌ NO FORWARDING LOGS FOUND!")
    print("   This means the forwarding code didn't run or failed silently.")
    print("\n💡 Possible reasons:")
    print("   1. Backend code has an error")
    print("   2. Forwarding code is not being executed")
    print("   3. Error is being caught and not logged")
else:
    for log in related_logs:
        print(f"\n   - Placement: {log.get('placement_title')}")
        print(f"     Status: {log.get('status')}")
        print(f"     URL: {log.get('postback_url')}")

# Check placements
placements = db_instance.get_collection('placements')
count = placements.count_documents({'postbackUrl': {'$exists': True, '$ne': '', '$ne': None}})
print(f"\n📋 Placements with postbackUrl: {count}")

print("\n" + "="*80)
print("🔧 RECOMMENDATION:")
print("="*80)
print("\n1. Check backend logs for errors when the postback was received")
print("2. The forwarding code should log:")
print("   🚀 Forwarding postback to ALL placements...")
print("   📋 Found X placements...")
print("   📤 Sending to placement...")
print("\n3. If you don't see these logs, the code isn't running")
print("\n4. Check if there's an exception being caught")
