#!/usr/bin/env python3
"""Test server health and endpoints"""

import requests

def test_server_health():
    """Test if server is running"""
    try:
        response = requests.get("http://localhost:5000/health")
        print(f"Health check: {response.status_code}")
        if response.status_code == 200:
            print(f"✅ Server is running")
            print(f"Response: {response.json()}")
        else:
            print(f"❌ Server health check failed")
    except Exception as e:
        print(f"❌ Server not reachable: {str(e)}")

def test_offerwall_endpoint():
    """Test if offerwall endpoint exists"""
    try:
        # Test with minimal data
        test_data = {
            "placement_id": "test",
            "user_id": "test", 
            "offer_id": "ML-00037"
        }
        
        response = requests.post(
            "http://localhost:5000/api/offerwall/track/click",
            json=test_data
        )
        
        print(f"Offerwall endpoint: {response.status_code}")
        print(f"Response: {response.text}")
        
    except Exception as e:
        print(f"❌ Offerwall endpoint error: {str(e)}")

if __name__ == "__main__":
    print("🧪 Testing Server Health")
    test_server_health()
    print("\n🧪 Testing Offerwall Endpoint")
    test_offerwall_endpoint()
