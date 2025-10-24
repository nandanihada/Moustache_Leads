#!/usr/bin/env python3
"""
Quick test script to verify authentication endpoints
"""
import requests
import json

BASE_URL = "http://localhost:5000"

def test_health():
    """Test health endpoint"""
    try:
        response = requests.get(f"{BASE_URL}/health")
        print(f"Health Check: {response.status_code}")
        print(f"Response: {response.json()}")
        return response.status_code == 200
    except Exception as e:
        print(f"Health check failed: {e}")
        return False

def test_register():
    """Test user registration"""
    test_user = {
        "username": "testuser",
        "email": "test@example.com",
        "password": "testpass123"
    }
    
    try:
        response = requests.post(f"{BASE_URL}/api/auth/register", json=test_user)
        print(f"Register: {response.status_code}")
        print(f"Response: {response.json()}")
        return response.status_code in [200, 201]
    except Exception as e:
        print(f"Registration test failed: {e}")
        return False

def test_login():
    """Test user login"""
    login_data = {
        "username": "testuser",
        "password": "testpass123"
    }
    
    try:
        response = requests.post(f"{BASE_URL}/login", json=login_data)
        print(f"Login: {response.status_code}")
        print(f"Response: {response.json()}")
        return response.status_code == 200
    except Exception as e:
        print(f"Login test failed: {e}")
        return False

if __name__ == "__main__":
    print("Testing Ascend Backend Authentication...")
    print("=" * 50)
    
    # Test health
    if test_health():
        print("✅ Health check passed")
    else:
        print("❌ Health check failed")
        exit(1)
    
    print()
    
    # Test registration
    if test_register():
        print("✅ Registration test passed")
    else:
        print("❌ Registration test failed")
    
    print()
    
    # Test login
    if test_login():
        print("✅ Login test passed")
    else:
        print("❌ Login test failed")
    
    print("\nAll tests completed!")
