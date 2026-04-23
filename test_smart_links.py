#!/usr/bin/env python3
"""
Smart Link System Test Script

This script tests the smart link functionality by:
1. Creating a test smart link
2. Testing the redirect endpoint
3. Verifying analytics logging
"""

import requests
import json
import time
from datetime import datetime

# Configuration
BASE_URL = "http://localhost:5000"  # Adjust if running on different port
API_BASE_URL = f"{BASE_URL}/api"

def test_smart_link_system():
    """Test the complete smart link system"""

    print("🧪 Testing Smart Link System")
    print("=" * 50)

    # Test 1: Create a smart link
    print("\n1. Creating Smart Link...")
    create_payload = {
        "name": "Test Smart Link",
        "slug": "test-link",
        "status": "active"
    }

    try:
        response = requests.post(f"{API_BASE_URL}/admin/smart-links", json=create_payload)
        if response.status_code == 200:
            data = response.json()
            if data.get('success'):
                smart_link = data['smart_link']
                print(f"✅ Smart link created: {smart_link['name']} (slug: {smart_link['slug']})")
                smart_link_id = smart_link['_id']
            else:
                print(f"❌ Failed to create smart link: {data.get('error')}")
                return
        else:
            print(f"❌ HTTP Error: {response.status_code}")
            return
    except Exception as e:
        print(f"❌ Connection error: {str(e)}")
        return

    # Test 2: Test redirect endpoint
    print("\n2. Testing Redirect Endpoint...")
    smart_link_url = f"{BASE_URL}/smart/test-link"

    try:
        # Test with US IP simulation (add headers to simulate)
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'CF-IPCountry': 'US',  # Simulate Cloudflare geo header
            'X-Real-IP': '8.8.8.8'
        }

        response = requests.get(smart_link_url, headers=headers, allow_redirects=False)

        if response.status_code in [301, 302]:
            redirect_url = response.headers.get('Location')
            print(f"✅ Redirect successful to: {redirect_url}")
        elif response.status_code == 404:
            print("⚠️  No eligible offers found (this is expected if no test offers exist)")
        else:
            print(f"❌ Unexpected response: {response.status_code}")

    except Exception as e:
        print(f"❌ Redirect test failed: {str(e)}")

    # Test 3: Check analytics
    print("\n3. Checking Analytics...")
    try:
        response = requests.get(f"{API_BASE_URL}/admin/smart-links/{smart_link_id}/analytics")
        if response.status_code == 200:
            data = response.json()
            if data.get('success'):
                analytics = data['analytics']
                print(f"✅ Analytics retrieved: {analytics['total_clicks']} clicks, {analytics['unique_visitors']} unique visitors")
            else:
                print(f"❌ Analytics error: {data.get('error')}")
        else:
            print(f"❌ Analytics HTTP error: {response.status_code}")
    except Exception as e:
        print(f"❌ Analytics test failed: {str(e)}")

    # Test 4: List smart links
    print("\n4. Listing Smart Links...")
    try:
        response = requests.get(f"{API_BASE_URL}/admin/smart-links")
        if response.status_code == 200:
            data = response.json()
            if data.get('success'):
                links = data['smart_links']
                print(f"✅ Found {len(links)} smart link(s)")
                for link in links:
                    print(f"   - {link['name']} ({link['slug']}) - {link['status']}")
            else:
                print(f"❌ List error: {data.get('error')}")
        else:
            print(f"❌ List HTTP error: {response.status_code}")
    except Exception as e:
        print(f"❌ List test failed: {str(e)}")

    # Test 5: Delete test smart link
    print("\n5. Cleaning up...")
    try:
        response = requests.delete(f"{API_BASE_URL}/admin/smart-links/{smart_link_id}")
        if response.status_code == 200:
            data = response.json()
            if data.get('success'):
                print("✅ Test smart link deleted")
            else:
                print(f"❌ Delete error: {data.get('error')}")
        else:
            print(f"❌ Delete HTTP error: {response.status_code}")
    except Exception as e:
        print(f"❌ Delete test failed: {str(e)}")

    print("\n🎉 Smart Link System Test Complete!")
    print("\nNext steps:")
    print("1. Add test offers to your database with proper targeting")
    print("2. Test with real IP addresses from different countries")
    print("3. Verify analytics are being recorded correctly")
    print("4. Test device and traffic source filtering")

if __name__ == "__main__":
    test_smart_link_system()