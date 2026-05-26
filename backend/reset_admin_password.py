import sys
import os
import bcrypt
from datetime import datetime

sys.path.append(os.path.abspath(os.path.dirname(__file__)))

from database import db_instance
from models.user import User

try:
    db_instance.connect()
    users_col = db_instance.get_collection('users')
    
    hashed = bcrypt.hashpw('admin123'.encode('utf-8'), bcrypt.gensalt())
    
    result = users_col.update_one(
        {'username': 'admin'},
        {'$set': {
            'password': hashed,
            'is_active': True,
            'email_verified': True
        }}
    )
    
    if result.matched_count > 0:
        print("Successfully updated password of user 'admin' to 'admin123'!")
    else:
        print("User 'admin' not found.")
        
except Exception as e:
    import traceback
    traceback.print_exc()
