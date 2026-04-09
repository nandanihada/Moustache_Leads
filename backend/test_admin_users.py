import sys
sys.path.append('.')
from routes.user_payments import calculate_user_earnings
from database import db_instance
import json

def test():
    users_col = db_instance.get_collection('users')
    users = list(users_col.find({}))
    print(f"Total Users: {len(users)}")
    
    # Check if there is an error in calculation
    if len(users) > 0:
        uid = str(users[0]['_id'])
        print(f"Testing calculation for user {uid}")
        try:
            earnings = calculate_user_earnings(uid)
            print("Earnings OK!")
            print(earnings)
        except Exception as e:
            print("Earnings Failed:", e)

if __name__ == '__main__':
    test()
