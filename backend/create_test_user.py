"""
Create a test publisher user for testing reports
"""

import requests
import json

BASE_URL = "http://localhost:5000"

def create_test_user():
    """Create a test publisher account"""
    print("👤 Creating test publisher account...")
    
    user_data = {
        "email": "publisher@test.com",
        "password": "Test1234!",
        "username": "testpublisher",
        "first_name": "Test",
        "last_name": "Publisher",
        "role": "publisher"
    }
    
    response = requests.post(
        f"{BASE_URL}/api/auth/register",
        json=user_data
    )
    
    if response.status_code in [200, 201]:
        print("✅ Test user created successfully!")
        print(f"\n👤 Username: {user_data['username']}")
        print(f"📧 Email: {user_data['email']}")
        print(f"🔑 Password: {user_data['password']}")
        print(f"\n💡 Now run: python get_token.py")
        print(f"   Use USERNAME (not email) to log in: {user_data['username']}")
        return True
    else:
        print(f"⚠️ Status: {response.status_code}")
        print(f"Response: {response.text}")
        
        # User might already exist
        if "already exists" in response.text.lower() or response.status_code == 409:
            print(f"\n💡 User already exists! Use these credentials:")
            print(f"   Username: {user_data['username']}")
            print(f"   Email: {user_data['email']}")
            print(f"   Password: {user_data['password']}")
            return True
        
        return False

if __name__ == '__main__':
    print("\n🚀 TEST USER CREATOR")
    print("="*70)
    create_test_user()
