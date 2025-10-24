#!/usr/bin/env python3

print("Testing imports...")

try:
    print("1. Testing basic imports...")
    from flask import Flask
    print("✓ Flask import OK")
    
    print("2. Testing database...")
    from database import db_instance
    print("✓ Database import OK")
    
    print("3. Testing existing routes...")
    from routes.auth import auth_bp
    print("✓ Auth routes OK")
    
    print("4. Testing services...")
    from services.targeting_service import TargetingService
    print("✓ Targeting service OK")
    
    from services.cap_monitoring_service import CapMonitoringService
    print("✓ Cap monitoring service OK")
    
    from services.tracking_service import TrackingService
    print("✓ Tracking service OK")
    
    from services.access_control_service import AccessControlService
    print("✓ Access control service OK")
    
    print("5. Testing offer serving routes...")
    from routes.offer_serving import offer_serving_bp
    print("✓ Offer serving routes OK")
    
    print("6. Testing app creation...")
    from app import create_app
    app = create_app()
    print("✓ App creation OK")
    
    print("\n🎉 All imports successful!")
    
except Exception as e:
    print(f"\n❌ Import error: {e}")
    import traceback
    traceback.print_exc()
