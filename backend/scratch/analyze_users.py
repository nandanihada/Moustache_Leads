from database import db_instance
from datetime import datetime, timedelta
from bson import ObjectId

def check():
    db = db_instance.get_db()
    now = datetime.utcnow()
    start = now - timedelta(hours=24)
    
    # 1. Get unique user_ids from logs
    log_uids = db.login_logs.distinct('user_id', {'login_time': {'$gte': start}})
    print(f"Unique user_ids in login_logs (24h): {len(log_uids)}")
    
    valid_users = []
    for uid in log_uids:
        if not uid:
            print("Skipping None/Empty user_id (likely signup attempt)")
            continue
            
        # Try finding the user
        user = None
        try:
            if isinstance(uid, str) and len(uid) == 24:
                user = db.users.find_one({'_id': ObjectId(uid)})
            else:
                user = db.users.find_one({'_id': uid})
        except:
            user = db.users.find_one({'_id': str(uid)})
            
        if user:
            valid_users.append(str(user['_id']))
        else:
            print(f"User ID {uid} not found in users collection")
            
    print(f"Total valid users from logs: {len(valid_users)}")
    
    # 2. Check automation states
    auto_count = db.automation_states.count_documents({})
    print(f"Total automation states: {auto_count}")
    
    # 3. Check what's in automation_states vs logs
    auto_uids = [str(doc['user_id']) for doc in db.automation_states.find()]
    
    missing_in_auto = [uid for uid in valid_users if uid not in auto_uids]
    print(f"Valid users missing from automation queue: {len(missing_in_auto)}")
    for uid in missing_in_auto:
        u = db.users.find_one({'_id': ObjectId(uid)})
        print(f" - Missing: {u.get('username')} ({uid})")

if __name__ == '__main__':
    check()
