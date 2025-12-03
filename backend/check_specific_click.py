from pymongo import MongoClient
import os
from dotenv import load_dotenv

load_dotenv()

uri = os.getenv('MONGODB_URI')
client = MongoClient(uri)
db = client['ascend_db']

click_id = "9743656b-1ed3-4f43-91f3-be44c4b01006"

print(f"Searching for click ID: {click_id}")
print("=" * 80)

# Search in offerwall_clicks_detailed
click = db.offerwall_clicks_detailed.find_one({'click_id': click_id})

if click:
    print("Found in offerwall_clicks_detailed")
    print(f"Publisher ID: {click.get('publisher_id')}")
    print(f"Publisher Name: {click.get('publisher_name')}")
    print(f"Placement ID: {click.get('placement_id')}")
    print(f"User ID: {click.get('user_id')}")
    print(f"Offer: {click.get('offer_name')}")
    
    # Device
    device = click.get('device', {})
    print(f"\nDevice Type: {device.get('type')}")
    print(f"Device OS: {device.get('os')}")
    print(f"Device Browser: {device.get('browser')}")
    
    # Geo
    geo = click.get('geo', {})
    print(f"\nGeo Country: {geo.get('country')}")
    print(f"Geo City: {geo.get('city')}")
    
    # Network
    network = click.get('network', {})
    print(f"\nNetwork IP: {network.get('ip_address')}")
    print(f"Network ISP: {network.get('isp')}")
    
else:
    print("NOT found in offerwall_clicks_detailed")
    
    # Try offerwall_clicks
    click = db.offerwall_clicks.find_one({'click_id': click_id})
    if click:
        print("Found in offerwall_clicks")
        print(f"Data: {click}")
    else:
        print("NOT found in offerwall_clicks either")

client.close()
