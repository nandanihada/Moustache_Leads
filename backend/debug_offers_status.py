import sys
import os
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.append(current_dir)

from database import db_instance

def run():
    offers_col = db_instance.get_collection('offers')
    pipeline = [
        {"$group": {"_id": "$approval_status", "count": {"$sum": 1}}}
    ]
    results = list(offers_col.aggregate(pipeline))
    print("Breakdown of 'approval_status' across all 11,213 offers:")
    for r in results:
        print(f"{r['_id']}: {r['count']}")
        
    pipeline2 = [
        {"$group": {"_id": "$status", "count": {"$sum": 1}}}
    ]
    results2 = list(offers_col.aggregate(pipeline2))
    print("\nBreakdown of 'status' across all 11,213 offers:")
    for r in results2:
        print(f"{r['_id']}: {r['count']}")

if __name__ == '__main__':
    run()
