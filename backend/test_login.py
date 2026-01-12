#!/usr/bin/env python3
"""Test login functionality"""

import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from models.user import User
from database import db_instance

def test_login():
    print("=" * 60)
    print("TESTING LOGIN FUNCTIONALITY")
    print("=" * 60)
    
    # Check database connection
    print("\n1. Checking database connection...")
    try:
        # Try to get a collection to test connection
        test_col = db_instance.get_collection('users')
        if test_col is None:
            print("   ❌ Database not connected!")
            return
        print("   ✅ Database connected")
    except Exception as e:
        print(f"   ❌ Database error: {e}")
        return
    
    # Check users collection
    print("\n2. Checking users collection...")
    user_model = User()
    if user_model.collection is None:
        print("   ❌ Users collection not available!")
        return
    print("   ✅ Users collection available")
    
    # Count users
    user_count = user_model.collection.count_documents({})
    print(f"   Total users: {user_count}")
    
    # List first 5 users
    print("\n3. Listing users:")
    users = list(user_model.collection.find({}, {'username': 1, 'email': 1, 'is_active': 1}).limit(5))
    if not users:
        print("   ⚠️ No users found in database!")
        print("   You may need to create an admin user first.")
    else:
        for user in users:
            status = "✅ Active" if user.get('is_active', True) else "❌ Inactive"
            print(f"   - {user.get('username')} ({user.get('email')}) - {status}")
    
    # Test password verification
    print("\n4. Testing password verification...")
    if users:
        test_username = users[0].get('username')
        print(f"   Testing with username: {test_username}")
        print("   Note: You need to know the correct password to test")
        
        # Try common test passwords
        test_passwords = ['admin123', 'password123', 'admin', 'test123']
        for pwd in test_passwords:
            result = user_model.verify_password(test_username, pwd)
            if result:
                print(f"   ✅ Password '{pwd}' works for {test_username}")
                break
        else:
            print(f"   ⚠️ None of the test passwords worked")
            print(f"   Common passwords tried: {', '.join(test_passwords)}")
    
    print("\n" + "=" * 60)
    print("TEST COMPLETE")
    print("=" * 60)

if __name__ == '__main__':
    test_login()
