#!/usr/bin/env python3
"""Test geolocation service"""

print("🔍 Testing GeolocationService...")

try:
    from models.geolocation import GeolocationService
    
    geo_service = GeolocationService()
    print("✅ GeolocationService imported and initialized")
    
    # Test with localhost IP
    print("\n📡 Testing with localhost IP (127.0.0.1)...")
    geo_info = geo_service.get_ip_info('127.0.0.1')
    print(f"✅ Got geo info: {geo_info}")
    
    # Test with a real IP
    print("\n📡 Testing with public IP (8.8.8.8)...")
    geo_info = geo_service.get_ip_info('8.8.8.8')
    print(f"✅ Got geo info: {geo_info}")
    
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()
