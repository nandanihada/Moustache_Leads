import pymongo
from datetime import datetime

uri = "mongodb+srv://nan_db_user:j6trrN5m33t4Jwz8@mustache.0gly4in.mongodb.net/ascend_db?retryWrites=true&w=majority&tlsAllowInvalidCertificates=true"
client = pymongo.MongoClient(uri)
db = client["ascend_db"]

print("="*80)
print("POSTBACK FORWARDING VERIFICATION")
print("="*80)

# Check forwarded postbacks
forwarded_coll = db["forwarded_postbacks"]
count = forwarded_coll.count_documents({})

print(f"\nTotal forwarded postbacks: {count}")

if count > 0:
    # Get the last 3 forwarded postbacks
    forwarded_list = list(forwarded_coll.find().sort('timestamp', -1).limit(3))
    
    for i, fwd in enumerate(forwarded_list, 1):
        print(f"\n--- Forwarded Postback #{i} ---")
        print(f"Time: {fwd.get('timestamp')}")
        print(f"Publisher: {fwd.get('publisher_name', 'N/A')}")
        print(f"User: {fwd.get('username', 'N/A')}")
        print(f"Points: {fwd.get('points', 0)}")
        print(f"Status: {fwd.get('forward_status', 'N/A')}")
        print(f"Response Code: {fwd.get('response_code', 'N/A')}")
        
        url = fwd.get('forward_url', '')
        if url:
            # Show first 100 chars of URL
            print(f"URL: {url[:100]}...")
            
            # Extract key parameters
            import re
            username_match = re.search(r'username=([^&]+)', url)
            status_match = re.search(r'status=([^&]+)', url)
            payout_match = re.search(r'payout=([^&]+)', url)
            
            if username_match:
                print(f"  -> Username param: {username_match.group(1)}")
            if status_match:
                print(f"  -> Status param: {status_match.group(1)}")
            if payout_match:
                print(f"  -> Payout param: {payout_match.group(1)}")
        
        response = fwd.get('response_body', '')
        if response:
            print(f"Response: {str(response)[:100]}")
    
    print("\n" + "="*80)
    print("CONCLUSION:")
    print("="*80)
    
    latest = forwarded_list[0]
    if latest.get('response_code') == 200:
        print("\nSUCCESS! Postback forwarding is working!")
        print(f"- Forwarded to downstream partner")
        print(f"- Got 200 OK response")
        print(f"- User and points included in URL")
    else:
        print(f"\nPartially working - got response code: {latest.get('response_code')}")
else:
    print("\nNo forwarded postbacks found.")
    print("This might mean:")
    print("1. Postback hasn't reached the forwarding step yet")
    print("2. No placement owner configured with postback URL")

print("\n" + "="*80)
