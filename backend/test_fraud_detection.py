"""
Test VPN Detection and Fraud Analysis
"""

from services.vpn_detection_service import get_vpn_detection_service
from services.fraud_detection_service import get_fraud_detection_service
from models.login_logs import LoginLog
from database import db_instance

print("="*80)
print("🧪 TESTING VPN DETECTION & FRAUD ANALYSIS")
print("="*80)

# Test 1: VPN Detection
print("\n📋 Test 1: VPN Detection")
print("-"*80)

vpn_service = get_vpn_detection_service(db_instance)

# Test with a known VPN IP (example)
test_ips = [
    "8.8.8.8",  # Google DNS (should be datacenter)
    "1.1.1.1",  # Cloudflare DNS (should be datacenter)
    "127.0.0.1",  # Localhost
]

for ip in test_ips:
    print(f"\nTesting IP: {ip}")
    result = vpn_service.check_ip(ip)
    print(f"  Is VPN: {result['is_vpn']}")
    print(f"  Is Datacenter: {result['is_datacenter']}")
    print(f"  Provider: {result['provider']}")
    print(f"  Confidence: {result['confidence']}")
    print(f"  Block Level: {result.get('block_level', 'N/A')}")

# Test 2: Device Fingerprinting
print("\n\n📋 Test 2: Device Fingerprinting")
print("-"*80)

login_log_model = LoginLog()

device_info_1 = {
    'type': 'desktop',
    'os': 'Windows 10',
    'browser': 'Chrome',
    'version': '120.0'
}

device_info_2 = {
    'type': 'mobile',
    'os': 'iOS 17',
    'browser': 'Safari',
    'version': '17.0'
}

fingerprint_1 = login_log_model.calculate_device_fingerprint(device_info_1)
fingerprint_2 = login_log_model.calculate_device_fingerprint(device_info_2)

print(f"Device 1 fingerprint: {fingerprint_1}")
print(f"Device 2 fingerprint: {fingerprint_2}")
print(f"Are they different? {fingerprint_1 != fingerprint_2}")

# Test 3: Session Frequency
print("\n\n📋 Test 3: Session Frequency")
print("-"*80)

# This will return actual data from database
session_freq = login_log_model.calculate_session_frequency("test_user_id")
print(f"Logins last hour: {session_freq['logins_last_hour']}")
print(f"Logins last day: {session_freq['logins_last_day']}")
print(f"Risk level: {session_freq['risk_level']}")

# Test 4: Fraud Analysis
print("\n\n📋 Test 4: Fraud Analysis")
print("-"*80)

fraud_service = get_fraud_detection_service()

# Test case 1: Clean login
test_data_clean = {
    'vpn_detection': {
        'is_vpn': False,
        'is_proxy': False,
        'is_tor': False,
        'is_datacenter': False
    },
    'device_change_detected': False,
    'session_frequency': {
        'logins_last_hour': 1,
        'risk_level': 'low'
    }
}

result_clean = fraud_service.analyze_login(test_data_clean)
print("\nClean Login:")
print(f"  Fraud Score: {result_clean['fraud_score']}/100")
print(f"  Risk Level: {result_clean['risk_level']}")
print(f"  Flags: {result_clean['flags']}")

# Test case 2: Suspicious login (VPN + device change)
test_data_suspicious = {
    'vpn_detection': {
        'is_vpn': True,
        'is_proxy': False,
        'is_tor': False,
        'is_datacenter': True,
        'provider': 'ExpressVPN'
    },
    'device_change_detected': True,
    'session_frequency': {
        'logins_last_hour': 6,
        'risk_level': 'medium'
    }
}

result_suspicious = fraud_service.analyze_login(test_data_suspicious)
print("\nSuspicious Login (VPN + Device Change + Multiple Logins):")
print(f"  Fraud Score: {result_suspicious['fraud_score']}/100")
print(f"  Risk Level: {result_suspicious['risk_level']}")
print(f"  Flags: {result_suspicious['flags']}")
print(f"  Recommendations: {result_suspicious['recommendations']}")

# Test case 3: Critical (VPN + Tor + High frequency)
test_data_critical = {
    'vpn_detection': {
        'is_vpn': True,
        'is_proxy': True,
        'is_tor': True,
        'is_datacenter': True,
        'provider': 'Tor Network'
    },
    'device_change_detected': True,
    'session_frequency': {
        'logins_last_hour': 12,
        'risk_level': 'high'
    }
}

result_critical = fraud_service.analyze_login(test_data_critical)
print("\nCritical Login (VPN + Tor + Device Change + Excessive Logins):")
print(f"  Fraud Score: {result_critical['fraud_score']}/100")
print(f"  Risk Level: {result_critical['risk_level']}")
print(f"  Flags: {result_critical['flags']}")
print(f"  Recommendations: {result_critical['recommendations']}")

print("\n" + "="*80)
print("✅ ALL TESTS COMPLETE!")
print("="*80)
