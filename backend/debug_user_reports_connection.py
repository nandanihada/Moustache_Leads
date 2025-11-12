"""
Debug UserReports database connection
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from models.user_reports import UserReports
from database import db_instance

print("🔍 Debugging UserReports Database Connection...")
print("=" * 60)

try:
    # Check database instance
    print(f"📊 DATABASE INSTANCE:")
    db = db_instance.get_db()
    print(f"  Database: {db.name if db is not None else 'None'}")
    print(f"  Connected: {db_instance.is_connected()}")
    
    # Check collections
    if db is not None:
        collections = db.list_collection_names()
        print(f"  Collections: {collections}")
        
        for collection_name in ['clicks', 'conversions', 'offers']:
            if collection_name in collections:
                count = db[collection_name].count_documents({})
                print(f"  {collection_name}: {count} documents")
    
    # Check UserReports instance
    print(f"\n🔍 USER REPORTS INSTANCE:")
    user_reports = UserReports()
    
    # Check collections directly
    clicks_collection = user_reports.clicks_collection
    conversions_collection = user_reports.conversions_collection
    
    print(f"  Clicks collection: {clicks_collection.name if clicks_collection else 'None'}")
    print(f"  Conversions collection: {conversions_collection.name if conversions_collection else 'None'}")
    
    if clicks_collection:
        clicks_count = clicks_collection.count_documents({})
        print(f"  Clicks count: {clicks_count}")
        
        if clicks_count > 0:
            sample_click = clicks_collection.find_one()
            print(f"  Sample click date: {sample_click.get('click_time')}")
            print(f"  Sample click user_id: {sample_click.get('user_id')}")
    
    if conversions_collection:
        conversions_count = conversions_collection.count_documents({})
        print(f"  Conversions count: {conversions_count}")
        
        if conversions_count > 0:
            sample_conversion = conversions_collection.find_one()
            print(f"  Sample conversion date: {sample_conversion.get('conversion_time')}")
            print(f"  Sample conversion user_id: {sample_conversion.get('user_id')}")
        
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()

print("\n" + "=" * 60)
print("🎯 CONNECTION DEBUG COMPLETE")
