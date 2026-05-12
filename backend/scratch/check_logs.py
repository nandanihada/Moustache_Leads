from database import db_instance
from datetime import datetime, timedelta
import json
from bson import json_util

def check_logs():
    db = db_instance.get_db()
    logs_col = db['login_logs']
    
    # Get last 10 logs
    logs = list(logs_col.find().sort('login_time', -1).limit(10))
    
    for log in logs:
        print(f"User: {log.get('email')} | IP: {log.get('ip_address')} | Location: {log.get('location')}")

if __name__ == "__main__":
    check_logs()
