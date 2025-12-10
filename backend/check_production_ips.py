"""
Check VPN detection for the real IPs from production
"""

from services.vpn_detection_service import get_vpn_detection_service
from database import db_instance

print("="*70)
print("CHECKING VPN DETECTION FOR PRODUCTION IPs")
print("="*70)

# IPs from your screenshots
production_ips = [
    "151.115.90.135",   # From Active Users
    "118.224.168.71",   # From Active Users
    "151.115.90.133",   # From Active Users (sant)
]

vpn_service = get_vpn_detection_service(db_instance)

for ip in production_ips:
    print(f"\n{'='*70}")
    print(f"Testing IP: {ip}")
    print(f"{'='*70}")
    
    try:
        result = vpn_service.check_ip(ip)
        
        print(f"  is_vpn:        {result.get('is_vpn')}")
        print(f"  is_proxy:      {result.get('is_proxy')}")
        print(f"  is_tor:        {result.get('is_tor')}")
        print(f"  is_datacenter: {result.get('is_datacenter')}")
        print(f"  provider:      {result.get('provider')}")
        print(f"  confidence:    {result.get('confidence')}")
        print(f"  block_level:   {result.get('block_level')}")
        
        # Determine if this would trigger fraud detection
        if result.get('is_vpn') or result.get('is_proxy') or result.get('is_datacenter'):
            print(f"\n  ⚠️ FRAUD ALERT: This IP would trigger VPN/Proxy detection!")
        else:
            print(f"\n  ✅ Clean IP: No VPN/Proxy detected")
            
    except Exception as e:
        print(f"  ❌ ERROR: {e}")
        import traceback
        traceback.print_exc()

print("\n" + "="*70)

# Check the most recent login logs to see if VPN data is being saved
print("\nCHECKING RECENT LOGIN LOGS FOR VPN DATA")
print("="*70)

logs_collection = db_instance.get_collection('login_logs')

recent_logs = list(logs_collection.find(
    {'status': 'success'},
    sort=[('login_time', -1)],
    limit=5
))

for i, log in enumerate(recent_logs, 1):
    print(f"\n{i}. User: {log.get('username')} | IP: {log.get('ip_address')}")
    
    vpn_data = log.get('vpn_detection')
    if vpn_data:
        print(f"   ✅ VPN Detection data exists:")
        print(f"      is_vpn: {vpn_data.get('is_vpn')}")
        print(f"      provider: {vpn_data.get('provider')}")
    else:
        print(f"   ❌ NO VPN Detection data!")
    
    fraud_score = log.get('fraud_score')
    if fraud_score is not None:
        print(f"   Fraud Score: {fraud_score}")
    else:
        print(f"   ❌ NO Fraud Score!")

print("\n" + "="*70)
