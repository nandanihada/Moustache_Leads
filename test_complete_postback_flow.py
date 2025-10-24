"""
Complete Postback Flow Test for PepperAds - Offer ML-00050
This simulates the full flow: Click → Conversion → Postback
"""

import requests
import time
import json

# Production backend URL
BACKEND_URL = "https://moustacheleads-backend.onrender.com"

# Your actual offer ID
OFFER_ID = "ML-00050"
PARTNER_NAME = "pepperAds"

def step1_create_click():
    """Step 1: Simulate a user clicking the offer"""
    print("\n" + "=" * 70)
    print("📍 STEP 1: Creating Click Record")
    print("=" * 70)
    
    # Generate unique SubID
    timestamp = int(time.time())
    subid = f"test_sub_{timestamp}"
    
    print(f"\n🖱️  Simulating user click...")
    print(f"   Offer ID: {OFFER_ID}")
    print(f"   SubID: {subid}")
    
    # Create click by visiting the tracking URL
    try:
        # Use the /track/click endpoint
        params = {
            'offer_id': OFFER_ID,
            'subid': subid,
            'user_id': 'test_user_001'
        }
        
        print(f"\n📤 Sending click to: {BACKEND_URL}/track/click")
        print(f"   Parameters: {params}")
        
        response = requests.get(
            f"{BACKEND_URL}/track/click",
            params=params,
            allow_redirects=False,  # Don't follow redirects
            timeout=15
        )
        
        print(f"\n✅ Click Response: {response.status_code}")
        
        if response.status_code in [200, 302, 307]:
            print(f"✅ Click recorded successfully!")
            print(f"📋 SubID for conversion: {subid}")
            return subid
        else:
            print(f"⚠️  Unexpected status: {response.status_code}")
            print(f"Response: {response.text[:200]}")
            return None
            
    except Exception as e:
        print(f"❌ Error creating click: {e}")
        return None

def step2_track_conversion(subid):
    """Step 2: Track conversion using SubID"""
    print("\n" + "=" * 70)
    print("📊 STEP 2: Tracking Conversion")
    print("=" * 70)
    
    if not subid:
        print("❌ No SubID available. Cannot track conversion.")
        return False
    
    conversion_data = {
        "subid": subid,  # Use SubID instead of click_id
        "payout": 5.00,
        "status": "approved",
        "conversion_type": "lead"
    }
    
    print(f"\n📋 Conversion Details:")
    print(f"   SubID: {subid}")
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
            print(f"\n✅ Conversion tracked successfully!")
            return True
        else:
            print(f"\n⚠️  Failed to track conversion")
            return False
            
    except Exception as e:
        print(f"\n❌ Error: {e}")
        return False

def step3_verify_postback():
    """Step 3: Verify postback was sent"""
    print("\n" + "=" * 70)
    print("🔍 STEP 3: Verify Postback")
    print("=" * 70)
    
    print(f"\n📋 Check these places:")
    
    print(f"\n1. 🌐 PepperAds Postback URL")
    print(f"   - Check if pepperAds received the postback")
    print(f"   - If using webhook.site, check for new request")
    
    print(f"\n2. 📊 Admin Panel → Postback Logs")
    print(f"   - Login: https://moustache-leads.vercel.app")
    print(f"   - Go to: Admin → Postback Logs")
    print(f"   - Look for: Offer {OFFER_ID}, Partner {PARTNER_NAME}")
    print(f"   - Status should be: success (200)")
    
    print(f"\n3. 🖥️  Render Backend Logs")
    print(f"   - Go to: https://dashboard.render.com")
    print(f"   - Select your backend service")
    print(f"   - Click 'Logs' tab")
    print(f"   - Look for: 'Postback sent successfully' or 'Processing postback'")
    
    print(f"\n💡 What to look for in postback:")
    print(f"   - Partner: {PARTNER_NAME}")
    print(f"   - Offer: {OFFER_ID}")
    print(f"   - Payout: $5.00")
    print(f"   - Status: approved")

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
        return False

def main():
    print("\n")
    print("=" * 70)
    print("🧪 COMPLETE POSTBACK FLOW TEST")
    print("   Partner: pepperAds")
    print("   Offer: ML-00050")
    print("=" * 70)
    
    # Check backend health
    if not check_backend_health():
        print("\n⚠️  Backend might be sleeping. Continuing anyway...")
    
    print("\n📋 IMPORTANT: Before running this test:")
    print("   1. Make sure offer ML-00050 exists and is active")
    print("   2. Make sure pepperAds partner is assigned to ML-00050")
    print("   3. Make sure pepperAds has a valid postback URL")
    print("   4. If using webhook.site, have it open in another tab")
    
    input("\n⏸️  Press Enter to start the test...")
    
    # Step 1: Create click
    subid = step1_create_click()
    
    if not subid:
        print("\n❌ Failed to create click. Cannot continue.")
        return
    
    # Wait a moment
    print("\n⏳ Waiting 2 seconds...")
    time.sleep(2)
    
    # Step 2: Track conversion
    success = step2_track_conversion(subid)
    
    if not success:
        print("\n❌ Failed to track conversion.")
        return
    
    # Wait for postback processing
    print("\n⏳ Waiting 3 seconds for postback processing...")
    time.sleep(3)
    
    # Step 3: Verify postback
    step3_verify_postback()
    
    print("\n" + "=" * 70)
    print("🎉 TEST COMPLETED!")
    print("=" * 70)
    print("\n✅ If everything worked:")
    print("   1. Click was recorded")
    print("   2. Conversion was tracked")
    print("   3. Postback was sent to pepperAds")
    print("   4. You should see the postback in:")
    print("      - PepperAds system (or webhook.site)")
    print("      - Admin → Postback Logs")
    print("      - Render backend logs")
    
    print("\n")

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n⚠️  Test interrupted by user")
    except Exception as e:
        print(f"\n\n❌ Unexpected error: {e}")
        import traceback
        traceback.print_exc()
