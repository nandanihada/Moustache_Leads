"""
Simple test to see if fraud detection runs
"""
import sys
import traceback

print("Testing fraud detection step by step...")
print("="*70)

# Step 1: Import services
try:
    print("\n1. Importing services...")
    from services.vpn_detection_service import get_vpn_detection_service
    from services.fraud_detection_service import get_fraud_detection_service
    from database import db_instance
    print("   SUCCESS: Services imported")
except Exception as e:
    print(f"   FAILED: {e}")
    traceback.print_exc()
    sys.exit(1)

# Step 2: Test VPN detection
try:
    print("\n2. Testing VPN detection...")
    vpn_service = get_vpn_detection_service(db_instance)
    result = vpn_service.check_ip("127.0.0.1")
    print(f"   SUCCESS: VPN check returned: is_vpn={result.get('is_vpn')}")
except Exception as e:
    print(f"   FAILED: {e}")
    traceback.print_exc()

# Step 3: Test device fingerprinting
try:
    print("\n3. Testing device fingerprinting...")
    from models.login_logs import LoginLog
    login_log_model = LoginLog()
    
    device_info = {
        'type': 'desktop',
        'os': 'Windows 10',
        'browser': 'Chrome',
        'version': '120.0'
    }
    
    fingerprint = login_log_model.calculate_device_fingerprint(device_info)
    print(f"   SUCCESS: Fingerprint = {fingerprint}")
except Exception as e:
    print(f"   FAILED: {e}")
    traceback.print_exc()

# Step 4: Test fraud detection
try:
    print("\n4. Testing fraud detection...")
    fraud_service = get_fraud_detection_service()
    
    test_data = {
        'vpn_detection': {'is_vpn': True},
        'device_change_detected': False,
        'session_frequency': {'risk_level': 'low'}
    }
    
    result = fraud_service.analyze_login(test_data)
    print(f"   SUCCESS: Fraud score = {result.get('fraud_score')}")
except Exception as e:
    print(f"   FAILED: {e}")
    traceback.print_exc()

# Step 5: Check if activity_tracking_service has the code
try:
    print("\n5. Checking activity_tracking_service...")
    from services.activity_tracking_service import activity_tracking_service
    
    # Check the source code
    import inspect
    source = inspect.getsource(activity_tracking_service.track_login_attempt)
    
    has_vpn = 'vpn_detection' in source
    has_fraud = 'fraud_service' in source
    
    print(f"   Has VPN detection code: {has_vpn}")
    print(f"   Has fraud service code: {has_fraud}")
    
    if not has_vpn or not has_fraud:
        print("   WARNING: Fraud detection code NOT found in track_login_attempt!")
except Exception as e:
    print(f"   FAILED: {e}")
    traceback.print_exc()

print("\n" + "="*70)
print("Test complete!")
