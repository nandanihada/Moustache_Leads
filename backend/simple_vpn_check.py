"""
Simple VPN check without Unicode issues
"""

import requests

# Test IPs from production
test_ips = [
    "151.115.90.135",
    "118.224.168.71",
]

print("Testing IPHub.info API")
print("="*60)

for ip in test_ips:
    print(f"\nIP: {ip}")
    try:
        url = f"http://v2.api.iphub.info/ip/{ip}"
        response = requests.get(url, timeout=5)
        
        if response.status_code == 200:
            data = response.json()
            block = data.get('block', 0)
            isp = data.get('isp', 'Unknown')
            country = data.get('countryCode', 'Unknown')
            
            print(f"  Status: OK")
            print(f"  Block Level: {block}")
            print(f"  ISP: {isp}")
            print(f"  Country: {country}")
            
            if block == 0:
                print(f"  Result: Clean IP (Residential)")
            elif block == 1:
                print(f"  Result: SUSPICIOUS (Datacenter/Proxy/VPN)")
            else:
                print(f"  Result: MIXED (Possible VPN)")
                
        elif response.status_code == 429:
            print(f"  Status: Rate Limited")
        else:
            print(f"  Status: Error {response.status_code}")
            
    except Exception as e:
        print(f"  Error: {e}")

print("\n" + "="*60)

# Check if VPN data is in the database
from database import db_instance

logs_collection = db_instance.get_collection('login_logs')

print("\nChecking database for VPN data...")
print("="*60)

recent_log = logs_collection.find_one(
    {'status': 'success', 'ip_address': {'$nin': ['127.0.0.1', 'localhost']}},
    sort=[('login_time', -1)]
)

if recent_log:
    print(f"\nMost recent non-localhost login:")
    print(f"  User: {recent_log.get('username')}")
    print(f"  IP: {recent_log.get('ip_address')}")
    print(f"  Has vpn_detection: {'vpn_detection' in recent_log}")
    
    if 'vpn_detection' in recent_log:
        vpn = recent_log['vpn_detection']
        print(f"  VPN Data:")
        print(f"    is_vpn: {vpn.get('is_vpn')}")
        print(f"    provider: {vpn.get('provider')}")
        print(f"    block_level: {vpn.get('block_level')}")
    else:
        print(f"  NO VPN DATA IN DATABASE!")
        print(f"  This means fraud detection is not running on production!")
else:
    print(f"\nNo non-localhost logins found!")

print("\n" + "="*60)
