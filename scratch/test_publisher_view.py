import sys
import os

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'backend')))

try:
    from database import db_instance
    from routes.publisher_offers import merge_pinned_and_organic_offers
    
    offers_collection = db_instance.get_collection('offers')
    if offers_collection is None:
        print("Failed to connect")
        sys.exit(1)
        
    query = {
        'status': {'$in': ['active', 'running', 'rotating']},
        '$or': [{'deleted': {'$exists': False}}, {'deleted': False}]
    }
    
    projection = {
        'offer_id': 1, 'name': 1, 'is_pinned': 1, 'pinnedPosition': 1
    }
    
    pinned_query = dict(query)
    pinned_query['is_pinned'] = True
    pinned_offers = list(offers_collection.find(pinned_query, projection))
    print(f"Active pinned offers count: {len(pinned_offers)}")
    for po in pinned_offers:
         print(f" - {po.get('offer_id')}: {po.get('name')} at slot {po.get('pinnedPosition')}")
         
    offers = merge_pinned_and_organic_offers(
        pinned_offers=pinned_offers,
        organic_query=query,
        skip_original=0,
        limit_original=20,
        sort_field='created_at',
        sort_dir=-1,
        offers_col=offers_collection,
        projection=projection
    )
    
    print(f"\nFinal list size returned: {len(offers)}")
    for idx, offer in enumerate(offers):
        pos = idx + 1
        is_p = offer.get('is_pinned') if offer else False
        p_pos = offer.get('pinnedPosition') if offer else None
        o_id = offer.get('offer_id') if offer else 'N/A'
        name = offer.get('name') if offer else 'None'
        print(f"Position {pos:2d}: {o_id} | {name[:40]} | is_pinned={is_p} | pinnedPosition={p_pos}")

except Exception as e:
    print(f"Error: {e}")
