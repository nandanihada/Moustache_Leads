import sys
import os

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'backend')))

try:
    from database import db_instance
    offers_col = db_instance.get_collection('offers')
    if offers_col is None:
        print("Database connection failed")
        sys.exit(1)

    o = offers_col.find_one({'offer_id': 'ML-9541600'})
    if o:
        print(f"Found Ali Express ML-9541600: id={o.get('offer_id')} | name={o.get('name')} | status={o.get('status')} | is_pinned={o.get('is_pinned')} | pinnedPosition={o.get('pinnedPosition')}")
    else:
        print("Ali Express ML-9541600 not found in DB")

except Exception as e:
    print(f"Error: {e}")
