"""
Quick check: Is VPN data being saved to production database?
"""

from database import db_instance
import json

logs_collection = db_instance.get_collection('login_logs')

# Get the 5 most recent successful logins
recent_logs = list(logs_collection.find(
    {'status': 'success'},
    sort=[('login_time', -1)],
    limit=5
))

print("RECENT LOGIN LOGS CHECK")
print("="*60)

for i, log in enumerate(recent_logs, 1):
    print(f"\n{i}. {log.get('username')} - {log.get('ip_address')}")
    print(f"   Time: {log.get('login_time')}")
    
    # Check for fraud detection fields
    has_vpn = 'vpn_detection' in log
    has_fingerprint = 'device_fingerprint' in log
    has_freq = 'session_frequency' in log
    has_score = 'fraud_score' in log
    
    if has_vpn or has_fingerprint or has_freq or has_score:
        print(f"   FRAUD DETECTION: YES")
        if has_vpn:
            vpn = log.get('vpn_detection', {})
            print(f"     VPN: is_vpn={vpn.get('is_vpn')}, provider={vpn.get('provider')}")
        if has_score:
            print(f"     Score: {log.get('fraud_score')}/100 ({log.get('risk_level')})")
    else:
        print(f"   FRAUD DETECTION: NO - Old log (before fraud detection was added)")

print("\n" + "="*60)

# Count how many logs have fraud detection
total = logs_collection.count_documents({'status': 'success'})
with_fraud = logs_collection.count_documents({'fraud_score': {'$exists': True}})

print(f"\nSTATISTICS:")
print(f"  Total successful logins: {total}")
print(f"  Logins with fraud detection: {with_fraud}")
print(f"  Percentage: {(with_fraud/total*100) if total > 0 else 0:.1f}%")

if with_fraud == 0:
    print(f"\n  WARNING: NO logins have fraud detection!")
    print(f"  This means the production backend needs to be restarted!")
elif with_fraud < total:
    print(f"\n  INFO: Some old logins don't have fraud detection (expected)")
    print(f"  New logins should have fraud detection data")
