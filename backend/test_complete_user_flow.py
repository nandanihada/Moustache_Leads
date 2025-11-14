#!/usr/bin/env python3

import requests
import json
from models.user import User
from models.placement import Placement
from utils.auth import generate_token

def test_complete_user_flow():
    print("🎯 TESTING COMPLETE USER FLOW")
    print("=" * 60)
    
    API_URL = 'http://localhost:5000'
    
    # Step 1: Register a new user
    print("\n1️⃣ REGISTERING NEW USER")
    print("-" * 40)
    
    test_user_data = {
        "username": "testuser",
        "email": "testuser@example.com",
        "password": "password123",
        "first_name": "Test",
        "last_name": "User",
        "company_name": "Test Company",
        "role": "partner"
    }
    
    try:
        response = requests.post(f'{API_URL}/api/auth/register', 
                               json=test_user_data,
                               headers={'Content-Type': 'application/json'})
        
        if response.status_code == 200:
            reg_data = response.json()
            user_token = reg_data['token']
            user_info = reg_data['user']
            
            print(f"✅ User registered successfully!")
            print(f"   Username: {user_info['username']}")
            print(f"   Email: {user_info['email']}")
            print(f"   Role: {user_info['role']}")
            print(f"   Token: {user_token[:50]}...")
            
        else:
            print(f"❌ Registration failed: {response.status_code}")
            print(f"   Response: {response.text}")
            
            # Try to login with existing user instead
            print("\n🔄 Trying to login with existing user...")
            login_response = requests.post(f'{API_URL}/api/auth/login',
                                         json={"username": "testuser", "password": "password123"},
                                         headers={'Content-Type': 'application/json'})
            
            if login_response.status_code == 200:
                login_data = login_response.json()
                user_token = login_data['token']
                user_info = login_data['user']
                print(f"✅ Logged in successfully!")
            else:
                print(f"❌ Login also failed: {login_response.status_code}")
                return
                
    except Exception as e:
        print(f"❌ Registration error: {e}")
        return
    
    # Step 2: Check initial placement status
    print(f"\n2️⃣ CHECKING INITIAL PLACEMENT STATUS")
    print("-" * 40)
    
    headers = {
        'Authorization': f'Bearer {user_token}',
        'Content-Type': 'application/json'
    }
    
    try:
        response = requests.get(f'{API_URL}/api/placements', headers=headers)
        
        if response.status_code == 200:
            data = response.json()
            placements = data.get('placements', [])
            
            print(f"✅ Initial placements: {len(placements)}")
            
            if len(placements) == 0:
                print("✅ CORRECT: New user has no placements")
            else:
                print("⚠️ Unexpected: New user already has placements")
                for p in placements:
                    print(f"   - {p.get('offerwallTitle')} (Status: {p.get('approvalStatus')})")
        else:
            print(f"❌ Placement check failed: {response.status_code}")
            
    except Exception as e:
        print(f"❌ Placement check error: {e}")
    
    # Step 3: Create a new placement
    print(f"\n3️⃣ CREATING NEW PLACEMENT")
    print("-" * 40)
    
    placement_data = {
        "platformType": "website",
        "offerwallTitle": "Test Offerwall",
        "currencyName": "Coins",
        "exchangeRate": 100,
        "postbackUrl": "https://example.com/postback"
    }
    
    try:
        response = requests.post(f'{API_URL}/api/placements',
                               json=placement_data,
                               headers=headers)
        
        if response.status_code == 201:
            placement_info = response.json()
            placement_id = placement_info['id']
            
            print(f"✅ Placement created successfully!")
            print(f"   ID: {placement_id}")
            print(f"   Title: {placement_info['offerwallTitle']}")
            print(f"   Identifier: {placement_info['placementIdentifier']}")
            
        else:
            print(f"❌ Placement creation failed: {response.status_code}")
            print(f"   Response: {response.text}")
            return
            
    except Exception as e:
        print(f"❌ Placement creation error: {e}")
        return
    
    # Step 4: Check placement status after creation
    print(f"\n4️⃣ CHECKING PLACEMENT STATUS AFTER CREATION")
    print("-" * 40)
    
    try:
        response = requests.get(f'{API_URL}/api/placements', headers=headers)
        
        if response.status_code == 200:
            data = response.json()
            placements = data.get('placements', [])
            
            print(f"✅ Found {len(placements)} placements")
            
            for p in placements:
                print(f"\n📋 Placement: {p.get('offerwallTitle')}")
                print(f"   Status: {p.get('status')}")
                print(f"   Approval Status: {p.get('approvalStatus')}")
                print(f"   Review Message: {p.get('reviewMessage')}")
            
            # Check what the hook would see
            approved = [p for p in placements if p.get('approvalStatus') == 'APPROVED']
            pending = [p for p in placements if p.get('approvalStatus') == 'PENDING_APPROVAL']
            
            print(f"\n📊 Hook Analysis:")
            print(f"   Approved: {len(approved)}")
            print(f"   Pending: {len(pending)}")
            print(f"   Can Access Platform: {'YES' if len(approved) > 0 else 'NO'}")
            
            if len(pending) > 0 and len(approved) == 0:
                print(f"✅ CORRECT: Should show 'Placement Under Review' message")
            elif len(approved) > 0:
                print(f"✅ CORRECT: Should have platform access")
            else:
                print(f"❌ ISSUE: Will show 'Create new placement' message")
                
        else:
            print(f"❌ Status check failed: {response.status_code}")
            
    except Exception as e:
        print(f"❌ Status check error: {e}")
    
    # Step 5: Admin approval (simulate)
    print(f"\n5️⃣ ADMIN APPROVAL SIMULATION")
    print("-" * 40)
    
    try:
        # Get admin token
        user_model = User()
        admin_user = user_model.find_by_username('admin')
        
        if admin_user:
            admin_token = generate_token(admin_user)
            admin_headers = {
                'Authorization': f'Bearer {admin_token}',
                'Content-Type': 'application/json'
            }
            
            # Approve the placement
            approval_data = {
                'message': 'Your placement has been approved! Welcome to the platform.'
            }
            
            response = requests.post(f'{API_URL}/api/placements/admin/{placement_id}/approve',
                                   json=approval_data,
                                   headers=admin_headers)
            
            if response.status_code == 200:
                print(f"✅ Admin approval successful!")
            else:
                print(f"❌ Admin approval failed: {response.status_code}")
                print(f"   Response: {response.text}")
        else:
            print(f"❌ Admin user not found")
            
    except Exception as e:
        print(f"❌ Admin approval error: {e}")
    
    # Step 6: Check final status
    print(f"\n6️⃣ CHECKING FINAL STATUS AFTER APPROVAL")
    print("-" * 40)
    
    try:
        response = requests.get(f'{API_URL}/api/placements', headers=headers)
        
        if response.status_code == 200:
            data = response.json()
            placements = data.get('placements', [])
            
            print(f"✅ Found {len(placements)} placements")
            
            for p in placements:
                print(f"\n📋 Placement: {p.get('offerwallTitle')}")
                print(f"   Status: {p.get('status')}")
                print(f"   Approval Status: {p.get('approvalStatus')}")
                print(f"   Review Message: {p.get('reviewMessage')}")
            
            # Final hook analysis
            approved = [p for p in placements if p.get('approvalStatus') == 'APPROVED']
            pending = [p for p in placements if p.get('approvalStatus') == 'PENDING_APPROVAL']
            
            print(f"\n📊 Final Hook Analysis:")
            print(f"   Approved: {len(approved)}")
            print(f"   Pending: {len(pending)}")
            print(f"   Can Access Platform: {'YES' if len(approved) > 0 else 'NO'}")
            
            if len(approved) > 0:
                print(f"🎉 SUCCESS: User should now have full platform access!")
            else:
                print(f"❌ ISSUE: User still doesn't have platform access")
                
        else:
            print(f"❌ Final status check failed: {response.status_code}")
            
    except Exception as e:
        print(f"❌ Final status check error: {e}")
    
    print(f"\n" + "="*60)
    print("🎯 COMPLETE USER FLOW TEST FINISHED")
    print("="*60)

if __name__ == "__main__":
    test_complete_user_flow()
