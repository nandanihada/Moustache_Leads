"""
Reset a user's password in the database.
Usage: python migrations/reset_user_password.py <email> <new_password>
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import bcrypt
from database import db_instance

def reset_password(email, new_password):
    db = db_instance.get_db()
    if db is None:
        print("ERROR: Database not connected")
        return
    
    # Try users collection (publishers/admin)
    users_col = db.users
    user = users_col.find_one({'email': email})
    
    if user:
        hashed = bcrypt.hashpw(new_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        users_col.update_one(
            {'email': email},
            {'$set': {'password': hashed}}
        )
        print(f"✅ Password reset for user: {email} (role: {user.get('role', 'user')}, username: {user.get('username', '')})")
        return
    
    # Try advertisers collection
    advertisers_col = db.advertisers
    advertiser = advertisers_col.find_one({'email': email})
    
    if advertiser:
        hashed = bcrypt.hashpw(new_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        advertisers_col.update_one(
            {'email': email},
            {'$set': {'password': hashed}}
        )
        print(f"✅ Password reset for advertiser: {email} (company: {advertiser.get('company_name', '')})")
        return
    
    print(f"❌ No user or advertiser found with email: {email}")

if __name__ == '__main__':
    if len(sys.argv) != 3:
        print("Usage: python migrations/reset_user_password.py <email> <new_password>")
        sys.exit(1)
    
    email = sys.argv[1]
    new_password = sys.argv[2]
    
    print(f"Resetting password for: {email}")
    reset_password(email, new_password)
