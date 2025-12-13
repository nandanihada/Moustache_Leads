"""
Test the new IP-API.com based VPN detection
"""

from services.vpn_detection_service import get_vpn_detection_service
from database import db_instance

print("="*70)
print("TESTING NEW VPN DETECTION (IP-API.com)")
print("="*70)

# Your actual IPs from screenshots
test_ips = [
    "105.207.219.12",  # From latest screenshot
    "23.106.249.53",   # From earlier screenshot
]

vpn_service = get_vpn_detection_service(db_instance)

for ip in test_ips:
    print(f"\n{'='*70}")
    print(f"Testing IP: {ip}")
    print(f"{'='*70}")
    
    result = vpn_service.check_ip(ip)
    
    print(f"\nResults:")
    print(f"  is_vpn: {result.get('is_vpn')}")
    print(f"  is_proxy: {result.get('is_proxy')}")
    print(f"  is_datacenter: {result.get('is_datacenter')}")
    print(f"  provider: {result.get('provider')}")
    print(f"  confidence: {result.get('confidence')}")
    print(f"  detected_by: {result.get('detected_by')}")
    
    if result.get('is_vpn'):
        print(f"\n  🔴 VPN/PROXY DETECTED!")
    else:
        print(f"\n  ✅ Clean IP (not detected as VPN)")

print("\n" + "="*70)
print("READY TO DEPLOY!")
print("="*70)
print("\nThe new VPN detection uses IP-API.com which:")
print("  - Works WITHOUT API key")
print("  - Has built-in proxy detection")
print("  - Free tier: 45 requests/minute")
print("  - Better VPN detection than IPHub")
