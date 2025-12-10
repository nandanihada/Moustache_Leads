"""
Test if fraud detection services are working
"""

print("Testing Fraud Detection Services...")
print("="*60)

# Test 1: Import services
try:
    from services.vpn_detection_service import get_vpn_detection_service
    from services.fraud_detection_service import get_fraud_detection_service
    from database import db_instance
    print("1. Services imported successfully")
except Exception as e:
    print(f"1. FAILED to import services: {e}")
    exit(1)

# Test 2: VPN Detection
try:
    vpn_service = get_vpn_detection_service(db_instance)
    result = vpn_service.check_ip("8.8.8.8")  # Google DNS (should be datacenter)
    print(f"2. VPN Detection working: {result.get('is_datacenter')}")
except Exception as e:
    print(f"2. VPN Detection FAILED: {e}")

# Test 3: Fraud Detection
try:
    fraud_service = get_fraud_detection_service()
    test_data = {
        'vpn_detection': {'is_vpn': True},
        'device_change_detected': False,
        'session_frequency': {'risk_level': 'low'}
    }
    result = fraud_service.analyze_login(test_data)
    print(f"3. Fraud Detection working: score={result.get('fraud_score')}")
except Exception as e:
    print(f"3. Fraud Detection FAILED: {e}")

# Test 4: Check if activity tracking service uses fraud detection
try:
    from services.activity_tracking_service import activity_tracking_service
    print("4. Activity Tracking Service imported")
    
    # Check if it has the fraud detection code
    import inspect
    source = inspect.getsource(activity_tracking_service.track_login_attempt)
    has_vpn = 'vpn_detection' in source
    has_fraud = 'fraud_detection' in source
    print(f"   Has VPN detection code: {has_vpn}")
    print(f"   Has fraud detection code: {has_fraud}")
except Exception as e:
    print(f"4. Activity Tracking check FAILED: {e}")

print("="*60)
print("\nNEXT STEP: Logout and login again to test!")
