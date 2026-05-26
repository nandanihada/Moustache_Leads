import sys
import os

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'backend')))

try:
    from database import db_instance
    offers_col = db_instance.get_collection('offers')
    if offers_col is None:
        print("Database connection failed")
        sys.exit(1)

    print("Upserting test offers...")
    for o_id in ['ML-TEST-A', 'ML-TEST-B', 'ML-TEST-C']:
        offers_col.update_one(
            {'offer_id': o_id},
            {
                '$set': {
                    'offer_id': o_id,
                    'name': f"Test Offer {o_id[-1]}",
                    'is_pinned': True,
                    'status': 'active',
                    'deleted': False
                }
            },
            upsert=True
        )

    # Place:
    # A at Slot 3
    # B at Slot 4
    # C at Slot 5
    offers_col.update_one({'offer_id': 'ML-TEST-A'}, {'$set': {'pinnedPosition': 3}})
    offers_col.update_one({'offer_id': 'ML-TEST-B'}, {'$set': {'pinnedPosition': 4}})
    offers_col.update_one({'offer_id': 'ML-TEST-C'}, {'$set': {'pinnedPosition': 5}})

    print("Initial Positions:")
    for o_id in ['ML-TEST-A', 'ML-TEST-B', 'ML-TEST-C']:
        o = offers_col.find_one({'offer_id': o_id})
        print(f" - {o_id}: pinnedPosition={o.get('pinnedPosition')}")

    # Now let's simulate the cascading shift if we try to pin a new offer 'ML-TEST-NEW' to Slot 3
    target_position = 3
    print(f"\nSimulating pinning 'ML-TEST-NEW' to target slot: {target_position}")

    active_pinned = list(offers_col.find({
        'is_pinned': True,
        'pinnedPosition': {'$exists': True, '$ne': None},
        'offer_id': {'$ne': 'ML-TEST-NEW'},
        'status': {'$in': ['active', 'running', 'rotating']},
        '$or': [{'deleted': {'$exists': False}}, {'deleted': False}]
    }))

    pos_map = {}
    for po in active_pinned:
        try:
            pos_map[int(po['pinnedPosition'])] = po['offer_id']
        except (ValueError, TypeError):
            pass

    curr_pos = target_position
    shifted_updates = {}
    while curr_pos in pos_map:
        occupying_id = pos_map[curr_pos]
        next_pos = curr_pos + 1
        shifted_updates[occupying_id] = next_pos
        curr_pos = next_pos

    print("Shift Calculations:")
    for off_id, new_pos in shifted_updates.items():
        print(f" - Should shift {off_id} to position {new_pos}")

    # Apply updates
    for off_id, new_pos in shifted_updates.items():
        offers_col.update_one(
            {'offer_id': off_id},
            {'$set': {'pinnedPosition': new_pos}}
        )

    print("\nPositions after cascading shift:")
    for o_id in ['ML-TEST-A', 'ML-TEST-B', 'ML-TEST-C']:
        o = offers_col.find_one({'offer_id': o_id})
        print(f" - {o_id}: pinnedPosition={o.get('pinnedPosition')}")

    # Clean up test documents
    offers_col.delete_many({'offer_id': {'$in': ['ML-TEST-A', 'ML-TEST-B', 'ML-TEST-C']}})
    print("\nCleaned up dummy test offers.")

except Exception as e:
    print(f"Error: {e}")
