#!/usr/bin/env python3
"""
Clear test/old data from database
"""

import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from database import db_instance

def clear_test_data():
    """Clear test data"""
    
    print("\n🗑️  CLEARING TEST DATA")
    print("="*70)
    
    clicks_collection = db_instance.get_collection('clicks')
    conversions_collection = db_instance.get_collection('conversions')
    
    if clicks_collection is None or conversions_collection is None:
        print("❌ Database connection failed")
        return
    
    # Count before
    clicks_before = clicks_collection.count_documents({})
    conversions_before = conversions_collection.count_documents({})
    
    print(f"\n📊 BEFORE:")
    print(f"  Clicks: {clicks_before}")
    print(f"  Conversions: {conversions_before}")
    
    # Ask for confirmation
    print("\n⚠️  WARNING: This will delete ALL clicks and conversions!")
    print("   (Offers will NOT be deleted)")
    
    response = input("\nType 'yes' to confirm deletion: ")
    
    if response.lower() != 'yes':
        print("\n❌ Cancelled")
        return
    
    # Delete all clicks and conversions
    clicks_result = clicks_collection.delete_many({})
    conversions_result = conversions_collection.delete_many({})
    
    print(f"\n✅ DELETED:")
    print(f"  Clicks: {clicks_result.deleted_count}")
    print(f"  Conversions: {conversions_result.deleted_count}")
    
    # Count after
    clicks_after = clicks_collection.count_documents({})
    conversions_after = conversions_collection.count_documents({})
    
    print(f"\n📊 AFTER:")
    print(f"  Clicks: {clicks_after}")
    print(f"  Conversions: {conversions_after}")
    
    print("\n" + "="*70)
    print("✅ Database cleared!")
    print("\n📍 NEXT STEPS:")
    print("   1. Offers are still available")
    print("   2. Users can now click on offers to generate REAL tracking data")
    print("   3. Reports will show actual user activity")

if __name__ == '__main__':
    clear_test_data()
