#!/usr/bin/env python3
"""
Test rotation logic for /api/offerwall/track/click endpoint
"""

import requests
import json
from collections import Counter
import time

BASE_URL = "http://localhost:5000"

def test_rotation_logic(offer_id="ML-00037", num_requests=100):
    """
    Test rotation logic by sending multiple requests and analyzing distribution
    
    Args:
        offer_id: Offer ID to test
        num_requests: Number of requests to send
    """
    
    print(f"🧪 Testing Rotation Logic for Offer: {offer_id}")
    print(f"📊 Sending {num_requests} requests...")
    print("=" * 60)
    
    # Track results
    redirect_urls = []
    errors = []
    
    # Test data
    test_data = {
        "placement_id": "test_placement_123",
        "user_id": "test_user_456", 
        "offer_id": offer_id,
        "offer_name": "Test Offer",
        "user_agent": "Test Agent"
    }
    
    # Send multiple requests
    for i in range(num_requests):
        try:
            response = requests.post(
                f"{BASE_URL}/api/offerwall/track/click",
                json=test_data,
                headers={'Content-Type': 'application/json'}
            )
            
            if response.status_code == 200:
                data = response.json()
                if 'redirect_url' in data:
                    redirect_urls.append(data['redirect_url'])
                else:
                    errors.append(f"No redirect_url in response: {data}")
            else:
                errors.append(f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            errors.append(f"Request error: {str(e)}")
        
        # Progress indicator
        if (i + 1) % 10 == 0:
            print(f"Progress: {i + 1}/{num_requests}")
    
    # Analyze results
    print("\n" + "=" * 60)
    print("📊 ROTATION ANALYSIS RESULTS")
    print("=" * 60)
    
    if redirect_urls:
        # Count URL distribution
        url_counts = Counter(redirect_urls)
        total_successful = len(redirect_urls)
        
        print(f"✅ Successful requests: {total_successful}/{num_requests}")
        print(f"🔗 Unique URLs found: {len(url_counts)}")
        print()
        
        # Show distribution
        print("📈 URL Distribution:")
        for url, count in url_counts.most_common():
            percentage = (count / total_successful) * 100
            print(f"  {url}")
            print(f"    Count: {count} ({percentage:.1f}%)")
            print()
        
        # Rotation effectiveness
        if len(url_counts) > 1:
            print("✅ ROTATION IS WORKING! Multiple URLs detected.")
            
            # Check if distribution seems reasonable
            percentages = [(count / total_successful) * 100 for count in url_counts.values()]
            max_percentage = max(percentages)
            min_percentage = min(percentages)
            
            if max_percentage < 90:  # No single URL dominates too much
                print("✅ Distribution looks reasonable (no single URL > 90%)")
            else:
                print("⚠️ One URL dominates heavily - check rotation weights")
                
        else:
            print("❌ ROTATION NOT WORKING - Only one unique URL found")
            print("   Check if rotation rules are configured for this offer")
    
    else:
        print("❌ No successful requests - check server and offer configuration")
    
    # Show errors if any
    if errors:
        print(f"\n⚠️ Errors encountered: {len(errors)}")
        for error in errors[:5]:  # Show first 5 errors
            print(f"  - {error}")
        if len(errors) > 5:
            print(f"  ... and {len(errors) - 5} more errors")

def test_single_request(offer_id="ML-00037"):
    """Test a single request to see the response format"""
    
    print(f"🧪 Testing Single Request for Offer: {offer_id}")
    print("=" * 50)
    
    test_data = {
        "placement_id": "test_placement_123",
        "user_id": "test_user_456",
        "offer_id": offer_id,
        "offer_name": "Test Offer",
        "user_agent": "Test Agent"
    }
    
    try:
        response = requests.post(
            f"{BASE_URL}/api/offerwall/track/click",
            json=test_data,
            headers={'Content-Type': 'application/json'}
        )
        
        print(f"Status Code: {response.status_code}")
        print(f"Response: {json.dumps(response.json(), indent=2)}")
        
    except Exception as e:
        print(f"❌ Error: {str(e)}")

def main():
    """Run rotation tests"""
    
    print("🚀 ROTATION LOGIC TESTING")
    print("=" * 80)
    
    # Test 1: Single request to check format
    test_single_request()
    
    print("\n" + "=" * 80)
    
    # Test 2: Multiple requests to test rotation
    test_rotation_logic(num_requests=50)  # Start with 50 requests
    
    print("\n" + "=" * 80)
    print("🏁 TESTING COMPLETE")
    
    print("\n📋 NEXT STEPS:")
    print("1. Check server logs for rotation selection details")
    print("2. Verify Smart Rules are configured for the offer")
    print("3. Ensure rotation rules have type='Rotation' and active=True")
    print("4. Check that splitPercentage values are set correctly")

if __name__ == "__main__":
    main()
