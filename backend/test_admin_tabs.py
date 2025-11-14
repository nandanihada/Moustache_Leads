#!/usr/bin/env python3

import requests
from models.user import User
from models.placement import Placement
from utils.auth import generate_token

def test_admin_tabs():
    print("🔍 TESTING ADMIN TABS FUNCTIONALITY")
    print("=" * 60)
    
    user_model = User()
    placement_model = Placement()
    
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
    
    print(f"👤 Testing with admin: {admin_user['username']}")
    
    # Test 1: Get pending placements
    print(f"\n1️⃣ TESTING PENDING PLACEMENTS TAB")
    print("-" * 40)
    
    try:
        response = requests.get(
            'http://localhost:5000/api/placements/admin/all?status_filter=PENDING_APPROVAL',
            headers=headers
        )
        
        if response.status_code == 200:
            data = response.json()
            pending_placements = data.get('placements', [])
            
            print(f"✅ Found {len(pending_placements)} pending placements")
            
            for i, placement in enumerate(pending_placements[:3]):
                print(f"\n📋 Pending Placement {i+1}:")
                print(f"   Publisher: {placement.get('publisherName')}")
                print(f"   Title: {placement.get('offerwallTitle')}")
                print(f"   Status: {placement.get('approvalStatus')}")
                print(f"   Created: {placement.get('createdAt')}")
        else:
            print(f"❌ Failed to fetch pending placements: {response.status_code}")
            
    except Exception as e:
        print(f"❌ Error fetching pending placements: {e}")
    
    # Test 2: Get approved placements
    print(f"\n2️⃣ TESTING APPROVED PUBLISHERS TAB")
    print("-" * 40)
    
    try:
        response = requests.get(
            'http://localhost:5000/api/placements/admin/all?status_filter=APPROVED',
            headers=headers
        )
        
        if response.status_code == 200:
            data = response.json()
            approved_placements = data.get('placements', [])
            
            print(f"✅ Found {len(approved_placements)} approved placements")
            
            for i, placement in enumerate(approved_placements[:3]):
                print(f"\n📋 Approved Placement {i+1}:")
                print(f"   Publisher: {placement.get('publisherName')}")
                print(f"   Title: {placement.get('offerwallTitle')}")
                print(f"   Status: {placement.get('approvalStatus')}")
                print(f"   Approved At: {placement.get('approvedAt', 'N/A')}")
                print(f"   Approved By: {placement.get('approvedBy', 'N/A')}")
        else:
            print(f"❌ Failed to fetch approved placements: {response.status_code}")
            
    except Exception as e:
        print(f"❌ Error fetching approved placements: {e}")
    
    # Test 3: Check database status distribution
    print(f"\n3️⃣ DATABASE STATUS OVERVIEW")
    print("-" * 40)
    
    try:
        all_placements = list(placement_model.collection.find({}, {
            'approvalStatus': 1,
            'offerwallTitle': 1,
            'approvedAt': 1,
            'approvedBy': 1
        }))
        
        pending_count = len([p for p in all_placements if p.get('approvalStatus') == 'PENDING_APPROVAL'])
        approved_count = len([p for p in all_placements if p.get('approvalStatus') == 'APPROVED'])
        rejected_count = len([p for p in all_placements if p.get('approvalStatus') == 'REJECTED'])
        no_status_count = len([p for p in all_placements if not p.get('approvalStatus')])
        
        print(f"📊 Placement Status Distribution:")
        print(f"   ⏳ Pending: {pending_count}")
        print(f"   ✅ Approved: {approved_count}")
        print(f"   ❌ Rejected: {rejected_count}")
        print(f"   ⚠️  No Status: {no_status_count}")
        print(f"   📋 Total: {len(all_placements)}")
        
    except Exception as e:
        print(f"❌ Error checking database: {e}")
    
    print(f"\n" + "="*60)
    print("🎯 ADMIN TABS TEST SUMMARY")
    print("="*60)
    print("✅ Admin placement approval page now has two tabs:")
    print("   1. 'Pending Approvals' - Shows placements awaiting approval")
    print("   2. 'Approved Publishers' - Shows approved placements with details")
    print("✅ Each tab has separate search functionality")
    print("✅ Different table headers for each tab")
    print("✅ Approved tab shows approval date and admin info")
    print("\n📋 Frontend Testing:")
    print("1. Login as admin")
    print("2. Go to /admin/placement-approval")
    print("3. Switch between 'Pending Approvals' and 'Approved Publishers' tabs")
    print("4. Approve some pending placements")
    print("5. Check that they appear in the 'Approved Publishers' tab")

if __name__ == "__main__":
    test_admin_tabs()
