#!/usr/bin/env python3
"""
Check if postback forwarding is actually happening
"""

from database import db_instance
from datetime import datetime, timedelta

print("\n" + "="*80)
print("🔍 CHECKING POSTBACK FORWARDING STATUS")
print("="*80)

# Check recent received postbacks
print("\n📥 Recent Received Postbacks (last 5 minutes):")
received = db_instance.get_collection('received_postbacks')
five_min_ago = datetime.utcnow() - timedelta(minutes=5)
recent_received = list(received.find({
    'timestamp': {'$gte': five_min_ago}
}).sort('timestamp', -1).limit(5))

if not recent_received:
    print("   ❌ No postbacks received in last 5 minutes")
else:
    for i, pb in enumerate(recent_received, 1):
        print(f"\n{i}. Time: {pb.get('timestamp')}")
        params = pb.get('query_params', {})
        print(f"   click_id: {params.get('click_id', 'N/A')}")
        print(f"   offer_id: {params.get('offer_id', 'N/A')}")

# Check placement postback logs
print("\n" + "="*80)
print("📤 Placement Postback Forwarding Logs (last 5 minutes):")
print("="*80)

logs = db_instance.get_collection('placement_postback_logs')
recent_logs = list(logs.find({
    'timestamp': {'$gte': five_min_ago}
}).sort('timestamp', -1).limit(10))

if not recent_logs:
    print("\n❌ NO FORWARDING LOGS FOUND!")
    print("   This means the placement forwarding code is NOT running.")
    print("\n   Possible reasons:")
    print("   1. Backend not restarted with new code")
    print("   2. Placement doesn't have postbackUrl")
    print("   3. Code has an error")
else:
    print(f"\n✅ Found {len(recent_logs)} forwarding attempts:")
    for i, log in enumerate(recent_logs, 1):
        print(f"\n{i}. Placement: {log.get('placement_title')}")
        print(f"   Time: {log.get('timestamp')}")
        print(f"   Status: {log.get('status')}")
        print(f"   Response Code: {log.get('response_code')}")
        print(f"   URL: {log.get('postback_url')[:80]}...")
        if log.get('error'):
            print(f"   Error: {log.get('error')}")

# Check placements with postbackUrl
print("\n" + "="*80)
print("📋 Placements with postbackUrl:")
print("="*80)

placements = db_instance.get_collection('placements')
placements_with_url = list(placements.find({
    'postbackUrl': {'$exists': True, '$ne': '', '$ne': None}
}))

print(f"\nTotal: {len(placements_with_url)}")
for p in placements_with_url:
    print(f"   - {p.get('offerwallTitle')}: {p.get('postbackUrl')[:60]}...")

print("\n" + "="*80)
