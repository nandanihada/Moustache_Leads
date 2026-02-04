"""
Migration script to fix is_active field for all offers.
Sets is_active=True for all offers with status='active'.
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from database import db_instance

def fix_is_active():
    """Set is_active=True for all offers with status='active'"""
    offers = db_instance.get_collection('offers')
    
    if offers is None:
        print("Failed to connect to database")
        return
    
    # Count before
    print("Before update:")
    print(f"  is_active=True: {offers.count_documents({'is_active': True})}")
    print(f"  is_active=False: {offers.count_documents({'is_active': False})}")
    print(f"  status=active: {offers.count_documents({'status': 'active'})}")
    
    # Update all offers with status='active' to have is_active=True
    result = offers.update_many(
        {'status': 'active'},
        {'$set': {'is_active': True}}
    )
    
    print(f"\nUpdated {result.modified_count} offers to is_active=True")
    
    # Count after
    print("\nAfter update:")
    print(f"  is_active=True: {offers.count_documents({'is_active': True})}")
    print(f"  is_active=False: {offers.count_documents({'is_active': False})}")

if __name__ == '__main__':
    fix_is_active()
