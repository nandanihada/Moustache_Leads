import sys
import os

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'backend')))

try:
    from database import db_instance
    offers_col = db_instance.get_collection('offers')
    if offers_col is None:
        print("Failed to get offers collection")
        sys.exit(1)
        
    print("Activating Everyday Winner (ML-3061020):")
    result = offers_col.update_one(
        {'offer_id': 'ML-3061020'},
        {
            '$set': {
                'status': 'active',
                'is_active': True
            }
        }
    )
    print(f"Matched count: {result.matched_count}")
    print(f"Modified count: {result.modified_count}")
    
    # Also double check its fields
    o = offers_col.find_one({'offer_id': 'ML-3061020'})
    if o:
        print(f"Updated Everyday Winner: name={o.get('name')} | is_pinned={o.get('is_pinned')} | pinnedPosition={o.get('pinnedPosition')} | status={o.get('status')} | is_active={o.get('is_active')}")

except Exception as e:
    print(f"Error: {e}")
