"""
Check the actual IP address from recent login and test VPN detection
"""

from database import db_instance
from services.vpn_detection_service import get_vpn_detection_service

if not db_instance.is_connected():
    print("Database not connected!")
    exit(1)

# Get the most recent login
logs_collection = db_instance.get_collection('login_logs')
recent_login = logs_collection.find_one(
    {'status': 'success'},
    sort=[('login_time', -1)]
)

if not recent_login:
    print("No logins found!")
    exit(1)

ip_address = recent_login.get('ip_address')
print("="*70)
print(f"Most Recent Login IP: {ip_address}")
print(f"User: {recent_login.get('username')}")
print(f"Time: {recent_login.get('login_time')}")
print("="*70)

# Test VPN detection with this IP
print("\nTesting VPN Detection with this IP...")
print("-"*70)

vpn_service = get_vpn_detection_service(db_instance)
result = vpn_service.check_ip(ip_address)

print(f"\nVPN Detection Result:")
print(f"  is_vpn: {result.get('is_vpn')}")
print(f"  is_proxy: {result.get('is_proxy')}")
print(f"  is_tor: {result.get('is_tor')}")
print(f"  is_datacenter: {result.get('is_datacenter')}")
print(f"  provider: {result.get('provider')}")
print(f"  confidence: {result.get('confidence')}")
print(f"  block_level: {result.get('block_level')}")

# Check what's saved in the login log
print("\n" + "="*70)
print("What's saved in the login log:")
print("-"*70)

vpn_in_log = recent_login.get('vpn_detection')
if vpn_in_log:
    print("VPN Detection data EXISTS in log:")
    print(f"  {vpn_in_log}")
else:
    print("NO VPN Detection data in log!")

fraud_score = recent_login.get('fraud_score')
if fraud_score is not None:
    print(f"\nFraud Score: {fraud_score}")
    print(f"Risk Level: {recent_login.get('risk_level')}")
else:
    print("\nNO Fraud Score in log!")

print("\n" + "="*70)

# If IP is localhost, explain
if ip_address in ['127.0.0.1', 'localhost', '::1']:
    print("\nNOTE: You're logging in from localhost!")
    print("VPN detection won't work for localhost IPs.")
    print("Try accessing from your actual IP or use ngrok/tunnel.")
