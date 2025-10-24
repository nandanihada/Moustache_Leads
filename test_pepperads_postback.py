"""
Test Postback for PepperAds Partner and ML-00050 Offer
"""

import requests
import time
import json

# Production backend URL
BACKEND_URL = "https://moustacheleads-backend.onrender.com"

# Your actual offer ID
OFFER_ID = "ML-00050"
PARTNER_NAME = "pepperAds"

def test_conversion():
    """Create a test conversion for ML-00050 offer"""
    
    print("=" * 70)
    print("🧪 TESTING POSTBACK FOR PEPPERADS - OFFER ML-00050")
    print("=" * 70)
    
    # Generate unique IDs with timestamp
    timestamp = int(time.time())
    
    conversion_data = {
        "click_id": f"test_click_{timestamp}",
        "offer_id": OFFER_ID,
        "payout": 5.00,
        "status": "approved",
        "conversion_id": f"conv_{timestamp}",
        "transaction_id": f"txn_{timestamp}"
    }
    
    print(f"\n📋 Conversion Details:")
    print(f"   Offer ID: {OFFER_ID}")
    print(f"   Partner: {PARTNER_NAME}")
    print(f"   Click ID: {conversion_data['click_id']}")
    print(f"   Conversion ID: {conversion_data['conversion_id']}")
    print(f"   Transaction ID: {conversion_data['transaction_id']}")
    print(f"   Payout: ${conversion_data['payout']}")
    print(f"   Status: {conversion_data['status']}")
    
    print(f"\n📤 Sending conversion to backend...")
    print(f"   URL: {BACKEND_URL}/api/analytics/track-conversion")
    
    try:
        response = requests.post(
            f"{BACKEND_URL}/api/analytics/track-conversion",
            json=conversion_data,
            headers={"Content-Type": "application/json"},
            timeout=15
        )
        
        print(f"\n✅ Response Status: {response.status_code}")
        
        try:
            response_data = response.json()
            print(f"📄 Response Data:")
            print(json.dumps(response_data, indent=2))
        except:
            print(f"📄 Response Text: {response.text}")
        
        if response.status_code in [200, 201]:
            print("\n" + "=" * 70)
            print("✅ CONVERSION CREATED SUCCESSFULLY!")
            print("=" * 70)
            
            print(f"\n🔍 Now check these places:")
            print(f"\n1. 🌐 Webhook/Postback URL (if you set one for pepperAds)")
            print(f"   - Should receive a GET/POST request")
            print(f"   - Look for click_id: {conversion_data['click_id']}")
            
            print(f"\n2. 📊 Admin Panel → Postback Logs")
            print(f"   - Login: https://moustache-leads.vercel.app")
            print(f"   - Go to: Admin → Postback Logs")
            print(f"   - Look for: Offer {OFFER_ID}, Partner {PARTNER_NAME}")
            
            print(f"\n3. 🖥️  Render Backend Logs")
            print(f"   - Go to: https://dashboard.render.com")
            print(f"   - Select your backend service")
            print(f"   - Click 'Logs' tab")
            print(f"   - Look for: 'Postback sent' or 'Processing postback'")
            
            print(f"\n💡 Expected Postback URL Parameters:")
            print(f"   click_id={conversion_data['click_id']}")
            print(f"   offer_id={OFFER_ID}")
            print(f"   payout={conversion_data['payout']}")
            print(f"   status={conversion_data['status']}")
            print(f"   conversion_id={conversion_data['conversion_id']}")
            print(f"   transaction_id={conversion_data['transaction_id']}")
            
            return True
        else:
            print(f"\n⚠️  Unexpected status code: {response.status_code}")
            return False
            
    except requests.exceptions.Timeout:
        print(f"\n❌ Request timed out after 15 seconds")
        print(f"   Backend might be sleeping (Render free tier)")
        print(f"   Try again in 30 seconds")
        return False
        
    except requests.exceptions.ConnectionError:
        print(f"\n❌ Connection error")
        print(f"   Check if backend is deployed and running")
        print(f"   URL: {BACKEND_URL}")
        return False
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False

def check_backend_health():
    """Quick health check"""
    print("\n🔍 Checking backend health...")
    try:
        response = requests.get(f"{BACKEND_URL}/health", timeout=10)
        if response.status_code == 200:
            print(f"✅ Backend is running!")
            return True
        else:
            print(f"⚠️  Backend returned: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Backend health check failed: {e}")
        print(f"   Backend might be sleeping. Trying conversion anyway...")
        return False

if __name__ == "__main__":
    print("\n")
    
    # Check backend health first
    check_backend_health()
    
    print("\n")
    input("⏸️  Press Enter to create test conversion...")
    
    # Run the test
    success = test_conversion()
    
    if success:
        print("\n" + "=" * 70)
        print("🎉 TEST COMPLETED!")
        print("=" * 70)
        print("\n✅ Next steps:")
        print("   1. Check if postback was received by pepperAds")
        print("   2. Verify in Admin → Postback Logs")
        print("   3. Check Render logs for confirmation")
    else:
        print("\n" + "=" * 70)
        print("❌ TEST FAILED")
        print("=" * 70)
        print("\n🔧 Troubleshooting:")
        print("   1. Check if offer ML-00050 exists and is active")
        print("   2. Verify pepperAds partner is assigned to this offer")
        print("   3. Check if pepperAds has a valid postback URL")
        print("   4. Ensure backend is deployed and running")
    
    print("\n")
