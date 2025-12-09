"""
Test Postback Forwarding with Username and Points
This script simulates receiving a postback and checks if we forward correct data
"""

import requests
import json
from datetime import datetime

# Test configuration
BACKEND_URL = "http://localhost:5000"

def test_postback_forwarding():
    """
    Test that we forward postbacks with correct username and points
    """
    print("="*80)
    print("🧪 TESTING POSTBACK FORWARDING")
    print("="*80)
    
    # Step 1: Check if we have any placements with postbackUrl
    print("\n📋 Step 1: Checking placements with postbackUrl...")
    
    from database import db_instance
    if not db_instance.is_connected():
        print("❌ Database not connected!")
        return
    
    placements = db_instance.get_collection('placements')
    placements_with_postback = list(placements.find({
        'postbackUrl': {'$exists': True, '$ne': '', '$ne': None}
    }))
    
    print(f"   Found {len(placements_with_postback)} placements with postbackUrl")
    
    if len(placements_with_postback) == 0:
        print("   ⚠️ No placements have postbackUrl configured!")
        print("   Please configure a postbackUrl in at least one placement first.")
        return
    
    for placement in placements_with_postback:
        print(f"\n   📍 Placement: {placement.get('offerwallTitle')}")
        print(f"      Postback URL: {placement.get('postbackUrl')}")
    
    # Step 2: Check if we have test data
    print("\n📋 Step 2: Getting test data...")
    
    # Get a test offer
    offers = db_instance.get_collection('offers')
    test_offer = offers.find_one({'offer_id': {'$exists': True}})
    
    if not test_offer:
        print("   ❌ No offers found in database!")
        return
    
    offer_id = test_offer.get('offer_id')
    payout = test_offer.get('payout', 100)
    
    print(f"   Offer ID: {offer_id}")
    print(f"   Payout: {payout} points")
    
    # Get a test user
    users = db_instance.get_collection('users')
    test_user = users.find_one({'username': {'$exists': True}})
    
    if not test_user:
        print("   ❌ No users found in database!")
        return
    
    user_id = str(test_user.get('_id'))
    username = test_user.get('username')
    email = test_user.get('email', 'test@example.com')
    
    print(f"   User ID: {user_id}")
    print(f"   Username: {username}")
    print(f"   Email: {email}")
    
    # Step 3: Create a test click
    print("\n📋 Step 3: Creating test click...")
    
    clicks = db_instance.get_collection('clicks')
    test_click_id = f"TEST_{datetime.utcnow().timestamp()}"
    
    click_data = {
        'click_id': test_click_id,
        'offer_id': offer_id,
        'user_id': user_id,
        'username': username,
        'timestamp': datetime.utcnow(),
        'status': 'pending'
    }
    
    clicks.insert_one(click_data)
    print(f"   ✅ Created test click: {test_click_id}")
    
    # Step 4: Simulate postback from upstream partner
    print("\n📋 Step 4: Simulating postback from upstream partner...")
    
    # Get a test partner with unique_postback_key
    partners = db_instance.get_collection('partners')
    test_partner = partners.find_one({'unique_postback_key': {'$exists': True}})
    
    if not test_partner:
        print("   ⚠️ No partner with unique_postback_key found!")
        print("   Creating a test partner...")
        
        import secrets
        unique_key = secrets.token_urlsafe(24)
        
        partners.insert_one({
            'partner_id': 'TEST_PARTNER',
            'partner_name': 'Test Partner',
            'unique_postback_key': unique_key,
            'created_at': datetime.utcnow()
        })
        
        test_partner = partners.find_one({'unique_postback_key': unique_key})
    
    unique_key = test_partner.get('unique_postback_key')
    
    # Simulate postback
    postback_url = f"{BACKEND_URL}/postback/{unique_key}"
    postback_params = {
        'click_id': test_click_id,
        'offer_id': offer_id,
        'user_id': user_id,
        'status': 'approved',
        'payout': str(payout),
        'conversion_id': f'CONV_{test_click_id}',
        'transaction_id': f'TXN_{test_click_id}'
    }
    
    print(f"   Sending postback to: {postback_url}")
    print(f"   Parameters: {json.dumps(postback_params, indent=2)}")
    
    try:
        response = requests.get(postback_url, params=postback_params, timeout=10)
        print(f"   ✅ Postback sent! Status: {response.status_code}")
        print(f"   Response: {response.text[:200]}")
    except Exception as e:
        print(f"   ❌ Error sending postback: {e}")
        return
    
    # Step 5: Check placement_postback_logs to see what was forwarded
    print("\n📋 Step 5: Checking what was forwarded to placements...")
    
    import time
    time.sleep(2)  # Wait for async processing
    
    placement_logs = db_instance.get_collection('placement_postback_logs')
    recent_logs = list(placement_logs.find().sort('timestamp', -1).limit(5))
    
    if len(recent_logs) == 0:
        print("   ⚠️ No placement postback logs found!")
        print("   This might mean the forwarding didn't work.")
        return
    
    print(f"   Found {len(recent_logs)} recent forwarding logs:")
    
    for log in recent_logs:
        print(f"\n   📤 Forwarded to: {log.get('placement_title')}")
        print(f"      URL: {log.get('postback_url')}")
        print(f"      Status: {log.get('status')}")
        print(f"      Response: {log.get('response_code')}")
        
        # Check if URL contains our username and points
        url = log.get('postback_url', '')
        
        if username in url:
            print(f"      ✅ Username '{username}' found in URL!")
        else:
            print(f"      ❌ Username '{username}' NOT found in URL!")
        
        if str(payout) in url:
            print(f"      ✅ Points '{payout}' found in URL!")
        else:
            print(f"      ❌ Points '{payout}' NOT found in URL!")
    
    print("\n" + "="*80)
    print("✅ TEST COMPLETE!")
    print("="*80)
    
    # Cleanup
    print("\n🧹 Cleaning up test data...")
    clicks.delete_one({'click_id': test_click_id})
    print("   ✅ Deleted test click")

if __name__ == '__main__':
    test_postback_forwarding()
