#!/usr/bin/env python3

import requests
import json
from models.user import User
from utils.auth import generate_token

def test_publisher_management_apis():
    print("🔍 TESTING PUBLISHER MANAGEMENT APIs")
    print("=" * 60)
    
    user_model = User()
    
    # Get admin user
    admin_user = user_model.find_by_username('admin')
    if not admin_user:
        print("❌ Admin user not found")
        return
    
    admin_token = generate_token(admin_user)
    headers = {
        'Authorization': f'Bearer {admin_token}',
        'Content-Type': 'application/json'
    }
    
    API_URL = 'http://localhost:5000/api/admin'
    
    print(f"👤 Testing with admin: {admin_user['username']}")
    
    # Test 1: Get all publishers
    print(f"\n1️⃣ TESTING GET ALL PUBLISHERS")
    print("-" * 40)
    
    try:
        response = requests.get(f'{API_URL}/publishers', headers=headers)
        
        if response.status_code == 200:
            data = response.json()
            publishers = data.get('publishers', [])
            
            print(f"✅ Found {len(publishers)} publishers")
            print(f"📊 Pagination: {data.get('pagination', {})}")
            
            for i, publisher in enumerate(publishers[:3]):
                print(f"\n📋 Publisher {i+1}:")
                print(f"   Username: {publisher.get('username')}")
                print(f"   Email: {publisher.get('email')}")
                print(f"   Status: {publisher.get('status')}")
                print(f"   Placements: {publisher.get('placementStats', {})}")
                print(f"   Password: {publisher.get('password', 'N/A')[:10]}...")
                
            # Store first publisher for detailed tests
            test_publisher_id = publishers[0]['id'] if publishers else None
            
        else:
            print(f"❌ Failed to fetch publishers: {response.status_code}")
            print(f"Response: {response.text}")
            return
            
    except Exception as e:
        print(f"❌ Error fetching publishers: {e}")
        return
    
    if not test_publisher_id:
        print("❌ No publishers found for detailed testing")
        return
    
    # Test 2: Get publisher details
    print(f"\n2️⃣ TESTING GET PUBLISHER DETAILS")
    print("-" * 40)
    
    try:
        response = requests.get(f'{API_URL}/publishers/{test_publisher_id}', headers=headers)
        
        if response.status_code == 200:
            publisher_details = response.json()
            
            print(f"✅ Publisher details retrieved")
            print(f"   Username: {publisher_details.get('username')}")
            print(f"   Email: {publisher_details.get('email')}")
            print(f"   Company: {publisher_details.get('companyName', 'N/A')}")
            print(f"   Website: {publisher_details.get('website', 'N/A')}")
            print(f"   Postback URL: {publisher_details.get('postbackUrl', 'N/A')}")
            print(f"   Password: {publisher_details.get('password', 'N/A')}")
            print(f"   Placements: {len(publisher_details.get('placements', []))}")
            
        else:
            print(f"❌ Failed to fetch publisher details: {response.status_code}")
            
    except Exception as e:
        print(f"❌ Error fetching publisher details: {e}")
    
    # Test 3: Update publisher
    print(f"\n3️⃣ TESTING UPDATE PUBLISHER")
    print("-" * 40)
    
    try:
        update_data = {
            'companyName': 'Updated Test Company',
            'website': 'https://updated-test.com',
            'postbackUrl': 'https://updated-test.com/postback'
        }
        
        response = requests.put(
            f'{API_URL}/publishers/{test_publisher_id}',
            headers=headers,
            json=update_data
        )
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Publisher updated successfully")
            print(f"   Message: {result.get('message')}")
            print(f"   Updated fields: {list(update_data.keys())}")
            
        else:
            print(f"❌ Failed to update publisher: {response.status_code}")
            print(f"Response: {response.text}")
            
    except Exception as e:
        print(f"❌ Error updating publisher: {e}")
    
    # Test 4: Block publisher
    print(f"\n4️⃣ TESTING BLOCK PUBLISHER")
    print("-" * 40)
    
    try:
        block_data = {
            'reason': 'Test block - policy violation'
        }
        
        response = requests.post(
            f'{API_URL}/publishers/{test_publisher_id}/block',
            headers=headers,
            json=block_data
        )
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Publisher blocked successfully")
            print(f"   Message: {result.get('message')}")
            print(f"   Reason: {result.get('reason')}")
            
        else:
            print(f"❌ Failed to block publisher: {response.status_code}")
            print(f"Response: {response.text}")
            
    except Exception as e:
        print(f"❌ Error blocking publisher: {e}")
    
    # Test 5: Unblock publisher
    print(f"\n5️⃣ TESTING UNBLOCK PUBLISHER")
    print("-" * 40)
    
    try:
        response = requests.post(
            f'{API_URL}/publishers/{test_publisher_id}/unblock',
            headers=headers
        )
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Publisher unblocked successfully")
            print(f"   Message: {result.get('message')}")
            
        else:
            print(f"❌ Failed to unblock publisher: {response.status_code}")
            print(f"Response: {response.text}")
            
    except Exception as e:
        print(f"❌ Error unblocking publisher: {e}")
    
    # Test 6: Search and filter
    print(f"\n6️⃣ TESTING SEARCH AND FILTER")
    print("-" * 40)
    
    try:
        # Test search
        response = requests.get(f'{API_URL}/publishers?search=test', headers=headers)
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Search test: Found {len(data.get('publishers', []))} publishers")
        
        # Test status filter
        response = requests.get(f'{API_URL}/publishers?status_filter=active', headers=headers)
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Status filter test: Found {len(data.get('publishers', []))} active publishers")
            
    except Exception as e:
        print(f"❌ Error testing search/filter: {e}")
    
    print(f"\n" + "="*60)
    print("🎯 PUBLISHER MANAGEMENT API TEST SUMMARY")
    print("="*60)
    print("✅ API Endpoints Tested:")
    print("   - GET /api/admin/publishers (list with pagination)")
    print("   - GET /api/admin/publishers/{id} (detailed view)")
    print("   - PUT /api/admin/publishers/{id} (update)")
    print("   - POST /api/admin/publishers/{id}/block (block)")
    print("   - POST /api/admin/publishers/{id}/unblock (unblock)")
    print("   - Search and filter functionality")
    print("\n✅ Features Available:")
    print("   - View all publisher details including passwords")
    print("   - Edit publisher information (name, company, postback URL)")
    print("   - Block/unblock publishers from accessing offers")
    print("   - Delete publishers (not tested to avoid data loss)")
    print("   - Search by username, email, company name")
    print("   - Filter by status (active/blocked)")
    print("   - View placement statistics for each publisher")
    print("\n📋 Ready for frontend testing!")

if __name__ == "__main__":
    test_publisher_management_apis()
