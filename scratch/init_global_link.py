import os
import sys
from dotenv import load_dotenv

# Path to backend/.env
env_path = os.path.join(os.getcwd(), 'backend', '.env')
load_dotenv(env_path)

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from database import db_instance
from datetime import datetime

def init_global_link():
    col = db_instance.get_collection('smart_links')
    if col is None:
        print("DB Not Connected")
        return
    
    # Check if a link with slug 'global' exists
    existing = col.find_one({'slug': 'global'})
    if not existing:
        print("Creating Global Smart Link in DB...")
        new_link = {
            'name': 'Global Auto-Rotating Link',
            'slug': 'global',
            'status': 'active',
            'rotation_strategy': 'round_robin',
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow(),
            'description': 'Automatic redirection to the best performing offers across all regions.'
        }
        col.insert_one(new_link)
        print("Global Smart Link created successfully.")
    else:
        print("Global Smart Link already exists.")
        # Ensure it's active and has correct strategy
        col.update_one(
            {'_id': existing['_id']},
            {'$set': {
                'status': 'active',
                'rotation_strategy': 'round_robin'
            }}
        )
        print("Global Smart Link updated.")

if __name__ == "__main__":
    init_global_link()
