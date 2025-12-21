import pymongo

uri = "mongodb+srv://nan_db_user:j6trrN5m33t4Jwz8@mustache.0gly4in.mongodb.net/ascend_db?retryWrites=true&w=majority&tlsAllowInvalidCertificates=true"
client = pymongo.MongoClient(uri)
db = client["ascend_db"]

print("="*80)
print("PAYOUT FIX VERIFICATION")
print("="*80)

# Check the latest forwarded postback
forwarded = db["forwarded_postbacks"]
latest = forwarded.find_one(sort=[('timestamp', -1)])

if latest:
    print(f"\nLatest Forwarded Postback:")
    print(f"Timestamp: {latest.get('timestamp')}")
    print(f"Username: {latest.get('username')}")
    print(f"Points: {latest.get('points')}")  # Should be 500 now!
    print(f"Status: {latest.get('forward_status')}")
    
    # Check the URL parameters
    url = latest.get('forward_url', '')
    print(f"\nForward URL (first 150 chars):")
    print(f"{url[:150]}...")
    
    # Extract payout and points from URL
    import re
    payout_match = re.search(r'[&?]payout=([^&]+)', url)
    points_match = re.search(r'[&?]points=([^&]+)', url)
    
    print(f"\nExtracted Parameters:")
    if payout_match:
        print(f"  payout={payout_match.group(1)}")  # Should be 500!
    else:
        print(f"  payout=NOT FOUND")
        
    if points_match:
        print(f"  points={points_match.group(1)}")  # Should be 500!
    else:
        print(f"  points=NOT FOUND")
    
    print("\n" + "="*80)
    if latest.get('points', 0) > 0:
        print("SUCCESS! Points are now being forwarded!")
        print(f"Payout value: {latest.get('points')}")
    else:
        print("STILL ZERO - Need to investigate further")
    print("="*80)
else:
    print("\nNo forwarded postbacks found")

print("\n")
