import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

from database import db_instance

def main():
    db_instance.is_connected()
    col = db_instance.get_collection('email_verifications')
    
    email = "micequha@forexzig.com"
    for v in col.find({'email': email}):
        print("Verification Token document:")
        print(f"Token: {v.get('token')}")
        print(f"User ID: {v.get('user_id')}")
        print(f"Created At: {v.get('created_at')}")
        print(f"Expires At: {v.get('expires_at')}")
        print(f"Verified: {v.get('verified')}")
        print(f"Verified At: {v.get('verified_at')}")
        print("-" * 40)

if __name__ == "__main__":
    main()
