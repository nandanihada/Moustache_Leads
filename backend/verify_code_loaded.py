"""
Quick check: Is fraud detection code in the running backend?
"""

# Import the activity tracking service
from services.activity_tracking_service import activity_tracking_service
import inspect

# Get the source code
source = inspect.getsource(activity_tracking_service.track_login_attempt)

# Check for fraud detection keywords
has_vpn = 'vpn_detection' in source
has_fraud_service = 'fraud_service' in source  
has_device_fingerprint = 'device_fingerprint' in source

print("="*70)
print("FRAUD DETECTION CODE CHECK")
print("="*70)
print(f"\nChecking if fraud detection code exists in track_login_attempt:")
print(f"  Has 'vpn_detection': {has_vpn}")
print(f"  Has 'fraud_service': {has_fraud_service}")
print(f"  Has 'device_fingerprint': {has_device_fingerprint}")

if has_vpn and has_fraud_service and has_device_fingerprint:
    print(f"\n✅ FRAUD DETECTION CODE IS PRESENT!")
else:
    print(f"\n❌ FRAUD DETECTION CODE IS MISSING!")
    print(f"\nYou need to restart the backend!")

# Show a snippet
print(f"\n" + "="*70)
print("CODE SNIPPET (lines with 'vpn'):")
print("="*70)
for i, line in enumerate(source.split('\n'), 1):
    if 'vpn' in line.lower():
        print(f"{i:3}: {line}")

print("\n" + "="*70)
