import sys
import time
sys.path.append('.')
from routes.user_payments import calculate_user_earnings
from database import db_instance
import json

def test():
    users_col = db_instance.get_collection('users')
    users = list(users_col.find({}))
    print(f"Total Users: {len(users)}")
    
    start_time = time.time()
    for u in users:
        uid = str(u['_id'])
        calculate_user_earnings(uid)
    print(f"Time taken to calc 200 users: {time.time() - start_time} seconds")

if __name__ == '__main__':
    test()
