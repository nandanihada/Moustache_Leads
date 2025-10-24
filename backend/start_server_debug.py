#!/usr/bin/env python3
"""
Debug server startup script with enhanced error handling
"""

import sys
import os
import traceback
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

def test_imports():
    """Test all critical imports"""
    print("🔍 Testing critical imports...")
    
    try:
        from models.offer_extended import OfferExtended
        print("✅ OfferExtended imported successfully")
    except Exception as e:
        print(f"❌ OfferExtended import failed: {str(e)}")
        traceback.print_exc()
        return False
    
    try:
        from utils.frontend_mapping import FrontendDatabaseMapper
        print("✅ FrontendDatabaseMapper imported successfully")
    except Exception as e:
        print(f"❌ FrontendDatabaseMapper import failed: {str(e)}")
        traceback.print_exc()
        return False
    
    try:
        from utils.json_serializer import safe_json_response
        print("✅ JSON serializer imported successfully")
    except Exception as e:
        print(f"❌ JSON serializer import failed: {str(e)}")
        traceback.print_exc()
        return False
    
    return True

def start_server():
    """Start the server with enhanced error handling"""
    print("🚀 Starting server with debug mode...")
    
    try:
        # Test imports first
        if not test_imports():
            print("❌ Import tests failed - cannot start server")
            return False
        
        # Import app
        from app import create_app
        print("✅ App imported successfully")
        
        # Create app
        app = create_app()
        print("✅ App created successfully")
        
        # Get config
        try:
            from config import Config
            port = Config.PORT
            debug = Config.FLASK_ENV == 'development'
        except:
            port = 5000
            debug = True
        
        print(f"🌐 Starting server on http://localhost:{port}")
        print("📋 Available endpoints:")
        print("   - GET  /api/admin/offers")
        print("   - POST /api/admin/offers")
        print("   - PUT  /api/admin/offers/{id}")
        print("   - GET  /api/admin/offers/{id}")
        print("   - GET  /health")
        
        # Start server
        app.run(
            host='0.0.0.0',
            port=port,
            debug=debug,
            use_reloader=False  # Disable reloader to avoid double startup
        )
        
        return True
        
    except Exception as e:
        print(f"❌ Server startup failed: {str(e)}")
        traceback.print_exc()
        return False

if __name__ == "__main__":
    print("=" * 60)
    print("🔧 DEBUG SERVER STARTUP")
    print("=" * 60)
    
    success = start_server()
    
    if not success:
        print("\n❌ Server failed to start. Check the errors above.")
        sys.exit(1)
