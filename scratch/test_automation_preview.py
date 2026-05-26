import os
import sys
import time
sys.path.append(os.path.abspath('backend'))
from database import db_instance
from services.automation_service import get_automation_service

def benchmark_preview():
    # 1. Get a user ID from the database
    users_col = db_instance.get_collection('users')
    user = users_col.find_one()
    if not user:
        print("No users found in database.")
        return
    user_id = str(user['_id'])
    print(f"Benchmarking preview_next_offers for user ID: {user_id} ({user.get('username')})")

    service = get_automation_service()
    
    # 2. Make sure user has an automation state
    state = service.model.get_user_state(user_id)
    if not state:
        print("No automation state. Creating one...")
        service.handle_user_activity(user_id, force_reset=True)
        state = service.model.get_user_state(user_id)
        
    start = time.time()
    offers, interests = service.preview_next_offers(user_id)
    print(f"preview_next_offers took {time.time() - start:.4f}s, found {len(offers)} offers")

if __name__ == '__main__':
    benchmark_preview()
