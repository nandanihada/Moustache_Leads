import sys
import os
import urllib.request
import json

sys.path.append(os.path.abspath('.'))

from database import db_instance
from bson import ObjectId
from utils.auth import generate_token

# get a user id
user = db_instance.get_collection('users').find_one({'email': 'admin@echobucks.com'})
if not user:
    print("User not found")
    sys.exit(1)
    
user_id = str(user['_id'])

# mock admin user token
admin_user = db_instance.get_collection('users').find_one({'role': 'admin'})
if not admin_user:
    admin_user = user
token = generate_token(admin_user)

req = urllib.request.Request(f'http://localhost:5000/api/admin/users/{user_id}/profile-stats')
req.add_header('Authorization', f'Bearer {token}')
try:
    with urllib.request.urlopen(req) as response:
        print(response.status)
        print(response.read().decode('utf-8'))
except urllib.error.HTTPError as e:
    print(f'HTTPError: {e.code}')
    print(e.read().decode('utf-8'))
except Exception as e:
    print(f'Error: {str(e)}')
