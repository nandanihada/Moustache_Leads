"""
Check what's actually in the production database for those IPs
"""

from database import db_instance
from services.vpn_detection_service import get_vpn_detection_service

print("="*70)
print("CHECKING PRODUCTION LOGIN LOGS")
print("="*70)

# The IPs from your screenshot
test_ips = [
    "23.106.249.53",
    "23.106.56.51"
]

logs_collection = db_instance.get_collection('login_logs')

print("\n1. CHECKING DATABASE FOR THESE IPs")
print("-"*70)

for ip in test_ips:
    log = logs_collection.find_one(
        {'ip_address': ip},
        sort=[('login_time', -1)]
    )
    
    if log:
        print(f"\nIP: {ip}")
        print(f"  User: {log.get('username')}")
        print(f"  Time: {log.get('login_time')}")
        print(f"  Has vpn_detection: {'vpn_detection' in log}")
        print(f"  Has fraud_score: {'fraud_score' in log}")
        
        if 'vpn_detection' in log:
            vpn = log['vpn_detection']
            print(f"  VPN Data:")
            print(f"    is_vpn: {vpn.get('is_vpn')}")
            print(f"    provider: {vpn.get('provider')}")
        else:
            print(f"  NO VPN DATA - This login was created BEFORE deployment!")

print("\n\n2. TESTING VPN DETECTION ON THESE IPs NOW")
print("-"*70)

vpn_service = get_vpn_detection_service(db_instance)

for ip in test_ips:
    print(f"\nTesting IP: {ip}")
    try:
        result = vpn_service.check_ip(ip)
        print(f"  is_vpn: {result.get('is_vpn')}")
        print(f"  is_datacenter: {result.get('is_datacenter')}")
        print(f"  provider: {result.get('provider')}")
        print(f"  block_level: {result.get('block_level')}")
        print(f"  detected_by: {result.get('detected_by')}")
        
        if result.get('is_vpn'):
            print(f"  RESULT: VPN DETECTED!")
        else:
            print(f"  RESULT: Clean IP (not a VPN)")
    except Exception as e:
        print(f"  ERROR: {e}")

print("\n\n3. CHECKING IF ENHANCED CODE IS LOADED")
print("-"*70)

import inspect
source = inspect.getsource(vpn_service._call_iphub_api)

has_browsec = 'browsec' in source.lower()
has_zenmate = 'zenmate' in source.lower()
has_keywords = 'known_vpn_keywords' in source

print(f"Enhanced code loaded: {has_keywords}")
print(f"  Has 'browsec' keyword: {has_browsec}")
print(f"  Has 'zenmate' keyword: {has_zenmate}")

if not has_keywords:
    print("\n  WARNING: Enhanced VPN detection NOT loaded!")
    print("  The production backend is running OLD code!")
    print("  You need to deploy and restart!")

print("\n" + "="*70)
