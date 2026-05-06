from database import db_instance
from datetime import datetime
from bson import ObjectId
import json

def serialize(obj):
    if isinstance(obj, datetime):
        return obj.isoformat()
    if isinstance(obj, ObjectId):
        return str(obj)
    if isinstance(obj, dict):
        return {k: serialize(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [serialize(i) for i in obj]
    return obj

def check_users():
    db = db_instance.get_db()
    users_to_check = ['aryan', 'gamesbrothersoft37']
    
    for username in users_to_check:
        print(f"--- Checking user: {username} ---")
        logs = list(db.login_logs.find({"username": username}).sort("login_time", -1).limit(2))
        for log in logs:
            print(json.dumps(serialize(log), indent=2))
        print("\n")

if __name__ == "__main__":
    check_users()
