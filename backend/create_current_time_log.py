"""
Create a fresh login log entry with CURRENT time to test IST display
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from database import db_instance
from datetime import datetime

db = db_instance.get_db()
login_logs = db['login_logs']

# Create a login entry with CURRENT UTC time
current_utc = datetime.utcnow()

log_data = {
    'user_id': 'current_time_test',
    'username': 'current_time_test',
    'email': 'current_test@example.com',
    'ip_address': '103.21.244.0',
    'login_time': current_utc,  # Current UTC time
    'logout_time': None,
    'status': 'success',
    'device': {
        'type': 'desktop',
        'os': 'Windows 10',
        'browser': 'Chrome 120.0',
        'version': '120.0',
        'is_mobile': False,
        'is_tablet': False,
        'is_pc': True,
        'is_bot': False
    },
    'location': {
        'ip': '103.21.244.0',
        'city': 'Mumbai',
        'region': 'Maharashtra',
        'country': 'India',
        'country_code': 'IN',
        'latitude': 19.0728,
        'longitude': 72.8826,
        'timezone': 'Asia/Kolkata',
        'isp': 'Reliance Jio',
        'domain': '',
        'asn': 'AS55836',
    },
    'login_method': 'password',
    'failure_reason': None,
    'session_id': f"current_test_{int(current_utc.timestamp())}",
    'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
    'vpn_detection': {
        'is_vpn': False,
        'is_proxy': False,
        'is_tor': False,
        'is_datacenter': False,
        'is_relay': False,
        'provider': None,
        'service': None,
        'confidence': 'low',
        'isp': 'Reliance Jio'
    },
    'device_fingerprint': 'current_test_fp',
    'device_change_detected': False,
    'session_frequency': {
        'logins_last_hour': 1,
        'logins_last_day': 1,
        'risk_level': 'low'
    },
    'fraud_score': 0,
    'risk_level': 'low',
    'fraud_flags': [],
    'fraud_recommendations': [],
    'created_at': current_utc
}

result = login_logs.insert_one(log_data)

# Convert to IST for display
import pytz
utc_tz = pytz.UTC
ist_tz = pytz.timezone('Asia/Kolkata')
current_utc_aware = utc_tz.localize(current_utc)
current_ist = current_utc_aware.astimezone(ist_tz)

print("\n" + "="*80)
print("CREATED NEW LOGIN LOG WITH CURRENT TIME")
print("="*80 + "\n")
print(f"✅ Login log created successfully!")
print(f"   Log ID: {result.inserted_id}")
print(f"\n⏰ Time Information:")
print(f"   Stored in DB (UTC): {current_utc.strftime('%Y-%m-%d %H:%M:%S UTC')}")
print(f"   Should display as:  {current_ist.strftime('%d/%m/%Y, %I:%M:%S %p IST')}")
print(f"\n📍 Location: Mumbai, Maharashtra, India")
print(f"🌐 ISP: Reliance Jio")
print(f"\n🔄 Now refresh the Admin Login Logs page to see this entry!")
print(f"   It should show the CURRENT IST time: {current_ist.strftime('%I:%M %p IST')}")
print("="*80 + "\n")
