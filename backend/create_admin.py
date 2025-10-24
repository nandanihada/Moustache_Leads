#!/usr/bin/env python3
"""
Script to create an admin user for testing the Admin Dashboard
"""

import requests
import json

def create_admin_user():
    """Create an admin user via the API"""
    
    # Admin user details
    admin_data = {
        "username": "admin",
        "email": "admin@moustacheleads.com", 
        "password": "admin123"
    }
    
    # API endpoint
    url = "http://localhost:5000/api/auth/create-admin"
    
    # Headers with admin key
    headers = {
        "Content-Type": "application/json",
        "X-Admin-Key": "dev-admin-key-123"
    }
    
    try:
        print("Creating admin user...")
        response = requests.post(url, json=admin_data, headers=headers)
        
        if response.status_code == 201:
            result = response.json()
            print("✅ Admin user created successfully!")
            print(f"Username: {result['user']['username']}")
            print(f"Email: {result['user']['email']}")
            print(f"Role: {result['user']['role']}")
            print("\nYou can now login with:")
            print(f"Username: {admin_data['username']}")
            print(f"Password: {admin_data['password']}")
            
        elif response.status_code == 400:
            error = response.json()
            if "already exists" in error.get('error', ''):
                print("ℹ️  Admin user already exists!")
                print("You can login with:")
                print(f"Username: {admin_data['username']}")
                print(f"Password: {admin_data['password']}")
            else:
                print(f"❌ Error: {error.get('error', 'Unknown error')}")
        else:
            print(f"❌ Failed to create admin user. Status: {response.status_code}")
            print(f"Response: {response.text}")
            
    except requests.exceptions.ConnectionError:
        print("❌ Could not connect to the backend server.")
        print("Make sure the Flask server is running on http://localhost:5000")
    except Exception as e:
        print(f"❌ Error: {str(e)}")

if __name__ == "__main__":
    create_admin_user()
