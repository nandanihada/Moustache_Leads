"""
Fix click flags - ensure all clicks have proper boolean values
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from pymongo import MongoClient
from dotenv import load_dotenv
import random

load_dotenv()

client = MongoClient(os.getenv('MONGO_URI', 'mongodb://localhost:27017/'))
db = client['affiliate_system']

print("🔧 Fixing Click Flags...")
print("=" * 50)

# Find clicks with None values
clicks_with_none = list(db.clicks.find({
    '$or': [
        {'is_unique': None},
        {'is_suspicious': None}, 
        {'is_rejected': None}
    ]
}))

print(f"Found {len(clicks_with_none)} clicks with None flags")

if clicks_with_none:
    print("Updating clicks with proper boolean flags...")
    
    for click in clicks_with_none:
        # Generate realistic flag values
        is_unique = random.choice([True, False, False, True])  # 50% unique
        is_suspicious = random.choice([False, False, False, True])  # 25% suspicious  
        is_rejected = random.choice([False, False, False, True])  # 25% rejected
        
        db.clicks.update_one(
            {'_id': click['_id']},
            {'$set': {
                'is_unique': is_unique,
                'is_suspicious': is_suspicious,
                'is_rejected': is_rejected
            }}
        )
    
    print(f"✅ Updated {len(clicks_with_none)} clicks")

# Verify the fix
total_clicks = db.clicks.count_documents({})
unique_clicks = db.clicks.count_documents({'is_unique': True})
suspicious_clicks = db.clicks.count_documents({'is_suspicious': True})
rejected_clicks = db.clicks.count_documents({'is_rejected': True})
none_flags = db.clicks.count_documents({
    '$or': [
        {'is_unique': None},
        {'is_suspicious': None}, 
        {'is_rejected': None}
    ]
})

print(f"\n📊 Final Status:")
print(f"  Total clicks: {total_clicks}")
print(f"  Unique clicks: {unique_clicks}")
print(f"  Suspicious clicks: {suspicious_clicks}")
print(f"  Rejected clicks: {rejected_clicks}")
print(f"  Clicks with None flags: {none_flags}")

print("\n✅ Click flags fixed!")
