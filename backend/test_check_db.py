#!/usr/bin/env python
"""
Check what's actually in the database
"""
from database import db_instance

print("=" * 100)
print("🔍 CHECKING DATABASE COLLECTIONS")
print("=" * 100)

# Check comprehensive clicks
print("\n1️⃣  CHECKING COMPREHENSIVE CLICKS COLLECTION...")
try:
    clicks_col = db_instance.get_collection('offerwall_clicks_detailed')
    total = clicks_col.count_documents({})
    print(f"✅ Total documents: {total}")
    
    # Get all documents
    all_docs = list(clicks_col.find().sort('timestamp', -1).limit(10))
    print(f"✅ Retrieved {len(all_docs)} documents")
    
    for i, doc in enumerate(all_docs, 1):
        print(f"\n   Doc {i}:")
        print(f"   - click_id: {doc.get('click_id')}")
        print(f"   - user_id: {doc.get('user_id')}")
        print(f"   - placement_id: {doc.get('placement_id')}")
        print(f"   - timestamp: {doc.get('timestamp')}")
        
except Exception as e:
    print(f"❌ Error: {e}")

# Check regular clicks
print("\n2️⃣  CHECKING REGULAR CLICKS COLLECTION...")
try:
    clicks_col = db_instance.get_collection('offerwall_clicks')
    total = clicks_col.count_documents({})
    print(f"✅ Total documents: {total}")
    
    # Get all documents
    all_docs = list(clicks_col.find().sort('timestamp', -1).limit(10))
    print(f"✅ Retrieved {len(all_docs)} documents")
    
    for i, doc in enumerate(all_docs, 1):
        print(f"\n   Doc {i}:")
        print(f"   - click_id: {doc.get('click_id')}")
        print(f"   - user_id: {doc.get('user_id')}")
        print(f"   - placement_id: {doc.get('placement_id')}")
        print(f"   - timestamp: {doc.get('timestamp')}")
        
except Exception as e:
    print(f"❌ Error: {e}")

print("\n" + "=" * 100)
print("✅ CHECK COMPLETE")
print("=" * 100)
