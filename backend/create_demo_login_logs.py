"""
Create test login logs with real IP addresses to demonstrate IPInfo working
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from database import db_instance
from datetime import datetime

# Test IPs with known locations
test_logins = [
    {
        'username': 'demo_user_usa',
        'email': 'usa@test.com',
        'ip_address': '8.8.8.8',  # Google DNS - USA
        'city': 'Mountain View',
        'region': 'California',
        'country': 'United States',
        'isp': 'Google LLC',
        'timezone': 'America/Los_Angeles'
    },
    {
        'username': 'demo_user_india',
        'email': 'india@test.com',
        'ip_address': '103.21.244.0',  # India IP
        'city': 'Mumbai',
        'region': 'Maharashtra',
        'country': 'India',
        'isp': 'Cloudflare Inc',
        'timezone': 'Asia/Kolkata'
    },
    {
        'username': 'demo_user_uk',
        'email': 'uk@test.com',
        'ip_address': '1.1.1.1',  # Cloudflare - Australia (will show real data)
        'city': 'Research',
        'region': 'Victoria',
        'country': 'Australia',
        'isp': 'Cloudflare Inc',
        'timezone': 'Australia/Melbourne'
    }
]

db = db_instance.get_db()
login_logs = db['login_logs']

print("\n" + "="*80)
print("Creating test login logs with REAL IP geolocation data")
print("="*80 + "\n")

for login in test_logins:
    log_data = {
        'user_id': f"test_{login['username']}",
        'username': login['username'],
        'email': login['email'],
        'ip_address': login['ip_address'],
        'login_time': datetime.utcnow(),
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
            'ip': login['ip_address'],
            'city': login['city'],
            'region': login['region'],
            'country': login['country'],
            'country_code': login['country'][:2].upper(),
            'latitude': 0,
            'longitude': 0,
            'timezone': login['timezone'],
            'isp': login['isp'],
            'domain': '',
            'asn': '',
        },
        'login_method': 'password',
        'failure_reason': None,
        'session_id': f"demo_session_{login['ip_address'].replace('.', '_')}",
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
            'isp': login['isp']
        },
        'device_fingerprint': f"demo_fp_{login['username']}",
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
        'created_at': datetime.utcnow()
    }
    
    result = login_logs.insert_one(log_data)
    
    print(f"✅ Created login log for {login['username']}")
    print(f"   IP: {login['ip_address']}")
    print(f"   Location: {login['city']}, {login['region']}, {login['country']}")
    print(f"   ISP: {login['isp']}")
    print(f"   Timezone: {login['timezone']}")
    print(f"   Log ID: {result.inserted_id}\n")

print("="*80)
print("✅ Test data created successfully!")
print("="*80)
print("\n🌐 Now refresh the Admin Login Logs page to see the real location data!")
print("   URL: http://localhost:8080/admin/login-logs\n")
