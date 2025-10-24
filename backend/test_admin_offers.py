#!/usr/bin/env python3
"""
Test script for Admin Offers API
"""

import requests
import json

def test_admin_offers():
    """Test the admin offers functionality"""
    
    base_url = "http://localhost:5000"
    
    # Step 1: Login as admin
    print("🔐 Logging in as admin...")
    login_response = requests.post(f"{base_url}/api/auth/login", json={
        "username": "admin",
        "password": "admin123"
    })
    
    if login_response.status_code != 200:
        print(f"❌ Login failed: {login_response.text}")
        return
    
    login_data = login_response.json()
    token = login_data['token']
    user = login_data['user']
    
    print(f"✅ Login successful! User: {user['username']}, Role: {user.get('role', 'N/A')}")
    
    # Headers for authenticated requests
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    # Step 2: Test creating an offer
    print("\n📝 Creating a test offer...")
    offer_data = {
        "campaign_id": "TEST-001",
        "name": "Test Survey Offer",
        "description": "A test survey offer for validation",
        "status": "active",
        "countries": ["US", "CA", "UK"],
        "payout": 2.50,
        "network": "SuperRewards",
        "short_description": "Quick survey for rewards",
        "affiliates": "all",
        "image_url": "https://via.placeholder.com/400x300/4F46E5/FFFFFF?text=Survey+Offer",
        "thumbnail_url": "https://via.placeholder.com/150x150/4F46E5/FFFFFF?text=Survey",
        "target_url": "https://example.com/survey",
        "preview_url": "https://example.com/preview",
        "hash_code": "test123",
        "limit": 1000,
        "expiration_date": "2024-12-31",
        "device_targeting": "all"
    }
    
    create_response = requests.post(f"{base_url}/api/admin/offers", 
                                  json=offer_data, headers=headers)
    
    if create_response.status_code == 201:
        created_offer = create_response.json()
        print(f"✅ Offer created successfully!")
        print(f"   Offer ID: {created_offer['offer']['offer_id']}")
        print(f"   Name: {created_offer['offer']['name']}")
        print(f"   Payout: ${created_offer['offer']['payout']}")
        offer_id = created_offer['offer']['offer_id']
    else:
        print(f"❌ Failed to create offer: {create_response.text}")
        return
    
    # Step 3: Test getting offers
    print("\n📋 Fetching offers...")
    get_response = requests.get(f"{base_url}/api/admin/offers", headers=headers)
    
    if get_response.status_code == 200:
        offers_data = get_response.json()
        print(f"✅ Retrieved {len(offers_data['offers'])} offers")
        print(f"   Total offers: {offers_data['pagination']['total']}")
        for offer in offers_data['offers']:
            print(f"   - {offer['offer_id']}: {offer['name']} (${offer['payout']})")
    else:
        print(f"❌ Failed to get offers: {get_response.text}")
    
    # Step 4: Test getting specific offer
    print(f"\n🔍 Getting specific offer {offer_id}...")
    get_one_response = requests.get(f"{base_url}/api/admin/offers/{offer_id}", headers=headers)
    
    if get_one_response.status_code == 200:
        offer_detail = get_one_response.json()
        print(f"✅ Retrieved offer details:")
        print(f"   ID: {offer_detail['offer']['offer_id']}")
        print(f"   Campaign: {offer_detail['offer']['campaign_id']}")
        print(f"   Status: {offer_detail['offer']['status']}")
        print(f"   Countries: {offer_detail['offer']['countries']}")
    else:
        print(f"❌ Failed to get offer details: {get_one_response.text}")
    
    # Step 5: Test cloning offer
    print(f"\n📋 Cloning offer {offer_id}...")
    clone_response = requests.post(f"{base_url}/api/admin/offers/{offer_id}/clone", 
                                 headers=headers)
    
    if clone_response.status_code == 201:
        cloned_offer = clone_response.json()
        print(f"✅ Offer cloned successfully!")
        print(f"   Original: {offer_id}")
        print(f"   Clone: {cloned_offer['offer']['offer_id']}")
        print(f"   Clone Name: {cloned_offer['offer']['name']}")
        clone_id = cloned_offer['offer']['offer_id']
    else:
        print(f"❌ Failed to clone offer: {clone_response.text}")
        clone_id = None
    
    # Step 6: Test offer stats
    print("\n📊 Getting offer statistics...")
    stats_response = requests.get(f"{base_url}/api/admin/offers/stats", headers=headers)
    
    if stats_response.status_code == 200:
        stats = stats_response.json()['stats']
        print(f"✅ Offer statistics:")
        print(f"   Total offers: {stats['total_offers']}")
        print(f"   Active offers: {stats['active_offers']}")
        print(f"   Pending offers: {stats['pending_offers']}")
        print(f"   Inactive offers: {stats['inactive_offers']}")
        print(f"   Total hits: {stats['total_hits']}")
        if stats['top_networks']:
            print(f"   Top networks: {[n['_id'] for n in stats['top_networks']]}")
    else:
        print(f"❌ Failed to get stats: {stats_response.text}")
    
    # Step 7: Test updating offer
    print(f"\n✏️  Updating offer {offer_id}...")
    update_data = {
        "status": "pending",
        "payout": 3.00,
        "description": "Updated test survey offer",
        "image_url": "https://via.placeholder.com/400x300/10B981/FFFFFF?text=Updated+Offer",
        "thumbnail_url": "https://via.placeholder.com/150x150/10B981/FFFFFF?text=Updated"
    }
    
    update_response = requests.put(f"{base_url}/api/admin/offers/{offer_id}", 
                                 json=update_data, headers=headers)
    
    if update_response.status_code == 200:
        updated_offer = update_response.json()
        print(f"✅ Offer updated successfully!")
        print(f"   New status: {updated_offer['offer']['status']}")
        print(f"   New payout: ${updated_offer['offer']['payout']}")
    else:
        print(f"❌ Failed to update offer: {update_response.text}")
    
    # Step 8: Clean up - delete test offers
    print(f"\n🗑️  Cleaning up test offers...")
    
    # Delete original offer
    delete_response = requests.delete(f"{base_url}/api/admin/offers/{offer_id}", headers=headers)
    if delete_response.status_code == 200:
        print(f"✅ Deleted offer {offer_id}")
    else:
        print(f"❌ Failed to delete offer {offer_id}: {delete_response.text}")
    
    # Delete cloned offer if it exists
    if clone_id:
        delete_clone_response = requests.delete(f"{base_url}/api/admin/offers/{clone_id}", headers=headers)
        if delete_clone_response.status_code == 200:
            print(f"✅ Deleted cloned offer {clone_id}")
        else:
            print(f"❌ Failed to delete cloned offer {clone_id}: {delete_clone_response.text}")
    
    print("\n🎉 Admin Offers API testing completed!")

if __name__ == "__main__":
    test_admin_offers()
