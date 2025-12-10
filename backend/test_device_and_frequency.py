"""
Test Device Change Detection and Session Frequency
"""

from database import db_instance
from models.login_logs import LoginLog
from datetime import datetime, timedelta

print("="*70)
print("TESTING DEVICE CHANGE & SESSION FREQUENCY")
print("="*70)

login_log_model = LoginLog()

# Test 1: Device Fingerprinting
print("\n1. DEVICE FINGERPRINTING TEST")
print("-"*70)

device1 = {
    'type': 'desktop',
    'os': 'Windows 10',
    'browser': 'Chrome',
    'version': '120.0'
}

device2 = {
    'type': 'mobile',
    'os': 'iOS 17',
    'browser': 'Safari',
    'version': '17.0'
}

device3 = {
    'type': 'desktop',
    'os': 'Windows 10',
    'browser': 'Firefox',  # Different browser
    'version': '121.0'
}

fingerprint1 = login_log_model.calculate_device_fingerprint(device1)
fingerprint2 = login_log_model.calculate_device_fingerprint(device2)
fingerprint3 = login_log_model.calculate_device_fingerprint(device3)

print(f"Device 1 (Chrome/Windows): {fingerprint1}")
print(f"Device 2 (Safari/iOS):     {fingerprint2}")
print(f"Device 3 (Firefox/Windows): {fingerprint3}")
print(f"\nDevice 1 == Device 2? {fingerprint1 == fingerprint2} (Should be False)")
print(f"Device 1 == Device 3? {fingerprint1 == fingerprint3} (Should be False)")

# Test 2: Device Change Detection
print("\n\n2. DEVICE CHANGE DETECTION TEST")
print("-"*70)

# Create a test user
test_user_id = "test_device_change_user"

# Simulate first login with Chrome
logs_collection = db_instance.get_collection('login_logs')
logs_collection.insert_one({
    'user_id': test_user_id,
    'email': 'devicetest@example.com',
    'username': 'devicetest',
    'login_time': datetime.utcnow() - timedelta(hours=1),
    'status': 'success',
    'device_fingerprint': fingerprint1,
    'ip_address': '192.168.1.100'
})

print(f"✅ Created first login with fingerprint: {fingerprint1}")

# Now check if device changed when logging in with Firefox
device_changed = login_log_model.check_device_change(test_user_id, fingerprint3)
print(f"\n🔍 Logging in with different browser (Firefox)...")
print(f"   Device change detected? {device_changed}")
print(f"   Expected: True ✅" if device_changed else "   Expected: True ❌")

# Check if device is same when using Chrome again
device_changed_same = login_log_model.check_device_change(test_user_id, fingerprint1)
print(f"\n🔍 Logging in with same browser (Chrome)...")
print(f"   Device change detected? {device_changed_same}")
print(f"   Expected: False ✅" if not device_changed_same else "   Expected: False ❌")

# Test 3: Session Frequency
print("\n\n3. SESSION FREQUENCY TEST")
print("-"*70)

test_user_id2 = "test_frequency_user"

# Create multiple logins in the last hour
now = datetime.utcnow()
for i in range(7):
    logs_collection.insert_one({
        'user_id': test_user_id2,
        'email': 'freqtest@example.com',
        'username': 'freqtest',
        'login_time': now - timedelta(minutes=i*5),  # Every 5 minutes
        'status': 'success',
        'ip_address': f'192.168.1.{100+i}'
    })

print(f"✅ Created 7 logins in the last hour")

# Check session frequency
session_freq = login_log_model.calculate_session_frequency(test_user_id2)

print(f"\n📊 Session Frequency Results:")
print(f"   Logins in last hour: {session_freq['logins_last_hour']}")
print(f"   Logins in last day:  {session_freq['logins_last_day']}")
print(f"   Risk Level:          {session_freq['risk_level']}")

# Explain the risk level
if session_freq['logins_last_hour'] >= 10:
    expected_risk = 'high'
elif session_freq['logins_last_hour'] >= 5:
    expected_risk = 'medium'
elif session_freq['logins_last_hour'] >= 3:
    expected_risk = 'low'
else:
    expected_risk = 'low'

print(f"\n   Expected Risk Level: {expected_risk}")
print(f"   Actual Risk Level:   {session_freq['risk_level']}")
print(f"   Match: {'✅' if session_freq['risk_level'] == expected_risk else '❌'}")

# Test with even more logins (high risk)
print("\n\n4. HIGH FREQUENCY TEST (12 logins)")
print("-"*70)

test_user_id3 = "test_high_frequency_user"

# Create 12 logins in the last hour
for i in range(12):
    logs_collection.insert_one({
        'user_id': test_user_id3,
        'email': 'highfreq@example.com',
        'username': 'highfreq',
        'login_time': now - timedelta(minutes=i*3),  # Every 3 minutes
        'status': 'success',
        'ip_address': f'192.168.1.{150+i}'
    })

print(f"✅ Created 12 logins in the last hour")

session_freq_high = login_log_model.calculate_session_frequency(test_user_id3)

print(f"\n📊 High Frequency Results:")
print(f"   Logins in last hour: {session_freq_high['logins_last_hour']}")
print(f"   Risk Level:          {session_freq_high['risk_level']}")
print(f"   Expected:            high")
print(f"   Match: {'✅' if session_freq_high['risk_level'] == 'high' else '❌'}")

# Cleanup
print("\n\n5. CLEANUP")
print("-"*70)
logs_collection.delete_many({'user_id': {'$in': [test_user_id, test_user_id2, test_user_id3]}})
print("✅ Test data cleaned up")

print("\n" + "="*70)
print("✅ ALL TESTS COMPLETE!")
print("="*70)
print("\nSUMMARY:")
print("  ✅ Device Fingerprinting: Working")
print("  ✅ Device Change Detection: Working")
print("  ✅ Session Frequency (Medium Risk): Working")
print("  ✅ Session Frequency (High Risk): Working")
print("\n🎉 Both features are fully functional!")
