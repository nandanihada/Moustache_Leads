"""
Quick script to log in and get JWT token
"""

import requests
import json

BASE_URL = "http://localhost:5000"

def get_token(username, password):
    """Log in and get JWT token"""
    print("🔐 Logging in...")
    
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={
            "username": username,
            "password": password
        }
    )
    
    if response.status_code == 200:
        data = response.json()
        token = data.get('token') or data.get('access_token')
        
        print("✅ Login successful!")
        print(f"\n📋 Your JWT Token:")
        print("="*70)
        print(token)
        print("="*70)
        print(f"\n💡 Copy this token and paste it in test_user_reports.py")
        print(f"   Replace: TOKEN = \"YOUR_JWT_TOKEN_HERE\"")
        print(f"   With: TOKEN = \"{token}\"")
        
        # Also save to file for convenience
        with open('jwt_token.txt', 'w') as f:
            f.write(token)
        print(f"\n✅ Token also saved to jwt_token.txt")
        
        return token
    else:
        print(f"❌ Login failed: {response.status_code}")
        print(f"Response: {response.text}")
        return None

if __name__ == '__main__':
    print("\n🚀 JWT TOKEN GETTER")
    print("="*70)
    
    # Prompt for credentials
    print("\nEnter your login credentials:")
    username = input("Username: ").strip()
    password = input("Password: ").strip()
    
    if username and password:
        get_token(username, password)
    else:
        print("❌ Username and password are required!")
