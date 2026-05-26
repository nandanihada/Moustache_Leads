import sys
import os

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'backend')))

try:
    from database import db_instance
    offers_col = db_instance.get_collection('offers')
    if offers_col is None:
        print("Database connection failed")
        sys.exit(1)

    print("Activating Ali Express (ML-9541603):")
    result = offers_col.update_one(
        {'offer_id': 'ML-9541603'},
        {
            '$set': {
                'status': 'active',
                'is_active': True
            }
        }
    )
    print(f"Matched count: {result.matched_count}")
    print(f"Modified count: {result.modified_count}")

    o = offers_col.find_one({'offer_id': 'ML-9541603'})
    if o:
        print(f"Updated Ali Express: name={o.get('name')} | status={o.get('status')} | is_active={o.get('is_active')}")

except Exception as e:
    print(f"Error: {e}")
