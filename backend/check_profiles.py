from database import db_instance
import json
from bson import ObjectId
from datetime import datetime

def serialize(obj):
    if isinstance(obj, datetime):
        return obj.isoformat()
    if isinstance(obj, ObjectId):
        return str(obj)
    if isinstance(obj, bytes):
        return "<bytes>"
    if isinstance(obj, dict):
        return {k: serialize(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [serialize(i) for i in obj]
    return obj

def check_profiles():
    db = db_instance.get_db()
    users_to_check = ['aryan', 'gamesbrothersoft37', 'admin']
    
    for username in users_to_check:
        print(f"--- Checking profile: {username} ---")
        user = db.users.find_one({"username": username})
        if not user:
            user = db.users.find_one({"email": {"$regex": username, "$options": "i"}})
        
        if user:
            print(json.dumps(serialize(user), indent=2))
        else:
            print("Profile not found")
        print("\n")

if __name__ == "__main__":
    check_profiles()
