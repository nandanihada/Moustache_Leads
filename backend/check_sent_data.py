"""
Check what data was sent in the postback
"""

from database import db_instance
from datetime import datetime, timedelta

if not db_instance.is_connected():
    print("❌ Database not connected!")
    exit(1)

# Get recent placement postback logs
logs_collection = db_instance.get_collection('placement_postback_logs')

# Get logs from last 5 minutes
five_min_ago = datetime.utcnow() - timedelta(minutes=5)
recent_logs = list(logs_collection.find({
    'timestamp': {'$gte': five_min_ago}
}).sort('timestamp', -1).limit(10))

print("="*80)
print(f"📋 RECENT POSTBACK FORWARDS (Last 5 minutes)")
print("="*80)

if len(recent_logs) == 0:
    print("⚠️ No recent postback forwards found")
else:
    for idx, log in enumerate(recent_logs, 1):
        print(f"\n{idx}. Placement: {log.get('placement_title')}")
        print(f"   Time: {log.get('timestamp')}")
        print(f"   Status: {log.get('status')}")
        
        url = log.get('postback_url', '')
        print(f"   URL: {url}")
        
        # Extract parameters from URL
        if '?' in url:
            params_str = url.split('?')[1]
            params = dict(p.split('=') for p in params_str.split('&') if '=' in p)
            
            print(f"\n   📊 Parameters sent:")
            for key, value in params.items():
                print(f"      {key} = {value}")
            
            # Check for username and payout
            if 'username' in params:
                print(f"\n   ✅ Username sent: {params['username']}")
            else:
                print(f"\n   ❌ Username NOT in URL")
            
            if 'payout' in params:
                print(f"   ✅ Payout sent: {params['payout']} points")
            else:
                print(f"   ❌ Payout NOT in URL")
        
        print(f"\n   Response: {log.get('response_body', 'N/A')[:100]}")
        print("-"*80)

print("\n" + "="*80)
print("✅ DONE")
print("="*80)
