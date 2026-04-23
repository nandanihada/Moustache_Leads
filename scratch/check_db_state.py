import os
import sys
from bson import json_util
from dotenv import load_dotenv

# Path to backend/.env
env_path = os.path.join(os.getcwd(), 'backend', '.env')
load_dotenv(env_path)

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from database import db_instance

def check():
    col = db_instance.get_collection('smart_links')
    if col is None:
        print("DB Not Connected")
        return
    
    doc = col.find_one({'_id': 'global_publisher_tracking'})
    print(f"Record: {json_util.dumps(doc)}")

if __name__ == "__main__":
    check()
