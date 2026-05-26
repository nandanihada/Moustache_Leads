import os
import sys
import time
sys.path.append(os.path.abspath('backend'))
from database import db_instance
from services.automation_service import get_automation_service

def test():
    users_col = db_instance.get_collection('users')
    user = users_col.find_one()
    if not user:
        print("No users")
        return
    user_id = str(user['_id'])
    print(f"User: {user_id}")

    service = get_automation_service()
    
    print("Getting user state...")
    state = service.model.get_user_state(user_id)
    if not state:
        service.handle_user_activity(user_id, force_reset=True)
        state = service.model.get_user_state(user_id)
        
    print("State:", state)
    
    current_step = state.get('current_step', 0)
    print(f"current_step: {current_step}")
    
    simulated_sent_ids = list(state.get('sent_offer_ids', []))
    simulated_state = dict(state)
    
    for step in range(current_step + 1, 6):
        print(f"Processing step {step}...")
        simulated_state['sent_offer_ids'] = simulated_sent_ids
        
        start = time.time()
        print("Calling _get_offers_for_step...")
        offers, step_interests = service._get_offers_for_step(step, user_id, simulated_state)
        print(f"_get_offers_for_step took {time.time() - start:.4f}s")
        
        if offers:
            offer = offers[0]
            print(f"Selected offer: {offer.get('offer_name') or offer.get('name')}")
            simulated_sent_ids.append(str(offer.get('_id')))
        else:
            print("No offers returned.")
            break

if __name__ == '__main__':
    test()
