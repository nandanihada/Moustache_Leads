#!/usr/bin/env python3
"""
Check postback system status - just database check
"""

from database import db_instance

print("\n" + "="*80)
print("🔍 POSTBACK SYSTEM STATUS CHECK")
print("="*80)

# Check placements with postbackUrl
print("\n📋 Placements with postbackUrl configured:")
placements = db_instance.get_collection('placements')
placements_with_postback = list(placements.find({
    'postbackUrl': {'$exists': True, '$ne': '', '$ne': None}
}))

print(f"\nFound {len(placements_with_postback)} placements:")
for i, p in enumerate(placements_with_postback, 1):
    print(f"\n{i}. {p.get('offerwallTitle', 'Unknown')}")
    print(f"   ID: {p.get('_id')}")
    print(f"   Postback URL: {p.get('postbackUrl')}")

if len(placements_with_postback) == 0:
    print("\n⚠️  WARNING: No placements have postbackUrl configured!")
    print("   Postback forwarding won't work until you configure postback URLs.")
else:
    print(f"\n✅ {len(placements_with_postback)} placements ready to receive postbacks!")

# Check recent postback logs
print("\n" + "="*80)
print("📊 Recent Postback Forwarding Logs:")
print("="*80)

logs = db_instance.get_collection('placement_postback_logs')
if logs is not None:
    recent = list(logs.find().sort('timestamp', -1).limit(10))
    
    if len(recent) == 0:
        print("\nNo postback forwarding logs found yet.")
        print("This is normal if no postbacks have been received yet.")
    else:
        print(f"\nFound {len(recent)} recent forwards:")
        for i, log in enumerate(recent, 1):
            print(f"\n{i}. {log.get('placement_title', 'Unknown')}")
            print(f"   URL: {log.get('postback_url')}")
            print(f"   Status: {log.get('status')}")
            print(f"   Response: {log.get('response_code')}")
            print(f"   Time: {log.get('timestamp')}")
            if log.get('error'):
                print(f"   Error: {log.get('error')}")

# Check received postbacks
print("\n" + "="*80)
print("📥 Recent Received Postbacks:")
print("="*80)

received = db_instance.get_collection('received_postbacks')
if received is not None:
    recent_pb = list(received.find().sort('timestamp', -1).limit(5))
    
    if len(recent_pb) == 0:
        print("\nNo postbacks received yet.")
    else:
        print(f"\nFound {len(recent_pb)} recent postbacks:")
        for i, pb in enumerate(recent_pb, 1):
            params = pb.get('query_params', {})
            print(f"\n{i}. Conversion: {params.get('conversion_id', 'N/A')}")
            print(f"   Partner: {pb.get('partner_name', 'Unknown')}")
            print(f"   Time: {pb.get('timestamp')}")
            print(f"   Status: {pb.get('status')}")

print("\n" + "="*80)
print("✅ Status check complete!")
print("="*80)
