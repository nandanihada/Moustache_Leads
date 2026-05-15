
from database import db_instance
import json

def check_user_schema():
    db = db_instance.get_db()
    user = db.users.find_one()
    if user:
        # Remove sensitive fields
        user.pop('password', None)
        user.pop('hashed_password', None)
        if '_id' in user: user['_id'] = str(user['_id'])
        # Convert datetimes
        for k, v in user.items():
            if hasattr(v, 'isoformat'): user[k] = v.isoformat()
        print(json.dumps(user, indent=2))

if __name__ == "__main__":
    check_user_schema()
