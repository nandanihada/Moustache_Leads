"""
Simple check for fraud detection data
"""

from database import db_instance
import json

if not db_instance.is_connected():
    print("Database not connected!")
    exit(1)

# Get recent login logs
logs_collection = db_instance.get_collection('login_logs')

# Get the most recent login
recent_login = logs_collection.find_one(
    {'status': 'success'},
    sort=[('login_time', -1)]
)

if not recent_login:
    print("No successful logins found!")
    exit(1)

print("Recent Login Check")
print("="*60)

print(f"User: {recent_login.get('username')}")
print(f"IP: {recent_login.get('ip_address')}")

# Check fraud fields
has_vpn = 'vpn_detection' in recent_login
has_fingerprint = 'device_fingerprint' in recent_login
has_freq = 'session_frequency' in recent_login
has_score = 'fraud_score' in recent_login

print(f"\nFraud Detection Fields:")
print(f"  VPN Detection: {'YES' if has_vpn else 'NO'}")
print(f"  Device Fingerprint: {'YES' if has_fingerprint else 'NO'}")
print(f"  Session Frequency: {'YES' if has_freq else 'NO'}")
print(f"  Fraud Score: {'YES' if has_score else 'NO'}")

if has_vpn:
    vpn = recent_login.get('vpn_detection', {})
    print(f"\nVPN Details:")
    print(f"  is_vpn: {vpn.get('is_vpn')}")
    print(f"  provider: {vpn.get('provider')}")

if has_score:
    print(f"\nFraud Score: {recent_login.get('fraud_score')}")
    print(f"Risk Level: {recent_login.get('risk_level')}")

print("\n" + "="*60)
