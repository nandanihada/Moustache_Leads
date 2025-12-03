#!/usr/bin/env python3
"""
🧪 OFFERWALL TRACKING TEST
Test the new tracking URL generation and click tracking
"""

import requests
import json
import time
from datetime import datetime

# Configuration
BASE_URL = "http://localhost:5000"
PLACEMENT_ID = "4hN81lEwE7Fw1hnI"
USER_ID = "test_user_tracking"

def print_header(title):
    """Print a formatted header"""
    print(f"\n{'='*60}")
    print(f"🧪 {title}")
    print(f"{'='*60}")

def print_result(test_name, success, details=""):
    """Print test result"""
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"{status} {test_name}")
    if details:
        print(f"   {details}")

def test_offerwall_offers():
    """Test getting offers with tracking URLs"""
    print_header("TEST 1: GET OFFERS WITH TRACKING URLs")
    
    try:
        response = requests.get(f"{BASE_URL}/api/offerwall/offers", params={
            'placement_id': PLACEMENT_ID,
            'user_id': USER_ID,
            'limit': 5
        })
        
        if response.status_code == 200:
            data = response.json()
            offers = data.get('offers', [])
            
            print_result("API Response", True, f"Found {len(offers)} offers")
            
            # Check each offer for tracking URLs
            for i, offer in enumerate(offers):
                offer_id = offer.get('id')
                title = offer.get('title', 'No title')
                click_url = offer.get('click_url')
                
                print(f"\n📦 Offer {i+1}: {title}")
                print(f"   ID: {offer_id}")
                print(f"   Click URL: {click_url}")
                
                # Check if URL is valid
                if click_url and click_url != '#':
                    print_result(f"Offer {i+1} Tracking URL", True, click_url[:50] + "...")
                else:
                    print_result(f"Offer {i+1} Tracking URL", False, "No valid URL")
            
            return True
        else:
            print_result("API Response", False, f"Status: {response.status_code}")
            return False
            
    except Exception as e:
        print_result("API Request", False, str(e))
        return False

def test_click_tracking():
    """Test click tracking with enhanced data"""
    print_header("TEST 2: CLICK TRACKING")
    
    try:
        # First get an offer to test with
        response = requests.get(f"{BASE_URL}/api/offerwall/offers", params={
            'placement_id': PLACEMENT_ID,
            'user_id': USER_ID,
            'limit': 1
        })
        
        if response.status_code != 200:
            print_result("Get Offer for Click Test", False, "Failed to get offers")
            return False
        
        offers = response.json().get('offers', [])
        if not offers:
            print_result("Get Offer for Click Test", False, "No offers available")
            return False
        
        offer = offers[0]
        offer_id = offer.get('id')
        offer_title = offer.get('title')
        click_url = offer.get('click_url')
        
        # Track click
        click_data = {
            'session_id': f"test_session_{int(time.time())}",
            'offer_id': offer_id,
            'placement_id': PLACEMENT_ID,
            'user_id': USER_ID,
            'offer_name': offer_title,
            'offer_url': click_url,
            'user_agent': 'Mozilla/5.0 (Test Browser)',
            'referrer': 'http://localhost:5173/offerwall'
        }
        
        response = requests.post(f"{BASE_URL}/api/offerwall/track/click", 
                               json=click_data,
                               headers={'Content-Type': 'application/json'})
        
        if response.status_code == 200:
            click_result = response.json()
            click_id = click_result.get('click_id')
            
            print_result("Click Tracking", True, f"Click ID: {click_id}")
            print(f"   Offer: {offer_title}")
            print(f"   URL: {click_url}")
            return True
        else:
            print_result("Click Tracking", False, f"Status: {response.status_code}")
            print(f"   Response: {response.text}")
            return False
            
    except Exception as e:
        print_result("Click Tracking", False, str(e))
        return False

