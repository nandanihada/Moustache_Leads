import sys
import os
import random
from datetime import datetime, timedelta

# Add the backend directory to Python path if run directly
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.append(current_dir)

from database import db_instance
from bson import ObjectId

def run():
    print("Connecting to Database...")
    if not db_instance.is_connected():
        print("Could not connect to DB. Check if MongoDB is running.")
        return
        
    api_keys = list(db_instance.get_collection('api_keys').find({}))
    if not api_keys:
        print("No API keys found! Creating a dummy API Key for your account automatically...")
        users = list(db_instance.get_collection('users').find({}))
        if not users:
            print("No users found in database.")
            return
        
        user_id = users[0]['_id']
        from models.api_keys_model import ApiKeyModel
        key_model = ApiKeyModel()
        key_doc, _ = key_model.create_api_key(user_id, "Demo Simulator Key")
        key_id = ObjectId(key_doc['_id'])
        key_name = key_doc['key_name']
    else:
        # Pick the most recent key created
        api_keys.sort(key=lambda x: x.get('created_at', datetime.min), reverse=True)
        key_id = api_keys[0]['_id']
        key_name = api_keys[0]['key_name']
        
    print(f"Injecting simulated traffic for API Key: '{key_name}' ({key_id})")
    
    # 1. Simulate Stats
    stats_col = db_instance.get_collection('api_stats')
    stats_col.delete_many({"api_key_id": key_id})
    
    devices = ['desktop', 'mobile', 'tablet']
    sources = ['facebook', 'google', 'direct', 'organic', 'newsletter']
    
    for i in range(14, -1, -1): # Last 14 days to today
        date_str = (datetime.utcnow() - timedelta(days=i)).strftime('%Y-%m-%d')
        
        # Insert 1-4 random stat blocks per day
        for _ in range(random.randint(1, 4)):
            impressions = random.randint(100, 1000)
            clicks = int(impressions * random.uniform(0.02, 0.15)) # 2-15% CTR
            
            stats_col.insert_one({
                "api_key_id": key_id,
                "date": date_str,
                "traffic_source": random.choice(sources),
                "device_type": random.choice(devices),
                "clicks": clicks,
                "impressions": impressions,
                "created_at": datetime.utcnow() - timedelta(days=i)
            })
            
    print("Injected 14 days of realistic Statistics curves.")
            
    # 2. Simulate Conversions
    conv_col = db_instance.get_collection('api_conversions')
    conv_col.delete_many({"api_key_id": key_id})
    
    # Weights for more approved metrics
    statuses = ['approved', 'approved', 'approved', 'pending', 'rejected']
    
    conv_count = 0
    for i in range(14, -1, -1):
        # 1 to 8 conversions per day
        for _ in range(random.randint(1, 8)):
            created_at = datetime.utcnow() - timedelta(days=i, hours=random.randint(1, 23), minutes=random.randint(0,59))
            payout = round(random.uniform(5.50, 45.00), 2)
            
            conv_col.insert_one({
                "api_key_id": key_id,
                "order_id": f"ORD-API-{random.randint(10000, 99999)}",
                "payout": payout,
                "status": random.choice(statuses),
                "created_at": created_at
            })
            conv_count += 1
            
    print(f"Injected {conv_count} varied simulated Conversions.")
    print("\nDONE! Go refresh your React dashboard pages to see the charts populate!")

if __name__ == "__main__":
    run()
