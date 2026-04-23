import sys
import os

sys.path.append(os.path.abspath('.'))

from app import app
from database import db_instance
from bson import ObjectId

with app.test_client() as client:
    # get a user id
    user = db_instance.get_collection('users').find_one({'email': 'admin@echobucks.com'})
    if not user:
        print("User not found")
        sys.exit(1)
        
    user_id = str(user['_id'])
    
    from utils.auth import generate_token
    # mock admin user token
    admin_user = db_instance.get_collection('users').find_one({'role': 'admin'})
    if not admin_user:
        admin_user = user
    token = generate_token(admin_user)
    
    res = client.get(f'/api/admin/users/{user_id}/profile-stats', headers={'Authorization': f'Bearer {token}'})
    print(res.status_code)
    print(res.data.decode('utf-8'))
