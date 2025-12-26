"""
Check if postback was received and processed
"""
import sys
sys.path.append('.')

from database import db_instance

# Connect
if not db_instance.is_connected():
    db_instance.connect()

print("="*80)
print("CHECKING POSTBACK RESULTS")
print("="*80)

# Check received_postbacks
received = db_instance.get_collection('received_postbacks')
if received:
    latest = list(received.find().sort('timestamp', -1).limit(1))
    if latest:
        pb = latest[0]
        print(f"\n✅ Latest Received Postback:")
        print(f"   Timestamp: {pb.get('timestamp')}")
        print(f"   Partner: {pb.get('partner_key')}")
        print(f"   Params: {pb.get('params')}")
    else:
        print("\n⚠️ No postbacks in received_postbacks collection")

# Check forwarded_postbacks
forwarded = db_instance.get_collection('forwarded_postbacks')
if forwarded:
    latest_fwd = list(forwarded.find().sort('timestamp', -1).limit(1))
    if latest_fwd:
        fwd = latest_fwd[0]
        print(f"\n✅ Latest Forwarded Postback:")
        print(f"   Timestamp: {fwd.get('timestamp')}")
        print(f"   Publisher: {fwd.get('publisher_name')}")
        print(f"   Username: {fwd.get('username')}")
        print(f"   Points: {fwd.get('points')}")
        print(f"   URL: {fwd.get('forward_url')}")
        print(f"   Status: {fwd.get('forward_status')}")
        print(f"   Response: {fwd.get('response_code')}")
    else:
        print("\n⚠️ No postbacks in forwarded_postbacks collection")

print("="*80)
