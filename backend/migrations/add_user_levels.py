"""
Migration: Add level field to users
Adds L1-L6 level classification to user documents
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import db_instance
import random

def add_user_levels():
    """Add level field to all users"""
    users_collection = db_instance.get_collection('users')
    
    if users_collection is None:
        print("Database connection failed")
        return
    
    # Get all users without level field
    users = list(users_collection.find({'level': {'$exists': False}}))
    
    if not users:
        print("All users already have level field")
        return
    
    print(f"Found {len(users)} users without level field")
    
    # Assign random levels for now (L1-L7)
    levels = ['L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7']
    updated_count = 0
    
    for user in users:
        # Assign a random level (you can customize this logic)
        level = random.choice(levels)
        
        result = users_collection.update_one(
            {'_id': user['_id']},
            {'$set': {'level': level}}
        )
        
        if result.modified_count > 0:
            updated_count += 1
            print(f"Updated user {user.get('username', 'unknown')} -> {level}")
    
    print(f"\nMigration complete: {updated_count} users updated with level field")

if __name__ == '__main__':
    print("Starting user levels migration...")
    add_user_levels()
