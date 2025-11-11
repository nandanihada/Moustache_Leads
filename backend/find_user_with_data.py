#!/usr/bin/env python3
"""
Find which username has the test data
"""

import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from database import db_instance
from bson import ObjectId

def find_user_with_data():
    """Find username that has data"""
    
    conversions_collection = db_instance.get_collection('conversions')
    users_collection = db_instance.get_collection('users')
    
    if conversions_collection is None or users_collection is None:
        print("❌ Could not connect to database")
        return
    
    # Get unique user IDs from conversions
    user_ids_in_data = conversions_collection.distinct('user_id')
    
    print("\n👤 USERS WITH TEST DATA:")
    print("="*70)
    
    for user_id in user_ids_in_data:
        try:
            # Convert to ObjectId if needed
            user = users_collection.find_one({'_id': ObjectId(user_id)})
            
            if user:
                conv_count = conversions_collection.count_documents({'user_id': user_id})
                print(f"\n✅ Username: {user.get('username', 'N/A')}")
                print(f"   User ID: {user_id}")
                print(f"   Email: {user.get('email', 'N/A')}")
                print(f"   Role: {user.get('role', 'N/A')}")
                print(f"   Conversions: {conv_count}")
        except Exception as e:
            print(f"⚠️  Could not find user for ID: {user_id}")
    
    print("\n" + "="*70)
    print("\n💡 SOLUTION:")
    print("   1. Run: python get_token.py")
    print("   2. Login with one of the usernames above")
    print("   3. Test again!")
    print("\n   OR")
    print("\n   1. Run: python create_test_data.py")
    print("   2. Use the 'admin' user ID when prompted:")
    print("      68e4e41a4ad662563fdb568a")

if __name__ == '__main__':
    find_user_with_data()
