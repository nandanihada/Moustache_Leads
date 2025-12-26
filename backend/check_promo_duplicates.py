"""
Quick check for duplicate promo code applications
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import db_instance
from bson import ObjectId

# Connect to database
user_promo_collection = db_instance.get_collection('user_promo_codes')

# Find duplicates
pipeline = [
    {
        '$match': {
            'is_active': True
        }
    },
    {
        '$group': {
            '_id': {
                'user_id': '$user_id',
                'promo_code_id': '$promo_code_id'
            },
            'count': {'$sum': 1},
            'docs': {'$push': '$$ROOT'}
        }
    },
    {
        '$match': {
            'count': {'$gt': 1}
        }
    }
]

duplicates = list(user_promo_collection.aggregate(pipeline))

print(f"\n{'='*60}")
print(f"DUPLICATE PROMO CODE APPLICATIONS FOUND: {len(duplicates)}")
print(f"{'='*60}\n")

if duplicates:
    for i, dup_group in enumerate(duplicates, 1):
        docs = dup_group['docs']
        print(f"\n{i}. User ID: {dup_group['_id']['user_id']}")
        print(f"   Promo Code ID: {dup_group['_id']['promo_code_id']}")
        print(f"   Duplicate Count: {dup_group['count']}")
        print(f"   Entries:")
        for j, doc in enumerate(docs, 1):
            print(f"      {j}. Code: {doc.get('code')}, Applied: {doc.get('applied_at')}, ID: {doc['_id']}")
        
        # Ask to remove duplicates
        print(f"\n   Keeping first entry, removing {len(docs)-1} duplicates...")
        for doc in docs[1:]:
            result = user_promo_collection.delete_one({'_id': doc['_id']})
            if result.deleted_count > 0:
                print(f"      ✅ Deleted: {doc.get('code')} (ID: {doc['_id']})")
            else:
                print(f"      ❌ Failed to delete: {doc['_id']}")

    print(f"\n{'='*60}")
    print(f"✅ CLEANUP COMPLETE - Removed {sum(len(d['docs'])-1 for d in duplicates)} duplicates")
    print(f"{'='*60}\n")
else:
    print("✅ No duplicates found!\n")

# Now create the unique index
print("Creating unique index to prevent future duplicates...")
try:
    # Drop existing index if any
    try:
        user_promo_collection.drop_index('unique_user_promo_code_active')
        print("   Dropped old index")
    except:
        pass
    
    # Create new unique index
    result = user_promo_collection.create_index(
        [
            ('user_id', 1),
            ('promo_code_id', 1)
        ],
        unique=True,
        partialFilterExpression={'is_active': True},
        name='unique_user_promo_code_active'
    )
    print(f"   ✅ Created unique index: {result}")
except Exception as e:
    print(f"   ❌ Error: {e}")

print("\n✅ All done!\n")
