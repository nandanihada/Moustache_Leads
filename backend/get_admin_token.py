#!/usr/bin/env python3

from models.user import User
from utils.auth import generate_token

def get_admin_token():
    user_model = User()
    admin_user = user_model.find_by_username('admin')
    
    if not admin_user:
        print("❌ Admin user not found!")
        return
    
    admin_token = generate_token(admin_user)
    print("=== ADMIN LOGIN TOKEN ===")
    print(f"Username: {admin_user['username']}")
    print(f"Email: {admin_user['email']}")
    print(f"Role: {admin_user['role']}")
    print(f"Token: {admin_token}")
    print("\n=== COPY THIS TOKEN TO LOGIN AS ADMIN ===")
    print(admin_token)

if __name__ == "__main__":
    get_admin_token()
