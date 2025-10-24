#!/usr/bin/env python3
"""
Test the tracking link functionality
"""

import requests
import urllib.parse

def test_tracking_link():
    """Test the tracking link with the problematic URL"""
    
    # Original problematic URL
    original_url = "http://localhost:5000/track/click?offer_id=ML-00037&campaign_id=44&target=https%253A%252F%252Fpractice.geeksforgeeks.org%252Fexplore%252F%253FproblemType%253Dfull%2526difficulty%25255B%25255D%253D-2%2526page%253D1"
    
    print("🧪 Testing Tracking Link")
    print("=" * 60)
    print(f"Original URL: {original_url}")
    
    # Parse the URL to understand the issue
    parsed = urllib.parse.urlparse(original_url)
    query_params = urllib.parse.parse_qs(parsed.query)
    
    print(f"\nParsed components:")
    print(f"  Base URL: {parsed.scheme}://{parsed.netloc}{parsed.path}")
    print(f"  Query params: {query_params}")
    
    # Decode the target URL
    target_encoded = query_params.get('target', [''])[0]
    target_decoded = urllib.parse.unquote(target_encoded)
    
    print(f"\nTarget URL:")
    print(f"  Encoded: {target_encoded}")
    print(f"  Decoded: {target_decoded}")
    
    # Test the endpoint
    try:
        print(f"\n🔗 Testing the tracking endpoint...")
        
        # Make request to the tracking endpoint
        response = requests.get(original_url, allow_redirects=False)
        
        print(f"Status Code: {response.status_code}")
        print(f"Headers: {dict(response.headers)}")
        
        if response.status_code == 302:
            print(f"✅ Redirect successful!")
            print(f"Redirect Location: {response.headers.get('Location')}")
        elif response.status_code == 200:
            print(f"✅ Response received")
            print(f"Response: {response.text[:500]}...")
        else:
            print(f"❌ Unexpected status code")
            print(f"Response: {response.text}")
            
    except requests.exceptions.ConnectionError:
        print("❌ Connection failed - server not running")
    except Exception as e:
        print(f"❌ Error: {str(e)}")

def test_simple_tracking_link():
    """Test with a simpler tracking link"""
    
    print(f"\n🧪 Testing Simple Tracking Link")
    print("=" * 60)
    
    # Create a simpler test URL
    test_url = "http://localhost:5000/track/click?offer_id=ML-00037&campaign_id=44&target=https://google.com&geo=US"
    
    print(f"Test URL: {test_url}")
    
    try:
        response = requests.get(test_url, allow_redirects=False)
        
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 302:
            print(f"✅ Redirect successful!")
            print(f"Redirect Location: {response.headers.get('Location')}")
        elif response.status_code == 200:
            print(f"✅ Response received")
            print(f"Response: {response.text[:500]}...")
        else:
            print(f"❌ Unexpected status code")
            print(f"Response: {response.text}")
            
    except requests.exceptions.ConnectionError:
        print("❌ Connection failed - server not running")
    except Exception as e:
        print(f"❌ Error: {str(e)}")

def test_health_check():
    """Test if the server is running"""
    
    print(f"\n🧪 Testing Server Health")
    print("=" * 60)
    
    try:
        response = requests.get("http://localhost:5000/health")
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            print("✅ Server is running")
            data = response.json()
            print(f"Response: {data}")
        else:
            print("❌ Server health check failed")
            
    except requests.exceptions.ConnectionError:
        print("❌ Server not running on localhost:5000")
    except Exception as e:
        print(f"❌ Error: {str(e)}")

def main():
    """Run all tests"""
    
    print("🚀 TRACKING LINK TESTS")
    print("=" * 80)
    
    # Test 1: Health check
    test_health_check()
    
    # Test 2: Simple tracking link
    test_simple_tracking_link()
    
    # Test 3: Original problematic URL
    test_tracking_link()
    
    print("\n" + "=" * 80)
    print("🏁 TESTS COMPLETE")
    
    print("\n📋 NEXT STEPS:")
    print("1. Make sure the server is running: python app.py")
    print("2. Check server logs for any errors")
    print("3. Verify the offer ML-00037 exists in the database")
    print("4. Test with a browser to see the actual redirect")

if __name__ == "__main__":
    main()
