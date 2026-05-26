import sys
import os

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'backend')))

try:
    from database import db_instance
    offers_col = db_instance.get_collection('offers')
    if offers_col is None:
        print("Failed to get offers collection")
        sys.exit(1)
        
    print("Searching for Every Day Winner:")
    o = offers_col.find_one({'name': {'$regex': 'Every Day Winner', '$options': 'i'}})
    if o:
        print(f"Offer found: offer_id={o.get('offer_id')} | name={o.get('name')} | is_pinned={o.get('is_pinned')} | pinnedPosition={o.get('pinnedPosition')} | status={o.get('status')} | deleted={o.get('deleted')}")
    else:
        # Search all active pinned offers
        print("Not found by name. Listing all offers with is_pinned=True:")
        pinned = list(offers_col.find({'is_pinned': True}))
        for idx, po in enumerate(pinned):
            print(f" {idx+1}: {po.get('offer_id')} | {po.get('name')} | pinnedPosition={po.get('pinnedPosition')} | status={po.get('status')}")

except Exception as e:
    print(f"Error: {e}")
