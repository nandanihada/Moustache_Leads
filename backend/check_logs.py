#!/usr/bin/env python3
from database import db_instance
from datetime import datetime, timedelta

logs = db_instance.get_collection('placement_postback_logs')
recent = list(logs.find({
    'timestamp': {'$gte': datetime.utcnow() - timedelta(minutes=2)}
}).sort('timestamp', -1))

print(f'\n📊 Forwarding logs in last 2 minutes: {len(recent)}\n')

if len(recent) == 0:
    print("❌ NO LOGS! The forwarding code is NOT running or NOT saving logs.")
else:
    for i, log in enumerate(recent[:10], 1):
        print(f"{i}. {log.get('placement_title')}")
        print(f"   Status: {log.get('status')}")
        print(f"   Response: {log.get('response_code')}")
        print(f"   URL: {log.get('postback_url')[:80]}...")
        print()
