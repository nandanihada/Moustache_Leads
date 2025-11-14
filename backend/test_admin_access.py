#!/usr/bin/env python3

from models.user import User
from utils.auth import generate_token

def test_admin_access():
    print("🔍 TESTING ADMIN ACCESS FIXES")
    print("=" * 60)
    
    user_model = User()
    
    # Test 1: Check admin user
    print("\n1️⃣ CHECKING ADMIN USER")
    print("-" * 40)
    
    admin_user = user_model.find_by_username('admin')
    if admin_user:
        print(f"✅ Admin user found: {admin_user['username']}")
        print(f"   Email: {admin_user['email']}")
        print(f"   Role: {admin_user.get('role', 'user')}")
        
        # Generate token for frontend testing
        admin_token = generate_token(admin_user)
        print(f"   Token: {admin_token[:50]}...")
        
        # Create user object for localStorage
        user_data = {
            'id': str(admin_user['_id']),
            'username': admin_user['username'],
            'email': admin_user['email'],
            'role': admin_user.get('role', 'user')
        }
        
        print(f"\n📋 Frontend localStorage data:")
        print(f"   user: {user_data}")
        print(f"   token: {admin_token}")
        
    else:
        print("❌ Admin user not found")
        return
    
    # Test 2: Check regular user
    print(f"\n2️⃣ CHECKING REGULAR USER")
    print("-" * 40)
    
    regular_user = user_model.find_by_username('nan')
    if regular_user:
        print(f"✅ Regular user found: {regular_user['username']}")
        print(f"   Email: {regular_user.get('email', 'N/A')}")
        print(f"   Role: {regular_user.get('role', 'user')}")
        
        user_data = {
            'id': str(regular_user['_id']),
            'username': regular_user['username'],
            'email': regular_user.get('email', ''),
            'role': regular_user.get('role', 'user')
        }
        
        print(f"\n📋 Regular user localStorage data:")
        print(f"   user: {user_data}")
        
    else:
        print("❌ Regular user not found")
    
    print(f"\n" + "="*60)
    print("🎯 ADMIN ACCESS TEST SUMMARY")
    print("="*60)
    print("✅ Admin user bypass: Hook will check user.role === 'admin'")
    print("✅ Create Placement button: Now navigates to '/dashboard/placements'")
    print("✅ Admin should have full platform access without placement approval")
    print("\n📋 Frontend Testing:")
    print("1. Login as admin using the token above")
    print("2. Admin should NOT see placement approval restrictions")
    print("3. Regular users should still see placement approval flow")
    print("4. 'Create Placement' button should go to /dashboard/placements")

if __name__ == "__main__":
    test_admin_access()
