"""
Test script to simulate a conversion and trigger postback
Run this script to test if postbacks are being sent to partners
"""

import requests
import json
from datetime import datetime
import uuid

# Configuration
API_BASE_URL = "http://localhost:5000"
ADMIN_EMAIL = "admin@example.com"  # Change to your admin email
ADMIN_PASSWORD = "admin123"  # Change to your admin password

def login():
    """Login and get auth token"""
    response = requests.post(f"{API_BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    
    if response.status_code == 200:
        data = response.json()
        print(f"✅ Login successful: {data.get('user', {}).get('username')}")
        return data.get('token')
    else:
        print(f"❌ Login failed: {response.text}")
        return None

def get_offers(token):
    """Get list of offers"""
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.get(f"{API_BASE_URL}/api/admin/offers", headers=headers)
    
    if response.status_code == 200:
        offers = response.json().get('offers', [])
        print(f"\n📋 Found {len(offers)} offers")
        return offers
    else:
        print(f"❌ Failed to get offers: {response.text}")
        return []

def create_test_click(offer_id, affiliate_id="test_affiliate_123"):
    """Create a test click for an offer"""
    click_id = str(uuid.uuid4())
    
    # Simulate click tracking
    click_data = {
        'click_id': click_id,
        'offer_id': offer_id,
        'affiliate_id': affiliate_id,
        'ip_address': '127.0.0.1',
        'user_agent': 'Mozilla/5.0 (Test Browser)',
        'country': 'US',
        'sub_ids': {
            'sub1': 'test_sub1',
            'sub2': 'test_sub2',
            'sub3': '',
            'sub4': '',
            'sub5': ''
        },
        'clicked_at': datetime.utcnow().isoformat(),
        'conversion_window_expires': datetime.utcnow().isoformat()
    }
    
    print(f"\n🖱️ Created test click: {click_id}")
    return click_data

def simulate_conversion(token, offer_id):
    """Simulate a conversion for testing postback"""
    
    # First, create a click
    click_data = create_test_click(offer_id)
    
    # Now create a conversion
    conversion_data = {
        'click_id': click_data['click_id'],
        'transaction_id': str(uuid.uuid4()),
        'payout': 10.00,
        'status': 'approved',
        'response_data': {
            'test': True,
            'timestamp': datetime.utcnow().isoformat()
        }
    }
    
    print(f"\n💰 Simulating conversion...")
    print(f"   Click ID: {conversion_data['click_id']}")
    print(f"   Transaction ID: {conversion_data['transaction_id']}")
    print(f"   Payout: ${conversion_data['payout']}")
    
    return conversion_data

def manually_insert_conversion(offer):
    """Manually insert a conversion into database for testing"""
    from database import db_instance
    from datetime import datetime, timedelta
    import uuid
    
    # Get collections
    clicks_collection = db_instance.get_collection('clicks')
    conversions_collection = db_instance.get_collection('conversions')
    
    # Create a test click
    click_id = str(uuid.uuid4())
    click_doc = {
        'click_id': click_id,
        'offer_id': offer['offer_id'],
        'affiliate_id': 'test_affiliate_123',
        'ip_address': '127.0.0.1',
        'user_agent': 'Mozilla/5.0 (Test Browser)',
        'country': 'US',
        'sub_ids': {
            'sub1': 'test_sub1',
            'sub2': 'test_sub2',
            'sub3': '',
            'sub4': '',
            'sub5': ''
        },
        'status': 'pending',
        'clicked_at': datetime.utcnow(),
        'conversion_window_expires': datetime.utcnow() + timedelta(days=30),
        'created_at': datetime.utcnow()
    }
    
    clicks_collection.insert_one(click_doc)
    print(f"\n✅ Test click created: {click_id}")
    
    # Create a test conversion
    conversion_id = str(uuid.uuid4())
    transaction_id = str(uuid.uuid4())
    
    conversion_doc = {
        'conversion_id': conversion_id,
        'transaction_id': transaction_id,
        'click_id': click_id,
        'offer_id': offer['offer_id'],
        'partner_id': offer.get('partner_id', ''),
        'affiliate_id': 'test_affiliate_123',
        'payout': offer.get('payout', 10.00),
        'currency': offer.get('currency', 'USD'),
        'status': 'approved',
        'conversion_time': datetime.utcnow(),
        'ip_address': '127.0.0.1',
        'user_agent': 'Mozilla/5.0 (Test Browser)',
        'country': 'US',
        'sub_ids': {
            'sub1': 'test_sub1',
            'sub2': 'test_sub2',
            'sub3': '',
            'sub4': '',
            'sub5': ''
        },
        'response_data': {
            'test': True,
            'timestamp': datetime.utcnow().isoformat()
        },
        'created_at': datetime.utcnow()
    }
    
    conversions_collection.insert_one(conversion_doc)
    print(f"✅ Test conversion created: {conversion_id}")
    print(f"   Transaction ID: {transaction_id}")
    print(f"   Partner ID: {offer.get('partner_id', 'None')}")
    
    # Now queue the postback
    if offer.get('partner_id'):
        from services.tracking_service import TrackingService
        tracking_service = TrackingService()
        tracking_service._queue_postback(offer, conversion_doc)
        print(f"✅ Postback queued for partner: {offer.get('partner_id')}")
    else:
        print(f"⚠️ No partner_id found for this offer")
    
    return conversion_doc

def main():
    print("=" * 60)
    print("🧪 POSTBACK TESTING SCRIPT")
    print("=" * 60)
    
    # Login
    token = login()
    if not token:
        return
    
    # Get offers
    offers = get_offers(token)
    if not offers:
        print("\n❌ No offers found. Create an offer first!")
        return
    
    # Show offers with partner_id
    print("\n📋 Offers with Partners:")
    offers_with_partners = [o for o in offers if o.get('partner_id')]
    
    if not offers_with_partners:
        print("⚠️ No offers are mapped to partners!")
        print("\nTo test postbacks:")
        print("1. Go to Admin → Partners")
        print("2. Create a partner with a test postback URL")
        print("3. Edit an offer and select that partner")
        return
    
    for i, offer in enumerate(offers_with_partners, 1):
        print(f"{i}. {offer.get('name')} (ID: {offer.get('offer_id')})")
        print(f"   Partner ID: {offer.get('partner_id')}")
    
    # Select offer
    if len(offers_with_partners) == 1:
        selected_offer = offers_with_partners[0]
        print(f"\n✅ Auto-selected: {selected_offer.get('name')}")
    else:
        choice = input(f"\nSelect offer (1-{len(offers_with_partners)}): ")
        try:
            selected_offer = offers_with_partners[int(choice) - 1]
        except:
            print("❌ Invalid selection")
            return
    
    # Create test conversion
    print(f"\n🚀 Creating test conversion for: {selected_offer.get('name')}")
    conversion = manually_insert_conversion(selected_offer)
    
    print("\n" + "=" * 60)
    print("✅ TEST CONVERSION CREATED!")
    print("=" * 60)
    print(f"\nConversion ID: {conversion['conversion_id']}")
    print(f"Transaction ID: {conversion['transaction_id']}")
    print(f"Partner ID: {conversion.get('partner_id', 'None')}")
    
    print("\n📤 POSTBACK STATUS:")
    print("The postback has been queued and will be sent within 30 seconds")
    print("\nTo monitor:")
    print("1. Go to Admin → Postback Logs")
    print("2. Check your webhook.site URL for incoming requests")
    print("3. Look for the conversion_id and transaction_id in the logs")
    
    print("\n" + "=" * 60)

if __name__ == "__main__":
    main()
