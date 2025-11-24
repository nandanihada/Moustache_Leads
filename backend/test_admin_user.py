#!/usr/bin/env python3

from database import db_instance

# Check admin user
users_collection = db_instance.get_collection('users')
admin = users_collection.find_one({'username': 'admin'})

if admin:
    print("Admin user found:")
    print(f"  - username: {admin.get('username')}")
    print(f"  - role: {admin.get('role')}")
    print(f"  - account_type: {admin.get('account_type')}")
    print(f"  - is_admin: {admin.get('is_admin')}")
    print(f"  - All fields: {list(admin.keys())}")
else:
    print("Admin user not found")
