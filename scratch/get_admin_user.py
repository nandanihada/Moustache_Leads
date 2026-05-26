import os
import sys
sys.path.append(os.path.abspath('backend'))
from database import db_instance

db = db_instance.get_db()
users_col = db_instance.get_collection('users')
if users_col is not None:
    admins = list(users_col.find({'role': {'$in': ['admin', 'subadmin']}}, {'username': 1, 'email': 1, 'role': 1}))
    print("Admin/Subadmin users:")
    for u in admins:
        print(f"Username: {u.get('username')}, Email: {u.get('email')}, Role: {u.get('role')}")
else:
    print("Users collection not found.")
