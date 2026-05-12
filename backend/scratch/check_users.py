from database import db_instance
from datetime import datetime, timezone, timedelta
import json

db = db_instance.get_db()
now = datetime.now(timezone.utc)
today = now.replace(hour=0, minute=0, second=0, microsecond=0)
yesterday = today - timedelta(days=1)

print(f"Current UTC time: {now}")

reg_count_today = db.users.count_documents({"created_at": {"$gte": today}})
reg_count_24h = db.users.count_documents({"created_at": {"$gte": now - timedelta(hours=24)}})
print(f"Users registered today: {reg_count_today}")
print(f"Users registered in last 24h: {reg_count_24h}")

# Check login logs
unique_users_today = len(db.login_logs.distinct("user_id", {"login_time": {"$gte": today}}))
unique_users_24h = len(db.login_logs.distinct("user_id", {"login_time": {"$gte": now - timedelta(hours=24)}}))
print(f"Unique users in login logs today: {unique_users_today}")
print(f"Unique users in login logs last 24h: {unique_users_24h}")

# Automation State
if 'automation_state' in db.list_collection_names():
    total_states = db.automation_state.count_documents({})
    active_today = db.automation_state.count_documents({"last_activity": {"$gte": today}})
    active_24h = db.automation_state.count_documents({"last_activity": {"$gte": now - timedelta(hours=24)}})
    print(f"Total automation states: {total_states}")
    print(f"Active in automation today: {active_today}")
    print(f"Active in automation last 24h: {active_24h}")

# Automation Queue
if 'automation_queue' in db.list_collection_names():
    q_count = db.automation_queue.count_documents({})
    print(f"Current automation queue size: {q_count}")
