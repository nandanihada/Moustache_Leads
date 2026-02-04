"""Check category distribution for active offers"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from database import db_instance

def check_categories():
    offers = db_instance.get_collection('offers')
    
    pipeline = [
        {"$match": {"status": "active", "is_active": True}},
        {"$group": {"_id": "$vertical", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    
    results = list(offers.aggregate(pipeline))
    print("Active offers by category:")
    for r in results:
        print(f"  {r['_id']}: {r['count']}")

if __name__ == "__main__":
    check_categories()
