"""
Check latest forwarded postback
"""
import sys
sys.path.append('.')

from database import db_instance

if not db_instance.is_connected():
    db_instance.connect()

print("="*80)
print("LATEST FORWARDED POSTBACK")
print("="*80)

forwarded = db_instance.get_collection('forwarded_postbacks')
if forwarded is not None:
    latest = list(forwarded.find().sort('timestamp', -1).limit(1))
    if latest:
        fwd = latest[0]
        print(f"\n✅ Postback WAS forwarded!")
        print(f"   Timestamp: {fwd.get('timestamp')}")
        print(f"   Publisher: {fwd.get('publisher_name')}")
        print(f"   Username: {fwd.get('username')}")
        print(f"   Points: {fwd.get('points')}")
        print(f"   Forward URL: {fwd.get('forward_url')}")
        print(f"   Status: {fwd.get('forward_status')}")
        print(f"   Response Code: {fwd.get('response_code')}")
        print(f"   Response Body: {fwd.get('response_body', '')[:200]}")
    else:
        print("\n⚠️ No forwarded postbacks in database")

print("="*80)
