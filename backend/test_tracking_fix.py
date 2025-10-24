#!/usr/bin/env python3
"""
Quick test to verify tracking link fix
"""

import requests

def test_tracking_endpoint():
    """Test the tracking endpoint"""
    
    print("🧪 Testing Tracking Link Fix")
    print("=" * 50)
    
    # Test URL (same format as frontend generates)
    test_url = "http://localhost:5000/track/click?offer_id=ML-00037&campaign_id=44&target=https%3A//google.com"
    
    print(f"Testing URL: {test_url}")
    
    try:
        response = requests.get(test_url, allow_redirects=False)
        
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 302:
            print("✅ SUCCESS! Redirect working")
            print(f"Redirect Location: {response.headers.get('Location')}")
        elif response.status_code == 404:
            print("❌ STILL 404 - Endpoint not found")
        elif response.status_code == 500:
            print("❌ Server Error")
            print(f"Response: {response.text}")
        else:
            print(f"❌ Unexpected status: {response.status_code}")
            print(f"Response: {response.text}")
            
    except requests.exceptions.ConnectionError:
        print("❌ Connection failed - server not running")
        print("Start server with: python app.py")
    except Exception as e:
        print(f"❌ Error: {str(e)}")

if __name__ == "__main__":
    test_tracking_endpoint()
