"""
Test login with fraud detection manually
"""

from services.activity_tracking_service import ActivityTrackingService
from flask import Request
from werkzeug.test import EnvironBuilder
from werkzeug.wrappers import Request as WerkzeugRequest

# Create a mock request
builder = EnvironBuilder(method='POST', path='/api/auth/login')
builder.headers['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
env = builder.get_environ()
mock_request = WerkzeugRequest(env)
mock_request.remote_addr = '127.0.0.1'

# Create mock user data
user_data = {
    '_id': 'test_user_123',
    'email': 'test@example.com',
    'username': 'testuser'
}

print("="*70)
print("Testing Activity Tracking with Fraud Detection")
print("="*70)

# Create service
service = ActivityTrackingService()

# Track login
print("\nCalling track_login_attempt...")
session_id = service.track_login_attempt(
    user_data=user_data,
    request=mock_request,
    status='success',
    login_method='password'
)

print(f"\nSession ID created: {session_id}")

# Now check the login log
from database import db_instance
logs_collection = db_instance.get_collection('login_logs')

login_log = logs_collection.find_one({'session_id': session_id})

if login_log:
    print("\nLogin log created successfully!")
    print(f"Has vpn_detection: {'vpn_detection' in login_log}")
    print(f"Has device_fingerprint: {'device_fingerprint' in login_log}")
    print(f"Has fraud_score: {'fraud_score' in login_log}")
    
    if 'vpn_detection' in login_log:
        print(f"\nVPN Detection: {login_log['vpn_detection']}")
    
    if 'fraud_score' in login_log:
        print(f"\nFraud Score: {login_log['fraud_score']}")
        print(f"Risk Level: {login_log['risk_level']}")
else:
    print("\nERROR: Login log not created!")

print("\n" + "="*70)
