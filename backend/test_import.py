#!/usr/bin/env python3
"""Test imports"""

try:
    from routes.offer_serving import offer_serving_bp
    print("✅ offer_serving import successful")
except Exception as e:
    print(f"❌ offer_serving import failed: {str(e)}")

try:
    from app import create_app
    print("✅ app import successful")
    app = create_app()
    print("✅ app creation successful")
except Exception as e:
    print(f"❌ app import/creation failed: {str(e)}")
