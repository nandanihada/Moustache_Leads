"""
Check if fraud detection data is being saved to login logs
"""

from database import db_instance
from datetime import datetime, timedelta

if not db_instance.is_connected():
    print("❌ Database not connected!")
    exit(1)

# Get recent login logs
logs_collection = db_instance.get_collection('login_logs')

# Get the most recent login
recent_login = logs_collection.find_one(
    {'status': 'success'},
    sort=[('login_time', -1)]
)

if not recent_login:
    print("❌ No successful logins found!")
    exit(1)

print("="*80)
print("🔍 MOST RECENT LOGIN LOG")
print("="*80)

print(f"\nUser: {recent_login.get('username')} ({recent_login.get('email')})")
print(f"Login Time: {recent_login.get('login_time')}")
print(f"IP Address: {recent_login.get('ip_address')}")

print("\n📊 FRAUD DETECTION DATA:")
print("-"*80)

# Check VPN Detection
vpn_detection = recent_login.get('vpn_detection')
if vpn_detection:
    print(f"\n✅ VPN Detection Data Found:")
    print(f"   Is VPN: {vpn_detection.get('is_vpn')}")
    print(f"   Is Proxy: {vpn_detection.get('is_proxy')}")
    print(f"   Is Datacenter: {vpn_detection.get('is_datacenter')}")
    print(f"   Provider: {vpn_detection.get('provider')}")
    print(f"   Confidence: {vpn_detection.get('confidence')}")
else:
    print("\n❌ NO VPN Detection Data!")

# Check Device Fingerprint
device_fingerprint = recent_login.get('device_fingerprint')
if device_fingerprint:
    print(f"\n✅ Device Fingerprint: {device_fingerprint}")
else:
    print("\n❌ NO Device Fingerprint!")

# Check Device Change
device_change = recent_login.get('device_change_detected')
print(f"\n{'✅' if device_change else '❌'} Device Change Detected: {device_change}")

# Check Session Frequency
session_freq = recent_login.get('session_frequency')
if session_freq:
    print(f"\n✅ Session Frequency Data Found:")
    print(f"   Logins Last Hour: {session_freq.get('logins_last_hour')}")
    print(f"   Logins Last Day: {session_freq.get('logins_last_day')}")
    print(f"   Risk Level: {session_freq.get('risk_level')}")
else:
    print("\n❌ NO Session Frequency Data!")

# Check Fraud Score
fraud_score = recent_login.get('fraud_score')
risk_level = recent_login.get('risk_level')
if fraud_score is not None:
    print(f"\n✅ Fraud Score: {fraud_score}/100")
    print(f"   Risk Level: {risk_level}")
else:
    print("\n❌ NO Fraud Score!")

# Check Fraud Flags
fraud_flags = recent_login.get('fraud_flags')
if fraud_flags:
    print(f"\n✅ Fraud Flags: {fraud_flags}")
else:
    print("\n❌ NO Fraud Flags!")

print("\n" + "="*80)

# Show all keys in the login log
print("\n📋 ALL FIELDS IN LOGIN LOG:")
print("-"*80)
for key in sorted(recent_login.keys()):
    if key != '_id':
        print(f"   {key}: {type(recent_login[key]).__name__}")

print("\n" + "="*80)
