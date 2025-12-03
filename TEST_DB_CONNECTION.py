#!/usr/bin/env python3
"""
Test database connection from backend
"""

import sys
sys.path.insert(0, 'd:\\pepeleads\\ascend\\lovable-ascend\\backend')

from database import db_instance
from config import Config

print("=" * 80)
print("🔍 DATABASE CONNECTION TEST")
print("=" * 80)

print(f"\n📋 Configuration:")
print(f"  MONGODB_URI: {Config.MONGODB_URI}")
print(f"  DATABASE_NAME: {Config.DATABASE_NAME}")

print(f"\n🔗 Connection Status:")
print(f"  Is connected: {db_instance.is_connected()}")

db = db_instance.get_db()
print(f"  DB object: {db}")
print(f"  DB name: {db.name if db is not None else 'None'}")

if db is not None:
    print(f"\n📊 Collections in database:")
    collections = db.list_collection_names()
    for col in collections:
        count = db[col].count_documents({})
        print(f"  - {col}: {count} documents")
    
    print(f"\n✅ Testing insert into offerwall_clicks:")
    test_doc = {
        'test': 'document',
        'user_id': 'test_user',
        'offer_id': 'TEST-001'
    }
    
    clicks_col = db['offerwall_clicks']
    result = clicks_col.insert_one(test_doc)
    print(f"  Inserted ID: {result.inserted_id}")
    
    # Verify
    found = clicks_col.find_one({'_id': result.inserted_id})
    print(f"  Found after insert: {found is not None}")
    
    # Clean up
    clicks_col.delete_one({'_id': result.inserted_id})
    print(f"  Cleaned up test document")
else:
    print(f"\n❌ Database connection failed!")

print("\n" + "=" * 80)
print("✅ TEST COMPLETE")
print("=" * 80)
