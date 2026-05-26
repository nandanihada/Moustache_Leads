import sys
sys.path.append(r"c:\Users\rupav\OneDrive\Desktop\New folder (2)\Moustache_Leads\backend")

from database import db_instance
from bson import ObjectId

db_instance.connect()
users_col = db_instance.get_collection('users')

print("Checking users in MongoDB...")

user_ids = ['6616e9141ad662583f8b5a8e', '69c4b3e03fa203889fed1c30']
for uid in user_ids:
    doc = users_col.find_one({'_id': ObjectId(uid)})
    if doc:
        print(f"\nUser ID: {uid}")
        print(f"Username: {doc.get('username')}")
        print(f"Email: {doc.get('email')}")
        print(f"Role: {doc.get('role')}")
    else:
        print(f"\nUser ID: {uid} NOT FOUND in users collection!")

# Let's also print the currently logged-in user in the database if there is one that matches the profile
print("\nAdmin users:")
for u in users_col.find({'role': 'admin'}):
    print(f"Admin Username: {u.get('username')}, ID: {u.get('_id')}")

