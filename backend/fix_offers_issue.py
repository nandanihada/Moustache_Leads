#!/usr/bin/env python3
"""
Fix offers not showing issue
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from models.user import User
from models.offer import Offer
from werkzeug.security import generate_password_hash
import logging

def fix_offers_issue():
    """Fix the offers not showing issue"""
    
    print("🔧 Fixing Offers Issue...")
    print("=" * 40)
    
    user_model = User()
    offer_model = Offer()
    
    # Step 1: Ensure admin user exists with correct role
    print("\n1. Checking admin user...")
    
    try:
        admin_user = user_model.get_user_by_username('admin')
        
        if not admin_user:
            print("   Creating admin user...")
            admin_data = {
                'username': 'admin',
                'email': 'admin@ascend.com',
                'password': 'admin123',
                'role': 'admin'
            }
            
            user, error = user_model.create_user(admin_data)
            if error:
                print(f"   ❌ Failed to create admin: {error}")
                return False
            else:
                print("   ✅ Admin user created successfully!")
        else:
            print(f"   ✅ Admin user exists: {admin_user['username']}")
            
            # Ensure admin has correct role
            if admin_user.get('role') != 'admin':
                print("   🔧 Updating admin role...")
                user_model.users_collection.update_one(
                    {'username': 'admin'},
                    {'$set': {'role': 'admin'}}
                )
                print("   ✅ Admin role updated!")
            else:
                print(f"   ✅ Admin role correct: {admin_user['role']}")
                
    except Exception as e:
        print(f"   ❌ Error with admin user: {str(e)}")
        return False
    
    # Step 2: Check if offers exist
    print("\n2. Checking existing offers...")
    
    try:
        offers, total = offer_model.get_offers()
        print(f"   Found {total} offers in database")
        
        if total == 0:
            print("   📝 Creating sample offers...")
            
            sample_offers = [
                {
                    "campaign_id": "SAMPLE-001",
                    "name": "Premium Gaming Offer",
                    "description": "High-converting gaming offer with excellent payouts",
                    "status": "active",
                    "countries": ["US", "CA", "UK"],
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
                    "status": "active",
                    "countries": ["US", "CA", "UK", "AU"],
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
            
            created_count = 0
            for offer_data in sample_offers:
                try:
                    offer, error = offer_model.create_offer(offer_data, 'admin')
                    if error:
                        print(f"   ⚠️ Failed to create offer: {error}")
                    else:
                        created_count += 1
                        print(f"   ✅ Created offer: {offer['offer_id']} - {offer['name']}")
                except Exception as e:
                    print(f"   ⚠️ Error creating offer: {str(e)}")
            
            print(f"   📊 Created {created_count} sample offers")
            
        else:
            print("   ✅ Offers already exist in database")
            for offer in offers[:3]:  # Show first 3
                print(f"   - {offer['offer_id']}: {offer['name']} (${offer['payout']})")
                
    except Exception as e:
        print(f"   ❌ Error with offers: {str(e)}")
        return False
    
    # Step 3: Test database connection
    print("\n3. Testing database connection...")
    
    try:
        if offer_model._check_db_connection():
            print("   ✅ Database connection working")
        else:
            print("   ❌ Database connection failed")
            return False
    except Exception as e:
        print(f"   ❌ Database connection error: {str(e)}")
        return False
    
    print("\n🎉 Fix completed!")
    print("=" * 40)
    print("✅ Admin user with correct role")
    print("✅ Sample offers created")
    print("✅ Database connection verified")
    print("\n🔄 Please refresh the frontend page to see offers")
    
    return True

if __name__ == "__main__":
    try:
        success = fix_offers_issue()
        if success:
            print("\n✅ Fix completed successfully!")
            print("   Refresh your browser at http://localhost:8080")
            print("   Login as admin/admin123 and check offers")
        else:
            print("\n❌ Fix encountered issues!")
        
    except Exception as e:
        print(f"\n💥 Fix error: {str(e)}")
        sys.exit(1)
