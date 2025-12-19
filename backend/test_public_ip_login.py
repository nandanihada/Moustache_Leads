"""
Create a test login with a REAL public IP to demonstrate location data
This will call the actual IPInfo API and show real location/ISP data
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from services.activity_tracking_service import activity_tracking_service
from datetime import datetime
from flask import Request
from werkzeug.datastructures import Headers, EnvironHeaders
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Use a real Indian public IP for testing
# This is a sample public IP from India (not localhost)
TEST_PUBLIC_IP = '103.21.244.100'  # Indian public IP

print("\n" + "="*80)
print("CREATING TEST LOGIN WITH REAL PUBLIC IP")
print("="*80)
print(f"\nTest IP: {TEST_PUBLIC_IP}")
print("This will call the IPInfo API and retrieve actual location data\n")

# Create a mock request object with the public IP
class MockRequest:
    def __init__(self, ip_address):
        self.remote_addr = ip_address
        self.headers = Headers([
            ('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
        ])
        self.environ = {
            'REMOTE_ADDR': ip_address,
            'HTTP_USER_AGENT': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }

# Create mock user data
user_data = {
    '_id': 'test_real_ip_user',
    'username': 'test_real_ip',
    'email': 'test_real_ip@example.com',
    'role': 'user'
}

# Create mock request with public IP
mock_request = MockRequest(TEST_PUBLIC_IP)

print("📡 Calling activity tracking service...")
print("   This will:")
print("   1. Detect it's a public IP (not localhost)")
print("   2. Call IPInfo API to get location data")
print("   3. Store the enriched data in the database")
print()

try:
    # Track the login attempt
    log_id = activity_tracking_service.track_login_attempt(
        user_data=user_data,
        request=mock_request,
        status='success',
        login_method='password'
    )
    
    if log_id:
        print("✅ Login log created successfully!")
        print(f"   Log ID: {log_id}")
        print()
        print("🌐 Now check the Admin Login Logs page:")
        print("   URL: http://localhost:8080/admin/login-logs")
        print()
        print("   You should see a new entry for 'test_real_ip' with:")
        print("   - Real city, region, country (from India)")
        print("   - Real ISP name")
        print("   - Proper timezone")
        print()
    else:
        print("❌ Failed to create login log")
        
except Exception as e:
    logger.error(f"Error creating test login: {str(e)}", exc_info=True)
    print(f"\n❌ Error: {str(e)}")

print("="*80 + "\n")
