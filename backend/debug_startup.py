#!/usr/bin/env python3
"""
Debug startup script to identify server loading issues
Run this to diagnose problems with app.py
"""

import sys
import os
import traceback

def test_python_environment():
    """Test basic Python environment"""
    print("🐍 Testing Python Environment...")
    print(f"   Python version: {sys.version}")
    print(f"   Python path: {sys.executable}")
    print(f"   Current directory: {os.getcwd()}")
    print(f"   Script directory: {os.path.dirname(os.path.abspath(__file__))}")
    print()

def test_basic_imports():
    """Test basic Python imports"""
    print("📦 Testing Basic Imports...")
    
    basic_imports = [
        'flask',
        'flask_cors',
        'logging',
        'datetime',
        'json',
        'os',
        'sys'
    ]
    
    for module in basic_imports:
        try:
            __import__(module)
            print(f"   ✅ {module}")
        except Exception as e:
            print(f"   ❌ {module}: {str(e)}")
    print()

def test_project_imports():
    """Test project-specific imports"""
    print("🏗️ Testing Project Imports...")
    
    project_imports = [
        'config',
        'database',
        'models.offer',
        'models.user'
    ]
    
    for module in project_imports:
        try:
            __import__(module)
            print(f"   ✅ {module}")
        except Exception as e:
            print(f"   ❌ {module}: {str(e)}")
    print()

def test_route_imports():
    """Test route imports"""
    print("🛣️ Testing Route Imports...")
    
    route_imports = [
        'routes.auth',
        'routes.admin_offers',
        'routes.offer_schedule_rules',
        'routes.offer_click_handler'
    ]
    
    for module in route_imports:
        try:
            __import__(module)
            print(f"   ✅ {module}")
        except Exception as e:
            print(f"   ❌ {module}: {str(e)}")
    print()

def test_service_imports():
    """Test service imports"""
    print("⚙️ Testing Service Imports...")
    
    service_imports = [
        'services.schedule_activation_service',
        'services.smart_rules_resolver',
        'services.tracking_service',
        'services.cap_monitoring_service'
    ]
    
    for module in service_imports:
        try:
            __import__(module)
            print(f"   ✅ {module}")
        except Exception as e:
            print(f"   ❌ {module}: {str(e)}")
    print()

def test_app_creation():
    """Test creating the Flask app"""
    print("🚀 Testing App Creation...")
    
    try:
        from app import create_app
        app = create_app()
        print("   ✅ Flask app created successfully")
        print(f"   ✅ App name: {app.name}")
        print(f"   ✅ Registered blueprints: {len(app.blueprints)}")
        for name in app.blueprints:
            print(f"      - {name}")
        return True
    except Exception as e:
        print(f"   ❌ App creation failed: {str(e)}")
        traceback.print_exc()
        return False

def test_minimal_app():
    """Test minimal app creation"""
    print("🔧 Testing Minimal App...")
    
    try:
        from app_minimal import create_minimal_app
        app = create_minimal_app()
        print("   ✅ Minimal app created successfully")
        return True
    except Exception as e:
        print(f"   ❌ Minimal app creation failed: {str(e)}")
        traceback.print_exc()
        return False

def main():
    """Main diagnostic function"""
    print("=" * 60)
    print("🔍 ASCEND BACKEND STARTUP DIAGNOSTICS")
    print("=" * 60)
    print()
    
    # Run all tests
    test_python_environment()
    test_basic_imports()
    test_project_imports()
    test_route_imports()
    test_service_imports()
    
    # Test app creation
    app_success = test_app_creation()
    
    if not app_success:
        print("⚠️ Main app failed, testing minimal app...")
        minimal_success = test_minimal_app()
        
        if minimal_success:
            print()
            print("💡 RECOMMENDATION:")
            print("   Main app failed but minimal app works.")
            print("   Try running: python app_minimal.py")
            print("   Then visit the debug endpoints to identify the issue.")
        else:
            print()
            print("💡 RECOMMENDATION:")
            print("   Both apps failed. Check the error messages above.")
            print("   Focus on fixing the import errors first.")
    else:
        print()
        print("✅ DIAGNOSIS COMPLETE:")
        print("   Main app creation successful!")
        print("   You should be able to run: python app.py")
    
    print()
    print("=" * 60)

if __name__ == "__main__":
    main()
