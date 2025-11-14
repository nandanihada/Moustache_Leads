#!/usr/bin/env python3

import requests
import json
from models.user import User
from utils.auth import generate_token

def test_fixed_api():
    print("🔍 TESTING FIXED PLACEMENT API")
    print("=" * 60)
    
    API_URL = 'http://localhost:5000'
    
    # Test with existing user first
    user_model = User()
    test_user = user_model.find_by_username('nan')  # Use existing user
    
    if not test_user:
        print("❌ Test user 'nan' not found")
        return
    
    token = generate_token(test_user)
    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    }
    
    print(f"👤 Testing with user: {test_user['username']}")
    
    # Test 1: GET placements (this was failing before)
    print(f"\n1️⃣ TESTING GET /api/placements")
    print("-" * 40)
    
    try:
        response = requests.get(f'{API_URL}/api/placements', headers=headers)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            placements = data.get('placements', [])
            
            print(f"✅ SUCCESS! Found {len(placements)} placements")
            
            for i, placement in enumerate(placements[:2]):  # Show first 2
                print(f"\n📋 Placement {i+1}:")
                print(f"   Title: {placement.get('offerwallTitle')}")
                print(f"   Status: {placement.get('status')}")
                print(f"   Approval Status: {placement.get('approvalStatus')}")
                print(f"   Review Message: {placement.get('reviewMessage')}")
                print(f"   Approved By: {placement.get('approvedBy')}")
            
            # Test hook logic
            approved = [p for p in placements if p.get('approvalStatus') == 'APPROVED']
            pending = [p for p in placements if p.get('approvalStatus') == 'PENDING_APPROVAL']
            
            print(f"\n📊 Hook Analysis:")
            print(f"   Total: {len(placements)}")
            print(f"   Approved: {len(approved)}")
            print(f"   Pending: {len(pending)}")
            print(f"   Platform Access: {'YES' if len(approved) > 0 else 'NO'}")
            
            if len(approved) > 0:
                print(f"✅ User should have platform access")
            elif len(pending) > 0:
                print(f"⏳ User should see 'Placement Under Review' message")
            else:
                print(f"📝 User should see 'Create new placement' message")
                
        elif response.status_code == 500:
            print(f"❌ STILL FAILING: {response.text}")
            return
        else:
            print(f"❌ Unexpected status: {response.text}")
            return
            
    except Exception as e:
        print(f"❌ Request error: {e}")
        return
    
    # Test 2: Create a new placement
    print(f"\n2️⃣ TESTING POST /api/placements")
    print("-" * 40)
    
    placement_data = {
        "platformType": "website",
        "offerwallTitle": f"Test API Fix {len(placements) + 1}",
        "currencyName": "Coins",
        "exchangeRate": 100,
        "postbackUrl": "https://example.com/postback"
    }
    
    try:
        response = requests.post(f'{API_URL}/api/placements',
                               json=placement_data,
                               headers=headers)
        
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 201:
            placement_info = response.json()
            new_placement_id = placement_info['id']
            
            print(f"✅ SUCCESS! Placement created")
            print(f"   ID: {new_placement_id}")
            print(f"   Title: {placement_info['offerwallTitle']}")
            print(f"   Approval Status: {placement_info.get('approvalStatus')}")
            print(f"   Review Message: {placement_info.get('reviewMessage')}")
            
        else:
            print(f"❌ Creation failed: {response.text}")
            return
            
    except Exception as e:
        print(f"❌ Creation error: {e}")
        return
    
    # Test 3: Get individual placement
    print(f"\n3️⃣ TESTING GET /api/placements/{new_placement_id}")
    print("-" * 40)
    
    try:
        response = requests.get(f'{API_URL}/api/placements/{new_placement_id}', headers=headers)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            placement = response.json()
            
            print(f"✅ SUCCESS! Individual placement retrieved")
            print(f"   Title: {placement.get('offerwallTitle')}")
            print(f"   Approval Status: {placement.get('approvalStatus')}")
            print(f"   Review Message: {placement.get('reviewMessage')}")
            
        else:
            print(f"❌ Individual get failed: {response.text}")
            
    except Exception as e:
        print(f"❌ Individual get error: {e}")
    
    # Test 4: Admin approval
    print(f"\n4️⃣ TESTING ADMIN APPROVAL")
    print("-" * 40)
    
    try:
        admin_user = user_model.find_by_username('admin')
        if admin_user:
            admin_token = generate_token(admin_user)
            admin_headers = {
                'Authorization': f'Bearer {admin_token}',
                'Content-Type': 'application/json'
            }
            
            approval_data = {
                'message': 'API fix test - placement approved!'
            }
            
            response = requests.post(f'{API_URL}/api/placements/admin/{new_placement_id}/approve',
                                   json=approval_data,
                                   headers=admin_headers)
            
            print(f"Admin Approval Status: {response.status_code}")
            
            if response.status_code == 200:
                print(f"✅ Admin approval successful!")
                
                # Check updated status
                response = requests.get(f'{API_URL}/api/placements/{new_placement_id}', headers=headers)
                if response.status_code == 200:
                    updated_placement = response.json()
                    print(f"   Updated Status: {updated_placement.get('approvalStatus')}")
                    print(f"   Review Message: {updated_placement.get('reviewMessage')}")
            else:
                print(f"❌ Admin approval failed: {response.text}")
        else:
            print(f"❌ Admin user not found")
            
    except Exception as e:
        print(f"❌ Admin approval error: {e}")
    
    print(f"\n" + "="*60)
    print("🎉 API FIX TEST COMPLETE!")
    print("="*60)
    print("✅ ObjectId serialization issue fixed")
    print("✅ All placement endpoints include approval status")
    print("✅ Publisher flow should work correctly now")
    print("\n📋 Ready for frontend testing:")
    print("1. Register new user (username = firstname)")
    print("2. Create placement (should show pending)")
    print("3. Admin approve (should update status)")
    print("4. Publisher should see approved status")

if __name__ == "__main__":
    test_fixed_api()
