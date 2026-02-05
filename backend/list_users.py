import sys
sys.path.insert(0, '.')
from database import db_instance

users = db_instance.get_collection('users')
if users is not None:
    print("Users in database:")
    for u in users.find({}, {'username': 1, 'email': 1, '_id': 1}).limit(15):
        print(f"  Username: {u.get('username', 'N/A')}, Email: {u.get('email', 'N/A')}, ID: {u['_id']}")
else:
    print('Could not connect to users collection')
