"""Update admin panel password"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from database import db_instance
import bcrypt

new_password = 'Moustachepanel@@124567##'
hashed = bcrypt.hashpw(new_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

users = db_instance.get_collection('users')
result = users.update_one(
    {'username': 'admin'},
    {'$set': {'password': hashed}}
)

print(f"Matched: {result.matched_count}, Modified: {result.modified_count}")
if result.modified_count > 0:
    print("Admin password updated successfully.")
else:
    print("No admin user found or password unchanged.")
