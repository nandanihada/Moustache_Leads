"""
Migrate data from Mumbai cluster to Oregon cluster using PyMongo.
No need for mongodump/mongorestore — uses Python directly.

Usage:
    python migrations/migrate_to_oregon.py
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from pymongo import MongoClient

# === CONFIGURE THESE ===
OLD_URI = "mongodb+srv://shivam_db_user:N2GXWCIahXjPfHps@mlapril.ivsdtl2.mongodb.net/"
NEW_URI = os.environ.get('MONGODB_URI', '')  # Will read from .env

# If NEW_URI is empty, try to read from .env file
if not NEW_URI:
    env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env')
    if os.path.exists(env_path):
        with open(env_path, 'r') as f:
            for line in f:
                if line.startswith('MONGODB_URI='):
                    NEW_URI = line.strip().split('=', 1)[1].strip('"').strip("'")
                    break

if not NEW_URI:
    print("❌ NEW_URI not found. Set MONGODB_URI in .env or edit this script.")
    sys.exit(1)

if OLD_URI == NEW_URI:
    print("❌ OLD and NEW URIs are the same! Update NEW_URI to your Oregon cluster.")
    sys.exit(1)

DB_NAME = "ascend_db"

print(f"{'='*60}")
print(f"  MongoDB Migration: Mumbai → Oregon")
print(f"{'='*60}")
print(f"  Source: {OLD_URI[:50]}...")
print(f"  Target: {NEW_URI[:50]}...")
print(f"  Database: {DB_NAME}")
print(f"{'='*60}\n")

# Connect to both clusters
print("Connecting to source (Mumbai)...")
old_client = MongoClient(OLD_URI)
old_db = old_client[DB_NAME]

print("Connecting to target (Oregon)...")
new_client = MongoClient(NEW_URI)
new_db = new_client[DB_NAME]

# Get all collection names from source
collections = old_db.list_collection_names()
print(f"\nFound {len(collections)} collections to migrate:\n")

total_docs = 0
errors = []

for col_name in sorted(collections):
    try:
        old_col = old_db[col_name]
        new_col = new_db[col_name]
        
        count = old_col.estimated_document_count()
        
        if count == 0:
            print(f"  ⏭️  {col_name}: empty, skipping")
            continue
        
        # Check if target already has data
        existing = new_col.estimated_document_count()
        if existing > 0:
            print(f"  ⚠️  {col_name}: target already has {existing} docs, skipping (delete manually if you want to re-migrate)")
            continue
        
        print(f"  📦 {col_name}: migrating {count} documents...", end=" ", flush=True)
        
        # Batch insert in chunks of 1000
        batch_size = 1000
        inserted = 0
        
        cursor = old_col.find({})
        batch = []
        
        for doc in cursor:
            batch.append(doc)
            if len(batch) >= batch_size:
                new_col.insert_many(batch, ordered=False)
                inserted += len(batch)
                batch = []
        
        # Insert remaining
        if batch:
            new_col.insert_many(batch, ordered=False)
            inserted += len(batch)
        
        total_docs += inserted
        print(f"✅ {inserted} docs")
        
    except Exception as e:
        error_msg = f"{col_name}: {str(e)[:100]}"
        errors.append(error_msg)
        print(f"❌ Error: {str(e)[:80]}")

print(f"\n{'='*60}")
print(f"  MIGRATION COMPLETE")
print(f"{'='*60}")
print(f"  Total documents migrated: {total_docs}")
print(f"  Errors: {len(errors)}")
if errors:
    for e in errors:
        print(f"    ❌ {e}")
print(f"\n  Next steps:")
print(f"  1. Update Render MONGODB_URI to the new Oregon connection string")
print(f"  2. Run: python migrations/create_production_indexes.py")
print(f"  3. Test your site")

old_client.close()
new_client.close()
