"""
Test Postback System in Production
Run this script to test if postbacks are working on your deployed backend
"""

import requests
import time
import json

# Production URLs
BACKEND_URL = "https://moustacheleads-backend.onrender.com"
WEBHOOK_SITE = "https://webhook.site"  # You'll need to get your unique URL

def test_backend_health():
    """Test if backend is running"""
    print("\n🔍 Testing backend health...")
    try:
        response = requests.get(f"{BACKEND_URL}/health", timeout=10)
        print(f"✅ Backend is running: {response.status_code}")
        print(f"📄 Response: {response.json()}")
        return True
    except Exception as e:
        print(f"❌ Backend health check failed: {e}")
        return False

def create_test_conversion(offer_id="test_offer_001"):
    """Create a test conversion"""
    print(f"\n📤 Creating test conversion for offer: {offer_id}")
    
    timestamp = int(time.time())
    conversion_data = {
        "click_id": f"test_click_{timestamp}",
        "offer_id": offer_id,
        "payout": 5.00,
        "status": "approved",
        "conversion_id": f"conv_{timestamp}",
        "transaction_id": f"txn_{timestamp}"
    }
    
    print(f"📋 Conversion data:")
    print(json.dumps(conversion_data, indent=2))
    
    try:
        response = requests.post(
            f"{BACKEND_URL}/api/track/conversion",
            json=conversion_data,
            timeout=10
        )
        
        print(f"\n✅ Conversion created: {response.status_code}")
        print(f"📄 Response: {response.json()}")
        return True, conversion_data
        
    except Exception as e:
        print(f"❌ Failed to create conversion: {e}")
        return False, None

def check_postback_logs():
    """Check if postback logs endpoint is accessible"""
    print("\n🔍 Checking postback logs endpoint...")
    try:
        # Note: This requires authentication
        response = requests.get(f"{BACKEND_URL}/api/admin/postback-logs", timeout=10)
        print(f"📊 Postback logs endpoint: {response.status_code}")
        if response.status_code == 401:
            print("ℹ️  Authentication required (expected)")
        return True
    except Exception as e:
        print(f"⚠️  Could not check postback logs: {e}")
        return False

def main():
    print("=" * 60)
    print("🧪 POSTBACK SYSTEM TEST - PRODUCTION")
    print("=" * 60)
    
    # Step 1: Test backend health
    if not test_backend_health():
        print("\n❌ Backend is not responding. Check deployment.")
        return
    
    print("\n" + "=" * 60)
    print("📋 SETUP INSTRUCTIONS:")
    print("=" * 60)
    print("\n1. Go to https://webhook.site")
    print("2. Copy your unique webhook URL")
    print("3. Login to your admin panel:")
    print(f"   https://moustache-leads.vercel.app")
    print("\n4. Create a Partner:")
    print("   - Name: Test Partner")
    print("   - Partner ID: test_partner_001")
    print("   - Postback URL: https://webhook.site/YOUR-ID?click_id={click_id}&payout={payout}&status={status}")
    print("   - Method: GET")
    print("   - Status: Active")
    print("\n5. Create/Edit an Offer:")
    print("   - Offer ID: test_offer_001")
    print("   - Assign Partner: Test Partner")
    print("   - Status: Active")
    
    input("\n✅ Press Enter after completing the setup above...")
    
    # Step 2: Create test conversion
    print("\n" + "=" * 60)
    print("🚀 CREATING TEST CONVERSION")
    print("=" * 60)
    
    success, conversion_data = create_test_conversion()
    
    if success:
        print("\n" + "=" * 60)
        print("✅ TEST CONVERSION CREATED!")
        print("=" * 60)
        print("\n📋 Now check:")
        print("1. Your webhook.site URL - should show a new request")
        print("2. Admin → Postback Logs in your frontend")
        print("3. Render backend logs for postback processing")
        
        print(f"\n🔍 Look for this click_id in webhook.site:")
        print(f"   {conversion_data['click_id']}")
        
        print("\n💡 Expected webhook.site request:")
        print(f"   GET https://webhook.site/YOUR-ID")
        print(f"   Query params:")
        print(f"     - click_id: {conversion_data['click_id']}")
        print(f"     - payout: {conversion_data['payout']}")
        print(f"     - status: {conversion_data['status']}")
        print(f"     - offer_id: {conversion_data['offer_id']}")
        print(f"     - conversion_id: {conversion_data['conversion_id']}")
        print(f"     - transaction_id: {conversion_data['transaction_id']}")
    else:
        print("\n❌ Failed to create test conversion")
        print("Check:")
        print("1. Backend is deployed and running")
        print("2. MongoDB is connected")
        print("3. Offer exists with correct ID")
    
    # Step 3: Check postback logs
    check_postback_logs()
    
    print("\n" + "=" * 60)
    print("🎉 TEST COMPLETE!")
    print("=" * 60)
    print("\nIf postback was sent successfully, you should see:")
    print("✅ New request in webhook.site")
    print("✅ Log entry in Admin → Postback Logs")
    print("✅ Success message in Render backend logs")

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n⚠️  Test interrupted by user")
    except Exception as e:
        print(f"\n\n❌ Unexpected error: {e}")
        import traceback
        traceback.print_exc()
