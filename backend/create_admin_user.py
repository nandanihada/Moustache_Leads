#!/usr/bin/env python3
"""
Create admin user for testing
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from models.user import User
from werkzeug.security import generate_password_hash
import logging

def create_admin_user():
    """Create admin user if it doesn't exist"""
    
    print("🔐 Creating admin user...")
    
    user_model = User()
    
    # Check if admin user already exists
    existing_admin = user_model.get_user_by_username('admin')
    if existing_admin:
        print("✅ Admin user already exists!")
        print(f"   Username: {existing_admin['username']}")
        print(f"   Email: {existing_admin['email']}")
        print(f"   Role: {existing_admin['role']}")
        return True
    
    # Create admin user
    admin_data = {
        'username': 'admin',
        'email': 'admin@ascend.com',
        'password': 'admin123',
        'role': 'admin'
    }
    
    try:
        user, error = user_model.create_user(admin_data)
        
        if error:
            print(f"❌ Failed to create admin user: {error}")
            return False
        
        print("✅ Admin user created successfully!")
        print(f"   Username: admin")
        print(f"   Password: admin123")
        print(f"   Email: admin@ascend.com")
        print(f"   Role: admin")
        
        return True
        
    except Exception as e:
        print(f"❌ Error creating admin user: {str(e)}")
        return False

if __name__ == "__main__":
    success = create_admin_user()
    if success:
        print("\n🎉 Admin user is ready for login!")
        print("   Frontend: http://localhost:8080")
        print("   Login: admin / admin123")
    else:
        print("\n❌ Failed to create admin user!")
        sys.exit(1)
