"""
Monkey patch activity tracking to add debug output
Run this BEFORE starting the backend
"""

import sys
import os

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Import the original service
from services.activity_tracking_service import ActivityTrackingService

# Save the original method
original_track_login = ActivityTrackingService.track_login_attempt

# Create wrapper with debug output
def track_login_with_debug(self, user_data, request, status='success', failure_reason=None, login_method='password'):
    print(f"\n{'='*70}")
    print(f"🔍 TRACK_LOGIN_ATTEMPT CALLED")
    print(f"   User: {user_data.get('email')}")
    print(f"   Status: {status}")
    print(f"{'='*70}\n")
    
    # Call original
    result = original_track_login(self, user_data, request, status, failure_reason, login_method)
    
    print(f"\n{'='*70}")
    print(f"✅ TRACK_LOGIN_ATTEMPT COMPLETED")
    print(f"   Session ID: {result}")
    print(f"{'='*70}\n")
    
    return result

# Monkey patch
ActivityTrackingService.track_login_attempt = track_login_with_debug

print("✅ Monkey patch applied! Fraud detection will now show debug output.")
print("Now run: python app.py")