def test_conversion_tracking():
    """Test conversion tracking and activity creation"""
    print_header("TEST 3: CONVERSION TRACKING")
    
    try:
        # Get an offer for conversion test
        response = requests.get(f"{BASE_URL}/api/offerwall/offers", params={
            'placement_id': PLACEMENT_ID,
            'user_id': USER_ID,
            'limit': 1
        })
        
        if response.status_code != 200:
            print_result("Get Offer for Conversion Test", False, "Failed to get offers")
            return False
        
        offers = response.json().get('offers', [])
        if not offers:
            print_result("Get Offer for Conversion Test", False, "No offers available")
            return False
        
        offer = offers[0]
        offer_id = offer.get('id')
        offer_title = offer.get('title')
        
        # Track conversion
        conversion_data = {
            'session_id': f"test_session_{int(time.time())}",
            'click_id': f"test_click_{int(time.time())}",
            'offer_id': offer_id,
            'placement_id': PLACEMENT_ID,
            'user_id': USER_ID,
            'payout_amount': 100.0,
            'offer_name': offer_title,
            'transaction_id': f"txn_{int(time.time())}",
            'offer_network': 'TestNetwork',
            'user_agent': 'Mozilla/5.0 (Test Browser)'
        }
        
        response = requests.post(f"{BASE_URL}/api/offerwall/track/conversion", 
                               json=conversion_data,
                               headers={'Content-Type': 'application/json'})
        
        if response.status_code == 200:
            conversion_result = response.json()
            conversion_id = conversion_result.get('conversion_id')
            
            print_result("Conversion Tracking", True, f"Conversion ID: {conversion_id}")
            print(f"   Offer: {offer_title}")
            print(f"   Payout: ${conversion_data['payout_amount']}")
            
            # Wait a moment for activity to be created
            time.sleep(1)
            
            # Check if activity was created
            activity_response = requests.get(f"{BASE_URL}/api/offerwall/user/activity", params={
                'user_id': USER_ID,
                'placement_id': PLACEMENT_ID
            })
            
            if activity_response.status_code == 200:
                activities = activity_response.json().get('activities', [])
                
                # Look for our conversion
                found_activity = False
                for activity in activities:
                    if activity.get('offer_id') == offer_id:
                        found_activity = True
                        print_result("Activity Creation", True, f"Found activity for {offer_title}")
                        print(f"   Completed: {activity.get('completed_ago', 'Unknown')}")
                        print(f"   Reward: {activity.get('reward_amount', 0)}")
                        break
                
                if not found_activity:
                    print_result("Activity Creation", False, "Activity not found")
                
                return found_activity
            else:
                print_result("Activity Check", False, f"Status: {activity_response.status_code}")
                return False
        else:
            print_result("Conversion Tracking", False, f"Status: {response.status_code}")
            print(f"   Response: {response.text}")
            return False
            
    except Exception as e:
        print_result("Conversion Tracking", False, str(e))
        return False

def test_user_stats():
    """Test user stats after conversion"""
    print_header("TEST 4: USER STATS")
    
    try:
        response = requests.get(f"{BASE_URL}/api/offerwall/user/stats", params={
            'user_id': USER_ID,
            'placement_id': PLACEMENT_ID
        })
        
        if response.status_code == 200:
            stats_data = response.json()
            stats = stats_data.get('stats', {})
            
            print_result("Stats API", True, "Stats retrieved successfully")
            
            print(f"\n📊 User Stats:")
            print(f"   Total Earned: ${stats.get('total_earned', 0)}")
            print(f"   Today Earned: ${stats.get('today_earned', 0)}")
            print(f"   Offers Completed: {stats.get('offers_completed', 0)}")
            print(f"   Completed Offers: {len(stats.get('completed_offers', []))}")
            
            return True
        else:
            print_result("Stats API", False, f"Status: {response.status_code}")
            return False
            
    except Exception as e:
        print_result("Stats API", False, str(e))
        return False

def main():
    """Run all tests"""
    print_header("OFFERWALL TRACKING TEST SUITE")
    print(f"🚀 Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"📍 Placement ID: {PLACEMENT_ID}")
    print(f"👤 User ID: {USER_ID}")
    
    # Run all tests
    tests = [
        ("Get Offers with Tracking URLs", test_offerwall_offers),
        ("Click Tracking", test_click_tracking),
        ("Conversion Tracking", test_conversion_tracking),
        ("User Stats", test_user_stats)
    ]
    
    results = []
    for test_name, test_func in tests:
        result = test_func()
        results.append((test_name, result))
        time.sleep(1)  # Small delay between tests
    
    # Summary
    print_header("TEST SUMMARY")
    
    passed = 0
    total = len(results)
    
    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} {test_name}")
        if result:
            passed += 1
    
    print(f"\n📊 Results: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All tests passed! Offerwall tracking is working correctly.")
    else:
        print("⚠️ Some tests failed. Check the details above.")
    
    print(f"\n🏁 Finished at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

if __name__ == "__main__":
    main()
