import sys
import os
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.append(current_dir)

from database import db_instance
from bson import ObjectId

def run():
    col = db_instance.get_collection('api_stats')
    # Find records where api_key_id is a string type
    bad_docs = list(col.find({"api_key_id": {"$type": "string"}}))
    print(f"Found {len(bad_docs)} documents to fix.")
    
    for doc in bad_docs:
        old_id = doc['api_key_id']
        col.update_one(
            {"_id": doc["_id"]},
            {"$set": {"api_key_id": ObjectId(old_id)}}
        )
        print(f"Fixed {old_id}")

if __name__ == '__main__':
    run()
