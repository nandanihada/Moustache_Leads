
from database import db_instance
import json

def check_login_logs():
    db = db_instance.get_db()
    col = db_instance.get_collection('login_logs')
    if col is not None:
        doc = col.find_one()
        if doc:
            print(f"Sample login_log: {doc}")
        else:
            print("No login_logs")

if __name__ == "__main__":
    check_login_logs()
