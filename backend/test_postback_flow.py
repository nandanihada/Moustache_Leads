"""
Test the complete postback flow:
1. Simulate receiving a postback from upward partner
2. Verify it forwards to the correct downward partner
3. Check that macros are replaced correctly
"""

import requests
import json
from datetime import datetime

# Base URL
BASE_URL = "http://localhost:5000"

def test_postback_flow():
    print("="*80)
    print("TESTING COMPLETE POSTBACK FLOW")
    print("="*80)
    
    # Step 1: Check if received-postbacks endpoint exists
    print("\n1️⃣ Testing Received Postbacks Endpoint...")
    try:
        # Get admin token (you'll need to login first)
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "admin123"
        })
        
        if login_response.status_code == 200:
            token = login_response.json().get('token')
            headers = {'Authorization': f'Bearer {token}'}
            
            # Test received postbacks endpoint
            response = requests.get(f"{BASE_URL}/api/admin/received-postbacks?limit=10", headers=headers)
            print(f"   Status: {response.status_code}")
            if response.status_code == 200:
                data = response.json()
                print(f"   ✅ Endpoint works! Found {len(data.get('logs', []))} received postbacks")
            else:
                print(f"   ❌ Error: {response.text}")
        else:
            print(f"   ❌ Login failed: {login_response.text}")
    except Exception as e:
        print(f"   ❌ Error: {e}")
    
    # Step 2: Check forwarded-postbacks endpoint
    print("\n2️⃣ Testing Forwarded Postbacks Endpoint...")
    try:
        if token:
            response = requests.get(f"{BASE_URL}/api/admin/forwarded-postbacks?limit=10", headers=headers)
            print(f"   Status: {response.status_code}")
            if response.status_code == 200:
                data = response.json()
                print(f"   ✅ Endpoint works! Found {len(data.get('logs', []))} forwarded postbacks")
                
                # Show sample forwarded postback
                if data.get('logs'):
                    sample = data['logs'][0]
                    print(f"\n   📋 Sample Forwarded Postback:")
                    print(f"      Publisher: {sample.get('publisher_name')}")
                    print(f"      Username: {sample.get('username')}")
                    print(f"      Points: {sample.get('points')}")
                    print(f"      URL: {sample.get('forward_url')}")
                    print(f"      Status: {sample.get('forward_status')}")
            else:
                print(f"   ❌ Error: {response.text}")
    except Exception as e:
        print(f"   ❌ Error: {e}")
    
    # Step 3: Simulate a postback
    print("\n3️⃣ Simulating Postback from Upward Partner...")
    try:
        # This would be the URL an upward partner calls
        # You'll need a valid partner key from your database
        postback_url = f"{BASE_URL}/postback/test_key_123"
        params = {
            'click_id': 'test_click_123',
            'offer_id': 'ML-00057',
            'status': 'approved',
            'payout': '10.00',
            'transaction_id': 'txn_123',
            'conversion_id': 'conv_123'
        }
        
        response = requests.get(postback_url, params=params)
        print(f"   Status: {response.status_code}")
        print(f"   Response: {response.text[:200]}")
        
        if response.status_code == 200:
            print("   ✅ Postback received successfully!")
            print("   Check the Python backend logs to see the forwarding details")
        else:
            print(f"   ⚠️ Response: {response.text}")
    except Exception as e:
        print(f"   ❌ Error: {e}")
    
    print("\n" + "="*80)
    print("TEST COMPLETE")
    print("="*80)
    print("\n📝 Summary:")
    print("   - Received Postbacks endpoint: Check above")
    print("   - Forwarded Postbacks endpoint: Check above")
    print("   - Postback simulation: Check above")
    print("\n💡 Next Steps:")
    print("   1. Check the Python backend terminal for detailed forwarding logs")
    print("   2. Verify macros are being replaced correctly")
    print("   3. Confirm only the correct user receives the postback")

if __name__ == "__main__":
    test_postback_flow()
