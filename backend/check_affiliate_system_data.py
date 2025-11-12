"""
Check data in affiliate_system database
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv()

client = MongoClient(os.getenv('MONGO_URI', 'mongodb://localhost:27017/'))
db = client['affiliate_system']

print("📊 affiliate_system Database Status:")
print("=" * 50)

# Check collections
collections = db.list_collection_names()
print(f"Collections: {collections}")

# Check each collection
for collection_name in ['clicks', 'conversions', 'offers']:
    if collection_name in collections:
        count = db[collection_name].count_documents({})
        print(f"\n{collection_name.upper()}: {count} documents")
        
        if count > 0:
            # Get date range
            if collection_name == 'clicks':
                docs = list(db[collection_name].find({}, {'click_time': 1}).sort('click_time', 1))
                if docs:
                    print(f"  Date range: {docs[0]['click_time']} to {docs[-1]['click_time']}")
                    
                    # Check flags
                    sample = db[collection_name].find_one()
                    print(f"  Sample flags: is_unique={sample.get('is_unique')}, is_suspicious={sample.get('is_suspicious')}")
                    
            elif collection_name == 'conversions':
                docs = list(db[collection_name].find({}, {'conversion_time': 1}).sort('conversion_time', 1))
                if docs:
                    print(f"  Date range: {docs[0]['conversion_time']} to {docs[-1]['conversion_time']}")
                    
            elif collection_name == 'offers':
                sample = db[collection_name].find_one()
                print(f"  Sample offer: {sample.get('offer_id')} - {sample.get('name')}")
    else:
        print(f"\n{collection_name.upper()}: Collection not found")

print("\n" + "=" * 50)
