#!/usr/bin/env python3

from database import db_instance
import bcrypt

def check_users():
    """Check what users exist in the database"""
    
    try:
        users_collection = db_instance.get_collection('users')
        
        if users_collection is None:
            print("❌ Could not connect to users collection")
            return
        
        # Count total users
        total_users = users_collection.count_documents({})
        print(f"👥 Total users in database: {total_users}")
        
        # Show sample users (without passwords for security)
        users = list(users_collection.find({}, {'password': 0}).limit(5))
        
        print(f"\n📋 Sample users:")
        for i, user in enumerate(users, 1):
            print(f"   {i}. Username: {user.get('username', 'N/A')}")
            print(f"      Email: {user.get('email', 'N/A')}")
            print(f"      Account Type: {user.get('account_type', 'N/A')}")
            print(f"      Active: {user.get('is_active', 'N/A')}")
            print()
        
        # Let's also create a simple test user with known password
        print("🔧 Creating a simple test user...")
        
        # Check if testuser2 exists
        existing_user = users_collection.find_one({'username': 'testuser2'})
        if existing_user:
            print("   testuser2 already exists")
        else:
            # Create testuser2
            password = 'password123'
            hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())
            
            new_user = {
                'username': 'testuser2',
                'email': 'testuser2@example.com',
                'password': hashed_password,
                'firstName': 'Test',
                'lastName': 'User2',
                'account_type': 'publisher',
                'is_active': True,
                'created_at': '2025-11-17T14:00:00Z'
            }
            
            result = users_collection.insert_one(new_user)
            print(f"   ✅ Created testuser2 with password: {password}")
            print(f"   User ID: {result.inserted_id}")
        
    except Exception as e:
        print(f"❌ Error checking users: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    check_users()
