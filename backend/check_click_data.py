from pymongo import MongoClient
import os
from dotenv import load_dotenv
import json
from datetime import datetime

load_dotenv()

uri = os.getenv('MONGODB_URI')
client = MongoClient(uri)
db = client['ascend_db']

print("=" * 80)
print("CHECKING CLICK DATA IN DATABASE")
print("=" * 80)

# Get the most recent click
click = db.offerwall_clicks_detailed.find_one(sort=[('timestamp', -1)])

if click:
    print("\n✅ Found most recent click:")
    print(f"Click ID: {click.get('click_id')}")
    print(f"User ID: {click.get('user_id')}")
    print(f"Publisher ID: {click.get('publisher_id')}")
    print(f"Publisher Name: {click.get('publisher_name')}")
    print(f"Offer ID: {click.get('offer_id')}")
    print(f"Offer Name: {click.get('offer_name')}")
    print(f"Placement ID: {click.get('placement_id')}")
    print(f"Timestamp: {click.get('timestamp')}")
    
    print("\n📱 Device Info:")
    device = click.get('device', {})
    print(f"  Type: {device.get('type')}")
    print(f"  OS: {device.get('os')}")
    print(f"  Browser: {device.get('browser')}")
    
    print("\n🌍 Geo Info:")
    geo = click.get('geo', {})
    print(f"  Country: {geo.get('country')}")
    print(f"  Region: {geo.get('region')}")
    print(f"  City: {geo.get('city')}")
    print(f"  IP: {geo.get('ip_address')}")
    
    print("\n🌐 Network Info:")
    network = click.get('network', {})
    print(f"  IP: {network.get('ip_address')}")
    print(f"  ISP: {network.get('isp')}")
    print(f"  ASN: {network.get('asn')}")
    
    print("\n" + "=" * 80)
    print("FULL CLICK DATA (JSON):")
    print("=" * 80)
    # Convert to JSON-serializable format
    click['_id'] = str(click['_id'])
    if 'timestamp' in click and isinstance(click['timestamp'], datetime):
        click['timestamp'] = click['timestamp'].isoformat()
    if 'created_at' in click and isinstance(click['created_at'], datetime):
        click['created_at'] = click['created_at'].isoformat()
    
    print(json.dumps(click, indent=2, default=str))
else:
    print("\n❌ No clicks found in offerwall_clicks_detailed collection")

client.close()
