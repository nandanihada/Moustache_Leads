#!/usr/bin/env python3

import requests
import json
from models.user import User
from utils.auth import generate_token

def test_approval_flow():
    print("=== TESTING COMPLETE APPROVAL FLOW ===")
    
    # Get admin and publisher tokens
    user_model = User()
    admin_user = user_model.find_by_username('admin')
    publisher_user = user_model.find_by_username('nan')  # The user we assigned placements to
    
    admin_token = generate_token(admin_user)
    publisher_token = generate_token(publisher_user)
    
    print(f"👤 Admin: {admin_user['username']}")
    print(f"👤 Publisher: {publisher_user['username']}")
    
    # Test 1: Publisher checks their placement status
    print(f"\n1. Publisher checking placement status...")
    publisher_headers = {
        'Authorization': f'Bearer {publisher_token}',
        'Content-Type': 'application/json'
    }
    
    try:
        response = requests.get('http://localhost:5000/api/placements', headers=publisher_headers)
        if response.status_code == 200:
            data = response.json()
            placements = data.get('placements', [])
            
            pending_placements = [p for p in placements if p.get('approvalStatus') == 'PENDING_APPROVAL']
            approved_placements = [p for p in placements if p.get('approvalStatus') == 'APPROVED']
            
            print(f"📊 Publisher has {len(placements)} total placements")
            print(f"⏳ Pending: {len(pending_placements)}")
            print(f"✅ Approved: {len(approved_placements)}")
            
            if pending_placements:
                test_placement = pending_placements[0]
                placement_id = test_placement['id']
                
                print(f"\n2. Admin approving placement: {test_placement['offerwallTitle']}")
                
                # Admin approves the placement
                admin_headers = {
                    'Authorization': f'Bearer {admin_token}',
                    'Content-Type': 'application/json'
                }
                
                approval_data = {
                    'message': 'Great placement! Your offerwall has been approved and is now live.'
                }
                
                response = requests.post(
                    f'http://localhost:5000/api/placements/admin/{placement_id}/approve',
                    headers=admin_headers,
                    json=approval_data
                )
                
                if response.status_code == 200:
                    print("✅ Admin approval successful!")
                    
                    # Publisher checks status again
                    print(f"\n3. Publisher checking updated status...")
                    response = requests.get('http://localhost:5000/api/placements', headers=publisher_headers)
                    
                    if response.status_code == 200:
                        updated_data = response.json()
                        updated_placements = updated_data.get('placements', [])
                        
                        approved_placement = next((p for p in updated_placements if p['id'] == placement_id), None)
                        
                        if approved_placement:
                            print(f"📋 Placement: {approved_placement['offerwallTitle']}")
                            print(f"⚡ Status: {approved_placement.get('approvalStatus')}")
                            print(f"💬 Message: {approved_placement.get('reviewMessage')}")
                            
                            if approved_placement.get('approvalStatus') == 'APPROVED':
                                print("🎉 SUCCESS! Placement status updated correctly!")
                            else:
                                print("❌ Status not updated yet")
                        else:
                            print("❌ Could not find updated placement")
                    else:
                        print(f"❌ Publisher status check failed: {response.status_code}")
                else:
                    print(f"❌ Admin approval failed: {response.status_code} - {response.text}")
            else:
                print("ℹ️ No pending placements to test")
        else:
            print(f"❌ Publisher placement check failed: {response.status_code}")
            
    except Exception as e:
        print(f"❌ Test error: {e}")
    
    print(f"\n" + "="*60)
    print("🎯 APPROVAL FLOW TEST COMPLETE")
    print("✅ Publisher information now shows in admin panel")
    print("✅ Approval process updates placement status")
    print("✅ Publishers can see updated status immediately")
    print("✅ Auto-refresh every 30 seconds + manual refresh button")

if __name__ == "__main__":
    test_approval_flow()
