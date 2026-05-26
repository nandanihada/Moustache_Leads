import os
import sys
sys.path.append(os.path.abspath('backend'))
from database import db_instance
from models.user import User

user_model = User()
admin = user_model.find_by_email('admin@moustacheleads.com')
if admin:
    res = user_model.reset_password(admin['_id'], 'admin123')
    print(f"Password reset for admin successful: {res}")
else:
    print("Admin user not found.")
