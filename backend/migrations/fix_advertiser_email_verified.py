"""
Migration: Set email_verified=True for all existing advertisers
who registered before the email verification requirement was added.

Run: python migrations/fix_advertiser_email_verified.py
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import db_instance
from datetime import datetime

def run():
    db = db_instance.get_db()
    if db is None:
        print("ERROR: Database not connected")
        return
    
    advertisers_col = db.advertisers
    
    # Find advertisers without email_verified or with email_verified=False
    unverified = advertisers_col.count_documents({
        '$or': [
            {'email_verified': {'$exists': False}},
            {'email_verified': False}
        ]
    })
    
    print(f"Found {unverified} advertisers without email_verified=True")
    
    if unverified > 0:
        result = advertisers_col.update_many(
            {'$or': [
                {'email_verified': {'$exists': False}},
                {'email_verified': False}
            ]},
            {'$set': {
                'email_verified': True,
                'email_verified_at': datetime.utcnow(),
                'email_verified_by_migration': True
            }}
        )
        print(f"Updated {result.modified_count} advertisers — email_verified set to True")
    else:
        print("All advertisers already have email_verified=True")

if __name__ == '__main__':
    run()
