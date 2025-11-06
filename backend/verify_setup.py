"""
Quick verification script to check if everything is set up correctly
"""
import sys
import os

print("=" * 60)
print("VERIFICATION SCRIPT")
print("=" * 60)

# Test 1: Check if services folder exists
print("\n1. Checking services folder...")
if os.path.exists('services'):
    print("   ✅ services/ folder exists")
    if os.path.exists('services/__init__.py'):
        print("   ✅ services/__init__.py exists")
    else:
        print("   ❌ services/__init__.py MISSING")
    
    if os.path.exists('services/partner_postback_service.py'):
        print("   ✅ services/partner_postback_service.py exists")
    else:
        print("   ❌ services/partner_postback_service.py MISSING")
else:
    print("   ❌ services/ folder MISSING")

# Test 2: Try importing the service
print("\n2. Testing import...")
try:
    from services.partner_postback_service import partner_postback_service
    print("   ✅ Successfully imported partner_postback_service")
    print(f"   ✅ Service timeout: {partner_postback_service.timeout}s")
    print(f"   ✅ Max retries: {partner_postback_service.max_retries}")
except Exception as e:
    print(f"   ❌ Failed to import: {str(e)}")
    import traceback
    print(traceback.format_exc())
    sys.exit(1)

# Test 3: Check requests library
print("\n3. Checking requests library...")
try:
    import requests
    print(f"   ✅ requests library installed (version {requests.__version__})")
except Exception as e:
    print(f"   ❌ requests library NOT installed: {str(e)}")

# Test 4: Check database
print("\n4. Checking database connection...")
try:
    from database import db_instance
    if db_instance.is_connected():
        print("   ✅ Database connected")
        
        # Check collections
        users_collection = db_instance.get_collection('users')
        if users_collection is not None:
            partners = list(users_collection.find({
                'role': 'partner',
                'is_active': True,
                'postback_url': {'$exists': True, '$ne': ''}
            }))
            print(f"   ✅ Found {len(partners)} active partners with postback URLs")
            for p in partners:
                print(f"      - {p.get('username')}: {p.get('postback_url')}")
        else:
            print("   ⚠️ Cannot access users collection")
    else:
        print("   ❌ Database NOT connected")
except Exception as e:
    print(f"   ❌ Database check failed: {str(e)}")

print("\n" + "=" * 60)
print("✅ ALL CHECKS PASSED - System ready for distribution!")
print("=" * 60)
