"""
Test script to verify login tracking is working and create sample data
"""

import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from models.login_logs import LoginLog
from models.active_sessions import ActiveSession
from datetime import datetime, timedelta
import random

def create_sample_login_logs():
    """Create sample login logs for testing"""
    login_log = LoginLog()
    
    # Sample users
    users = [
        {'id': 'user1', 'email': 'john@example.com', 'username': 'john_doe'},
        {'id': 'user2', 'email': 'jane@example.com', 'username': 'jane_smith'},
        {'id': 'user3', 'email': 'admin@example.com', 'username': 'admin'},
    ]
    
    # Sample IPs and locations
    locations = [
        {'ip': '192.168.1.1', 'city': 'New York', 'country': 'United States', 'country_code': 'US'},
        {'ip': '192.168.1.2', 'city': 'London', 'country': 'United Kingdom', 'country_code': 'GB'},
        {'ip': '192.168.1.3', 'city': 'Tokyo', 'country': 'Japan', 'country_code': 'JP'},
    ]
    
    # Sample devices
    devices = [
        {'type': 'desktop', 'os': 'Windows 10', 'browser': 'Chrome 120.0', 'version': '120.0', 'is_mobile': False, 'is_tablet': False, 'is_pc': True, 'is_bot': False},
        {'type': 'mobile', 'os': 'iOS 17', 'browser': 'Safari 17.0', 'version': '17.0', 'is_mobile': True, 'is_tablet': False, 'is_pc': False, 'is_bot': False},
        {'type': 'tablet', 'os': 'Android 13', 'browser': 'Chrome 119.0', 'version': '119.0', 'is_mobile': False, 'is_tablet': True, 'is_pc': False, 'is_bot': False},
    ]
    
    print("Creating sample login logs...")
    
    # Create 20 successful logins
    for i in range(20):
        user = random.choice(users)
        location = random.choice(locations)
        device = random.choice(devices)
        
        # Random time in the last 7 days
        days_ago = random.randint(0, 7)
        hours_ago = random.randint(0, 23)
        login_time = datetime.utcnow() - timedelta(days=days_ago, hours=hours_ago)
        
        log_data = {
            'user_id': user['id'],
            'email': user['email'],
            'username': user['username'],
            'login_time': login_time,
            'logout_time': login_time + timedelta(hours=random.randint(1, 4)) if random.random() > 0.3 else None,
            'ip_address': location['ip'],
            'device': device,
            'location': location,
            'login_method': random.choice(['password', 'otp', 'sso']),
            'status': 'success',
            'failure_reason': None,
            'session_id': f'session_{i}',
            'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
        
        log_id = login_log.create_log(log_data)
        if log_id:
            print(f"✅ Created successful login log {i+1}/20: {user['email']}")
        else:
            print(f"❌ Failed to create log {i+1}")
    
    # Create 5 failed logins
    for i in range(5):
        user = random.choice(users)
        location = random.choice(locations)
        device = random.choice(devices)
        
        days_ago = random.randint(0, 3)
        hours_ago = random.randint(0, 23)
        login_time = datetime.utcnow() - timedelta(days=days_ago, hours=hours_ago)
        
        log_data = {
            'user_id': user['id'],
            'email': user['email'],
            'username': user['username'],
            'login_time': login_time,
            'logout_time': None,
            'ip_address': location['ip'],
            'device': device,
            'location': location,
            'login_method': 'password',
            'status': 'failed',
            'failure_reason': random.choice(['wrong_password', 'account_locked', 'wrong_otp']),
            'session_id': None,
            'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
        
        log_id = login_log.create_log(log_data)
        if log_id:
            print(f"✅ Created failed login log {i+1}/5: {user['email']}")
        else:
            print(f"❌ Failed to create log {i+1}")
    
    print("\n✅ Sample data creation complete!")
    print("\nNow check /admin/login-logs to see the data!")

def create_active_session():
    """Create a sample active session"""
    active_session = ActiveSession()
    
    session_data = {
        'session_id': 'test_session_123',
        'user_id': 'admin',
        'email': 'admin@example.com',
        'username': 'admin',
        'current_page': '/admin/login-logs',
        'ip_address': '127.0.0.1',
        'location': {
            'ip': '127.0.0.1',
            'city': 'Local',
            'country': 'Local',
            'country_code': 'XX'
        },
        'device': {
            'type': 'desktop',
            'os': 'Windows 10',
            'browser': 'Chrome 120.0'
        }
    }
    
    session_id = active_session.create_session(session_data)
    if session_id:
        print(f"\n✅ Created active session: {session_id}")
        print("Check /admin/active-users to see it!")
    else:
        print("\n❌ Failed to create active session")

if __name__ == '__main__':
    print("=" * 60)
    print("LOGIN LOGS TEST DATA GENERATOR")
    print("=" * 60)
    print()
    
    try:
        create_sample_login_logs()
        create_active_session()
        
        print("\n" + "=" * 60)
        print("SUCCESS! Test data created.")
        print("=" * 60)
        print("\nNext steps:")
        print("1. Go to http://localhost:8080/admin/login-logs")
        print("2. You should see 25 login logs (20 success, 5 failed)")
        print("3. Go to http://localhost:8080/admin/active-users")
        print("4. You should see 1 active session")
        print("\nTo test real tracking:")
        print("1. Logout and login again")
        print("2. Your new login will be tracked automatically!")
        
    except Exception as e:
        print(f"\n❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()
