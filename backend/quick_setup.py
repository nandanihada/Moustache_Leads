#!/usr/bin/env python3
"""
Quick setup script to create admin user and sample offers
"""

import requests
import json
import sys

def setup_system():
    """Setup admin user and sample offers"""
    
    base_url = "http://localhost:5000"
    
    print("🚀 Quick Setup for Ascend Admin Dashboard")
    print("=" * 50)
    
    # Step 1: Create admin user via registration
    print("\n🔐 Step 1: Creating admin user...")
    
    admin_data = {
        "username": "admin",
        "email": "admin@ascend.com",
        "password": "admin123"
    }
    
    try:
        register_response = requests.post(f"{base_url}/api/auth/register", json=admin_data)
        
        if register_response.status_code == 201:
            print("✅ Admin user created successfully!")
        elif register_response.status_code == 400 and "already exists" in register_response.text:
            print("✅ Admin user already exists!")
        else:
            print(f"⚠️ Registration response: {register_response.status_code} - {register_response.text}")
    except Exception as e:
        print(f"⚠️ Could not create admin user: {str(e)}")
    
    # Step 2: Login as admin
    print("\n🔑 Step 2: Logging in as admin...")
    
    login_data = {
        "username": "admin",
        "password": "admin123"
    }
    
    try:
        login_response = requests.post(f"{base_url}/api/auth/login", json=login_data)
        
        if login_response.status_code == 200:
            login_result = login_response.json()
            token = login_result['token']
            print(f"✅ Login successful! User: {login_result['user']['username']}")
            print(f"   Role: {login_result['user'].get('role', 'user')}")
        else:
            print(f"❌ Login failed: {login_response.text}")
            return False
    except Exception as e:
        print(f"❌ Login error: {str(e)}")
        return False
    
    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    }
    
    # Step 3: Create sample offers
    print("\n📝 Step 3: Creating sample offers...")
    
    sample_offers = [
        {
            "campaign_id": "SAMPLE-001",
            "name": "Premium Gaming Offer",
            "description": "High-converting gaming offer with excellent payouts",
            "status": "active",
            "countries": ["US", "CA", "UK", "AU"],
            "payout": 15.00,
            "network": "GameNetwork",
            "short_description": "Gaming offer with premium rewards",
            "affiliates": "all",
            "image_url": "https://via.placeholder.com/400x300/4F46E5/FFFFFF?text=Gaming+Offer",
            "thumbnail_url": "https://via.placeholder.com/150x150/4F46E5/FFFFFF?text=Game",
            "target_url": "https://example.com/gaming-offer",
            "preview_url": "https://example.com/gaming-preview",
            "hash_code": "GAME123",
            "limit": 1000,
            "expiration_date": "2024-12-31",
            "device_targeting": "all"
        },
        {
            "campaign_id": "SAMPLE-002",
            "name": "Finance Lead Generation",
            "description": "High-quality finance leads with excellent conversion rates",
            "status": "active",
            "countries": ["US", "CA"],
            "payout": 25.00,
            "network": "FinanceLeads",
            "short_description": "Premium finance lead generation",
            "affiliates": "premium",
            "image_url": "https://via.placeholder.com/400x300/10B981/FFFFFF?text=Finance+Leads",
            "thumbnail_url": "https://via.placeholder.com/150x150/10B981/FFFFFF?text=Finance",
            "target_url": "https://example.com/finance-leads",
            "preview_url": "https://example.com/finance-preview",
            "hash_code": "FIN456",
            "limit": 500,
            "expiration_date": "2024-12-31",
            "device_targeting": "desktop"
        },
        {
            "campaign_id": "SAMPLE-003",
            "name": "Mobile App Install Campaign",
            "description": "Mobile app installation campaign with high retention rates",
            "status": "pending",
            "countries": ["US", "CA", "UK", "AU", "DE", "FR"],
            "payout": 8.50,
            "network": "MobileApps",
            "short_description": "Mobile app installs with retention tracking",
            "affiliates": "all",
            "image_url": "https://via.placeholder.com/400x300/F59E0B/FFFFFF?text=Mobile+Apps",
            "thumbnail_url": "https://via.placeholder.com/150x150/F59E0B/FFFFFF?text=App",
            "target_url": "https://example.com/mobile-app",
            "preview_url": "https://example.com/app-preview",
            "hash_code": "APP789",
            "limit": 2000,
            "expiration_date": "2024-12-31",
            "device_targeting": "mobile"
        }
    ]
    
    created_offers = []
    
    for i, offer_data in enumerate(sample_offers, 1):
        try:
            offer_response = requests.post(f"{base_url}/api/admin/offers", 
                                          json=offer_data, headers=headers)
            
            if offer_response.status_code == 201:
                offer_result = offer_response.json()
                offer_id = offer_result['offer']['offer_id']
                created_offers.append(offer_id)
                print(f"✅ Created offer {i}: {offer_id} - {offer_data['name']}")
            else:
                print(f"⚠️ Failed to create offer {i}: {offer_response.text}")
        except Exception as e:
            print(f"⚠️ Error creating offer {i}: {str(e)}")
    
    # Step 4: Verify offers can be retrieved
    print(f"\n📋 Step 4: Verifying offers...")
    
    try:
        offers_response = requests.get(f"{base_url}/api/admin/offers", headers=headers)
        
        if offers_response.status_code == 200:
            offers_result = offers_response.json()
            total_offers = len(offers_result.get('offers', []))
            print(f"✅ Successfully retrieved {total_offers} offers from API")
            
            # Show offer details
            for offer in offers_result.get('offers', [])[:3]:  # Show first 3
                print(f"   - {offer['offer_id']}: {offer['name']} (${offer['payout']})")
        else:
            print(f"❌ Failed to retrieve offers: {offers_response.text}")
            return False
    except Exception as e:
        print(f"❌ Error retrieving offers: {str(e)}")
        return False
    
    # Step 5: Test health endpoint
    print(f"\n🏥 Step 5: Testing system health...")
    
    try:
        health_response = requests.get(f"{base_url}/health")
        
        if health_response.status_code == 200:
            health_result = health_response.json()
            print(f"✅ System health check passed!")
            print(f"   Status: {health_result.get('status', 'unknown')}")
            print(f"   Database: {health_result.get('database', 'unknown')}")
        else:
            print(f"⚠️ Health check failed: {health_response.text}")
    except Exception as e:
        print(f"⚠️ Health check error: {str(e)}")
    
    print(f"\n🎉 SETUP COMPLETE!")
    print("=" * 50)
    print(f"✅ Admin user ready: admin / admin123")
    print(f"✅ Sample offers created: {len(created_offers)}")
    print(f"✅ Backend running: http://localhost:5000")
    print(f"✅ Frontend access: http://localhost:8080")
    print(f"\n🚀 You can now test the complete system!")
    
    return True

if __name__ == "__main__":
    try:
        success = setup_system()
        if success:
            print(f"\n✅ Setup completed successfully!")
            sys.exit(0)
        else:
            print(f"\n❌ Setup encountered some issues!")
            sys.exit(1)
    except Exception as e:
        print(f"\n💥 Setup error: {str(e)}")
        sys.exit(1)
