#!/usr/bin/env python3
"""
Simple fix for offers not showing
"""

import requests
import json

def simple_fix():
    """Simple fix using API calls"""
    
    base_url = "http://localhost:5000"
    
    print("🔧 Simple Fix for Offers Issue")
    print("=" * 40)
    
    # Step 1: Register admin user
    print("\n1. Ensuring admin user exists...")
    
    admin_data = {
        "username": "admin",
        "email": "admin@ascend.com",
        "password": "admin123"
    }
    
    try:
        register_response = requests.post(f"{base_url}/api/auth/register", json=admin_data, timeout=5)
        
        if register_response.status_code == 201:
            print("   ✅ Admin user created!")
        elif register_response.status_code == 400:
            print("   ✅ Admin user already exists!")
        else:
            print(f"   ⚠️ Register response: {register_response.status_code}")
    except Exception as e:
        print(f"   ⚠️ Register error: {str(e)}")
    
    # Step 2: Login and get token
    print("\n2. Logging in as admin...")
    
    login_data = {
        "username": "admin",
        "password": "admin123"
    }
    
    try:
        login_response = requests.post(f"{base_url}/api/auth/login", json=login_data, timeout=5)
        
        if login_response.status_code != 200:
            print(f"   ❌ Login failed: {login_response.text}")
            return False
        
        login_result = login_response.json()
        token = login_result['token']
        user_role = login_result['user'].get('role', 'user')
        
        print(f"   ✅ Login successful! Role: {user_role}")
        
        if user_role != 'admin':
            print("   ⚠️ User doesn't have admin role!")
            
    except Exception as e:
        print(f"   ❌ Login error: {str(e)}")
        return False
    
    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    }
    
    # Step 3: Check existing offers
    print("\n3. Checking existing offers...")
    
    try:
        offers_response = requests.get(f"{base_url}/api/admin/offers", headers=headers, timeout=5)
        
        if offers_response.status_code != 200:
            print(f"   ❌ Offers API failed: {offers_response.text}")
            return False
        
        offers_result = offers_response.json()
        existing_offers = offers_result.get('offers', [])
        
        print(f"   📊 Found {len(existing_offers)} existing offers")
        
        if len(existing_offers) == 0:
            print("\n4. Creating sample offers...")
            
            sample_offers = [
                {
                    "campaign_id": "DEMO-001",
                    "name": "Gaming Offer - Premium",
                    "description": "High-converting gaming offer with excellent payouts and premium targeting",
                    "status": "active",
                    "countries": ["US", "CA", "UK", "AU"],
                    "payout": 15.00,
                    "network": "GameNetwork Pro",
                    "short_description": "Premium gaming offer with high conversion rates",
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
                    "campaign_id": "DEMO-002",
                    "name": "Finance Leads - High Quality",
                    "description": "Premium finance lead generation with excellent conversion rates and quality targeting",
                    "status": "active",
                    "countries": ["US", "CA"],
                    "payout": 25.00,
                    "network": "FinanceLeads Premium",
                    "short_description": "High-quality finance leads with premium targeting",
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
                    "campaign_id": "DEMO-003",
                    "name": "Mobile App Installs",
                    "description": "Mobile app installation campaign with high retention rates and quality users",
                    "status": "active",
                    "countries": ["US", "CA", "UK", "AU", "DE"],
                    "payout": 8.50,
                    "network": "MobileApps Network",
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
            
            created_count = 0
            for i, offer_data in enumerate(sample_offers, 1):
                try:
                    create_response = requests.post(f"{base_url}/api/admin/offers", 
                                                   json=offer_data, headers=headers, timeout=10)
                    
                    if create_response.status_code == 201:
                        create_result = create_response.json()
                        offer_id = create_result['offer']['offer_id']
                        created_count += 1
                        print(f"   ✅ Created offer {i}: {offer_id} - {offer_data['name']}")
                    else:
                        print(f"   ⚠️ Failed to create offer {i}: {create_response.text}")
                        
                except Exception as e:
                    print(f"   ⚠️ Error creating offer {i}: {str(e)}")
            
            print(f"\n   📊 Successfully created {created_count} sample offers")
            
        else:
            print("   ✅ Offers already exist:")
            for offer in existing_offers[:3]:
                print(f"   - {offer['offer_id']}: {offer['name']} (${offer['payout']})")
    
    except Exception as e:
        print(f"   ❌ Offers check error: {str(e)}")
        return False
    
    # Step 4: Final verification
    print("\n5. Final verification...")
    
    try:
        final_check = requests.get(f"{base_url}/api/admin/offers", headers=headers, timeout=5)
        
        if final_check.status_code == 200:
            final_result = final_check.json()
            final_count = len(final_result.get('offers', []))
            print(f"   ✅ Final count: {final_count} offers available")
            
            if final_count > 0:
                print("\n🎉 SUCCESS!")
                print("=" * 40)
                print("✅ Admin user ready")
                print(f"✅ {final_count} offers available")
                print("✅ API working correctly")
                print("\n🔄 Please refresh your browser page!")
                print("   URL: http://localhost:8080")
                print("   Login: admin / admin123")
                print("   Go to: Admin → Offers")
                return True
            else:
                print("   ❌ No offers found after creation")
                return False
        else:
            print(f"   ❌ Final check failed: {final_check.text}")
            return False
            
    except Exception as e:
        print(f"   ❌ Final verification error: {str(e)}")
        return False

if __name__ == "__main__":
    try:
        success = simple_fix()
        if not success:
            print("\n❌ Fix failed - please check backend logs")
    except Exception as e:
        print(f"\n💥 Fix error: {str(e)}")
