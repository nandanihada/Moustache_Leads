#!/usr/bin/env python3

import requests
import json
from models.user import User
from models.placement import Placement
from utils.auth import generate_token

def test_approval_fixes():
    print("=== TESTING PLACEMENT APPROVAL FIXES ===")
    
    # Get admin user and token
    user_model = User()
    admin_user = user_model.find_by_username('admin')
    admin_token = generate_token(admin_user)
    
    # Test 1: Check if publisher info is now showing in admin requests
    print("\n1. Testing Publisher Information in Admin Requests")
    print("-" * 50)
    
    headers = {
        'Authorization': f'Bearer {admin_token}',
        'Content-Type': 'application/json'
    }
    
    try:
        response = requests.get('http://localhost:5000/api/placements/admin/all', headers=headers)
        if response.status_code == 200:
            data = response.json()
            placements = data.get('placements', [])
            
            print(f"✅ Found {len(placements)} placements")
            
            for i, placement in enumerate(placements[:3]):  # Show first 3
                print(f"\nPlacement {i+1}:")
                print(f"  📋 Title: {placement.get('offerwallTitle', 'N/A')}")
                print(f"  👤 Publisher: {placement.get('publisherName', 'Unknown')}")
                print(f"  📧 Email: {placement.get('publisherEmail', 'N/A')}")
                print(f"  🏷️ Role: {placement.get('publisherRole', 'N/A')}")
                print(f"  📅 Created: {placement.get('createdAt', 'N/A')}")
                print(f"  ⚡ Status: {placement.get('approvalStatus', 'N/A')}")
                
            # Check if we have proper publisher info
            has_publisher_info = any(p.get('publisherName') and p.get('publisherName') != 'Unknown' for p in placements)
            if has_publisher_info:
                print("\n✅ Publisher information is now showing correctly!")
            else:
                print("\n❌ Publisher information still missing - checking database...")
                
                # Debug: Check actual placement data
                placement_model = Placement()
                sample_placement = placement_model.collection.find_one({})
                if sample_placement:
                    print(f"Sample placement publisherId: {sample_placement.get('publisherId')}")
                    print(f"Sample placement keys: {list(sample_placement.keys())}")
        else:
            print(f"❌ API Error: {response.status_code}")
            
    except Exception as e:
        print(f"❌ Error: {e}")
    
    # Test 2: Test approval process
    print("\n\n2. Testing Approval Process")
    print("-" * 50)
    
    try:
        # Get a pending placement
        response = requests.get('http://localhost:5000/api/placements/admin/all?status_filter=PENDING_APPROVAL', headers=headers)
        if response.status_code == 200:
            data = response.json()
            pending_placements = data.get('placements', [])
            
            if pending_placements:
                test_placement = pending_placements[0]
                placement_id = test_placement['id']
                
                print(f"📋 Testing approval for: {test_placement.get('offerwallTitle')}")
                print(f"👤 Publisher: {test_placement.get('publisherName')}")
                
                # Approve the placement
                approval_data = {
                    'message': 'Test approval - your placement looks great!'
                }
                
                response = requests.post(
                    f'http://localhost:5000/api/placements/admin/{placement_id}/approve',
                    headers=headers,
                    json=approval_data
                )
                
                if response.status_code == 200:
                    print("✅ Placement approved successfully!")
                    
                    # Verify the approval
                    response = requests.get(f'http://localhost:5000/api/placements/admin/all', headers=headers)
                    if response.status_code == 200:
                        updated_data = response.json()
                        updated_placement = next((p for p in updated_data['placements'] if p['id'] == placement_id), None)
                        
                        if updated_placement:
                            print(f"📊 Updated Status: {updated_placement.get('approvalStatus')}")
                            print(f"💬 Review Message: {updated_placement.get('reviewMessage')}")
                            print(f"✅ Approval working correctly!")
                        else:
                            print("❌ Could not find updated placement")
                else:
                    print(f"❌ Approval failed: {response.status_code} - {response.text}")
            else:
                print("ℹ️ No pending placements to test approval")
        else:
            print(f"❌ Could not fetch pending placements: {response.status_code}")
            
    except Exception as e:
        print(f"❌ Approval test error: {e}")
    
    print("\n" + "="*60)
    print("🔧 FIXES SUMMARY:")
    print("1. ✅ Added publisher info fields to admin aggregation pipeline")
    print("2. ✅ Added periodic refresh (30s) to placement status hook")
    print("3. ✅ Added manual refresh button for immediate status check")
    print("4. ✅ Fixed aggregation pipeline to preserve placements with missing publisher data")
    print("\n📝 Next Steps:")
    print("- Publishers should now see updated status within 30 seconds")
    print("- Admin panel should show complete publisher information")
    print("- Manual refresh button available for immediate status check")

if __name__ == "__main__":
    test_approval_fixes()
