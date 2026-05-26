import sys
import os
import logging

# Set up paths
sys.path.append(os.path.abspath(os.path.dirname(__file__)))

from database import db_instance
from models.user import User

logging.basicConfig(level=logging.INFO)

try:
    print("Checking DB connection...")
    db = db_instance.get_db()
    print("MongoDB DB object retrieved:", db is not None)
    
    # Try finding any user
    user_model = User()
    user = user_model.collection.find_one()
    if user:
        print("Found a user in DB:", user.get('username'))
        # Let's test checking password with a fake try to trigger bcrypt checkpw or other errors
        import bcrypt
        pw = user.get('password')
        print("Type of stored password in DB:", type(pw))
        
        # Test verify_password logic on actual model
        print("Simulating verify_password with incorrect password...")
        try:
            res = user_model.verify_password(user.get('username'), 'wrongpassword')
            print("verify_password executed successfully. Match result:", res is not None)
        except Exception as ve:
            print("verify_password raised exception:")
            import traceback
            traceback.print_exc()
    else:
        print("No users found in database.")
except Exception as e:
    import traceback
    traceback.print_exc()
