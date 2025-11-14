#!/usr/bin/env python3

from models.user import User
from models.placement import Placement
from utils.auth import generate_token
import requests

def debug_publisher_flow():
    print("🔍 DEBUGGING PUBLISHER FLOW")
    print("=" * 60)
    
    user_model = User()
    placement_model = Placement()
    
    # Step 1: Check recent registrations
    print("\n1️⃣ CHECKING RECENT USERS")
    print("-" * 40)
    
    recent_users = list(user_model.collection.find(
        {'role': {'$in': ['user', 'partner', 'publisher']}},
        {'username': 1, 'email': 1, 'role': 1, 'first_name': 1, 'last_name': 1}
    ).sort('created_at', -1).limit(5))
    
    print(f"Found {len(recent_users)} recent users:")
    for user in recent_users:
        print(f"  👤 {user.get('username')} ({user.get('email')})")
        print(f"     Name: {user.get('first_name', 'N/A')} {user.get('last_name', 'N/A')}")
        print(f"     Role: {user.get('role', 'user')}")
        print(f"     ID: {user['_id']}")
        
        # Check if this user has placements
        user_placements = list(placement_model.collection.find({'publisherId': user['_id']}))
        print(f"     Placements: {len(user_placements)}")
        
        if user_placements:
            for p in user_placements:
                print(f"       - {p.get('offerwallTitle')} (Status: {p.get('approvalStatus', 'N/A')})")
        print()
    
    # Step 2: Test publisher API for a specific user
    if recent_users:
        test_user = recent_users[0]
        print(f"\n2️⃣ TESTING PUBLISHER API FOR: {test_user.get('username')}")
        print("-" * 40)
        
        # Generate token
        token = generate_token(test_user)
        print(f"✅ Generated token")
        
        # Test placements API
        headers = {
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json'
        }
        
        try:
            response = requests.get('http://localhost:5000/api/placements', headers=headers)
            print(f"API Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                placements = data.get('placements', [])
                
                print(f"✅ API returned {len(placements)} placements")
                
                for p in placements:
                    print(f"\n  📋 {p.get('offerwallTitle')}")
                    print(f"     Status: {p.get('status', 'N/A')}")
                    print(f"     Approval Status: {p.get('approvalStatus', 'N/A')}")
                    print(f"     Review Message: {p.get('reviewMessage', 'N/A')}")
                
                # Check what hook would see
                approved = [p for p in placements if p.get('approvalStatus') == 'APPROVED']
                pending = [p for p in placements if p.get('approvalStatus') == 'PENDING_APPROVAL']
                
                print(f"\n  📊 Hook Analysis:")
                print(f"     Approved: {len(approved)}")
                print(f"     Pending: {len(pending)}")
                print(f"     Can Access Platform: {'YES' if len(approved) > 0 else 'NO'}")
                
                if len(approved) == 0 and len(pending) == 0:
                    print(f"\n  ⚠️ ISSUE FOUND: No placements OR all placements missing approval status!")
                    print(f"     This will show 'Create new placement' message")
                elif len(pending) > 0 and len(approved) == 0:
                    print(f"\n  ⚠️ EXPECTED: Will show 'Placement Under Review' message")
                elif len(approved) > 0:
                    print(f"\n  ✅ EXPECTED: Should have platform access")
                    
            elif response.status_code == 500:
                print(f"❌ API Error 500 - Check server logs")
                print(f"Response: {response.text}")
            else:
                print(f"❌ API Error: {response.status_code}")
                print(f"Response: {response.text}")
                
        except Exception as e:
            print(f"❌ API Test Error: {e}")
    
    # Step 3: Check all placements and their status
    print(f"\n\n3️⃣ ALL PLACEMENTS OVERVIEW")
    print("-" * 40)
    
    all_placements = list(placement_model.collection.find({}, {
        'offerwallTitle': 1,
        'publisherId': 1,
        'approvalStatus': 1,
        'status': 1
    }))
    
    print(f"Total placements in database: {len(all_placements)}")
    
    status_counts = {
        'APPROVED': 0,
        'PENDING_APPROVAL': 0,
        'REJECTED': 0,
        'NO_STATUS': 0
    }
    
    for p in all_placements:
        status = p.get('approvalStatus')
        if status == 'APPROVED':
            status_counts['APPROVED'] += 1
        elif status == 'PENDING_APPROVAL':
            status_counts['PENDING_APPROVAL'] += 1
        elif status == 'REJECTED':
            status_counts['REJECTED'] += 1
        else:
            status_counts['NO_STATUS'] += 1
    
    print(f"\n📊 Approval Status Distribution:")
    print(f"  ✅ Approved: {status_counts['APPROVED']}")
    print(f"  ⏳ Pending: {status_counts['PENDING_APPROVAL']}")
    print(f"  ❌ Rejected: {status_counts['REJECTED']}")
    print(f"  ⚠️  No Status: {status_counts['NO_STATUS']}")
    
    if status_counts['NO_STATUS'] > 0:
        print(f"\n⚠️  WARNING: {status_counts['NO_STATUS']} placements have no approval status!")
        print(f"   These will be treated as PENDING by default")
        
        print(f"\n🔧 FIXING: Setting all placements without status to PENDING_APPROVAL...")
        result = placement_model.collection.update_many(
            {'approvalStatus': {'$exists': False}},
            {'$set': {'approvalStatus': 'PENDING_APPROVAL'}}
        )
        print(f"   ✅ Updated {result.modified_count} placements")
    
    print(f"\n" + "="*60)
    print("💡 RECOMMENDATIONS:")
    print("1. Restart Flask server to apply code changes")
    print("2. Clear browser cache and localStorage")
    print("3. Register a new test user")
    print("4. Create a placement")
    print("5. Login as admin and approve it")
    print("6. Logout and login as publisher to see updates")

if __name__ == "__main__":
    debug_publisher_flow()
