import sys
import os

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'backend')))

try:
    from database import db_instance
    offers_col = db_instance.get_collection('offers')
    if offers_col is None:
        print("Database connection failed")
        sys.exit(1)

    offers = list(offers_col.find({'name': {'$regex': 'Ali', '$options': 'i'}}))
    print(f"Found {len(offers)} offers matching 'Ali':")
    for o in offers:
        print(f" - id={o.get('offer_id')} | name={o.get('name')} | status={o.get('status')} | is_pinned={o.get('is_pinned')} | pinnedPosition={o.get('pinnedPosition')}")

except Exception as e:
    print(f"Error: {e}")
