import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from database import db_instance

conv = db_instance.get_collection('conversions')
c = conv.find_one({'conversion_id': 'CONV-1B680DFFAF2A'})
if c:
    c['_id'] = str(c['_id'])
    print("=== CONVERSION FOUND ===")
    for k, v in sorted(c.items()):
        print(f"  {k}: {repr(v)[:200]}")
else:
    print("CONVERSION NOT FOUND: CONV-1B680DFFAF2A")

# Check forwarded
fwd = db_instance.get_collection('forwarded_postbacks')
recent = fwd.find_one({'conversion_id': 'CONV-1B680DFFAF2A'})
if recent:
    print("\nFORWARDED RECORD FOUND")
    for k, v in sorted(recent.items()):
        if k != '_id':
            print(f"  {k}: {repr(v)[:150]}")
else:
    print("\nNO FORWARDED RECORD for this conversion")

# Check the click
clicks = db_instance.get_collection('clicks')
click = clicks.find_one({'click_id': 'CLK-34A683D895F8'})
if click:
    print(f"\nCLICK FOUND:")
    print(f"  offer_id: {click.get('offer_id')}")
    print(f"  user_id: {click.get('user_id')}")
    print(f"  placement_id: {click.get('placement_id')}")
    print(f"  username: {click.get('username')}")
else:
    print("\nCLICK NOT FOUND for CLK-34A683D895F8")
