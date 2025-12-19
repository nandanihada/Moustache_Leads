"""
Test script to create login logs with real public IP addresses
This will demonstrate IPInfo working with actual geolocation data
"""

import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from models.login_logs import LoginLog
from services.ipinfo_service import get_ipinfo_service
from datetime import datetime
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def test_real_ip_geolocation():
    """Test IPInfo with real public IP addresses"""
    
    # Test IPs from different locations
    test_ips = [
        {
            'ip': '8.8.8.8',  # Google DNS - Mountain View, California, USA
            'description': 'Google DNS (USA)'
        },
        {
            'ip': '1.1.1.1',  # Cloudflare - Australia
            'description': 'Cloudflare (Australia)'
        },
        {
            'ip': '110.227.59.38',  # India IP
            'description': 'Indian IP'
        },
        {
            'ip': '103.21.244.0',  # Another India IP
            'description': 'Another Indian IP'
        }
    ]
    
    ipinfo_service = get_ipinfo_service()
    login_log_model = LoginLog()
    
    print("\n" + "="*80)
    print("TESTING IPINFO GEOLOCATION WITH REAL PUBLIC IPs")
    print("="*80 + "\n")
    
    for test_ip in test_ips:
        ip_address = test_ip['ip']
        description = test_ip['description']
        
        print(f"\n{'='*80}")
        print(f"Testing: {description} ({ip_address})")
        print(f"{'='*80}")
        
        # Lookup IP information
        ip_data = ipinfo_service.lookup_ip(ip_address)
        
        if ip_data:
            print(f"\n✅ IPInfo Lookup Successful!")
            print(f"\n📍 Location Data:")
            print(f"   City:         {ip_data.get('city', 'Unknown')}")
            print(f"   Region:       {ip_data.get('region', 'Unknown')}")
            print(f"   Country:      {ip_data.get('country', 'Unknown')}")
            print(f"   Country Code: {ip_data.get('country_code', 'Unknown')}")
            print(f"   Timezone:     {ip_data.get('time_zone', 'Unknown')}")
            print(f"   Coordinates:  {ip_data.get('latitude', 0)}, {ip_data.get('longitude', 0)}")
            
            print(f"\n🌐 Network Data:")
            print(f"   ISP:          {ip_data.get('isp', 'Unknown')}")
            print(f"   Domain:       {ip_data.get('domain', 'Unknown')}")
            print(f"   ASN:          {ip_data.get('asn', 'Unknown')}")
            
            print(f"\n🔒 Security Data:")
            vpn_detection = ip_data.get('vpn_detection', {})
            print(f"   VPN:          {vpn_detection.get('is_vpn', False)}")
            print(f"   Proxy:        {vpn_detection.get('is_proxy', False)}")
            print(f"   Tor:          {vpn_detection.get('is_tor', False)}")
            print(f"   Datacenter:   {vpn_detection.get('is_datacenter', False)}")
            print(f"   Fraud Score:  {ip_data.get('fraud_score', 0)}/100")
            print(f"   Risk Level:   {ip_data.get('risk_level', 'low').upper()}")
            
            # Create a test login log entry
            log_data = {
                'user_id': 'test_user_real_ip',
                'email': 'test@example.com',
                'username': 'test_user',
                'login_time': datetime.utcnow(),
                'logout_time': None,
                'ip_address': ip_address,
                'device': {
                    'type': 'desktop',
                    'os': 'Windows 10',
                    'browser': 'Chrome 120',
                    'version': '120.0',
                    'is_mobile': False,
                    'is_tablet': False,
                    'is_pc': True,
                    'is_bot': False
                },
                'location': {
                    'ip': ip_address,
                    'city': ip_data.get('city', 'Unknown'),
                    'region': ip_data.get('region', 'Unknown'),
                    'country': ip_data.get('country', 'Unknown'),
                    'country_code': ip_data.get('country_code', 'XX'),
                    'latitude': ip_data.get('latitude', 0),
                    'longitude': ip_data.get('longitude', 0),
                    'timezone': ip_data.get('time_zone', 'UTC'),
                    'isp': ip_data.get('isp', 'Unknown'),
                    'domain': ip_data.get('domain', ''),
                    'asn': ip_data.get('asn', ''),
                },
                'login_method': 'password',
                'status': 'success',
                'failure_reason': None,
                'session_id': f'test_session_{ip_address.replace(".", "_")}',
                'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
                'vpn_detection': vpn_detection,
                'device_fingerprint': f'test_fingerprint_{ip_address}',
                'device_change_detected': False,
                'session_frequency': {
                    'logins_last_hour': 1,
                    'logins_last_day': 1,
                    'risk_level': 'low'
                },
                'fraud_score': ip_data.get('fraud_score', 0),
                'risk_level': ip_data.get('risk_level', 'low'),
                'fraud_flags': [],
                'fraud_recommendations': []
            }
            
            # Save to database
            log_id = login_log_model.create_log(log_data)
            
            if log_id:
                print(f"\n💾 Login log created successfully!")
                print(f"   Log ID: {log_id}")
            else:
                print(f"\n❌ Failed to create login log")
        else:
            print(f"\n❌ IPInfo lookup failed for {ip_address}")
    
    print("\n" + "="*80)
    print("TEST COMPLETE")
    print("="*80)
    print("\n✅ Check the Admin Login Logs page to see the new entries with real location data!")
    print("   URL: http://localhost:8080/admin/login-logs")
    print("\n")

if __name__ == '__main__':
    test_real_ip_geolocation()
