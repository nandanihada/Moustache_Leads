"""
Debug script to check time_spent_seconds in clicks
"""
from database import db_instance

username = "leopard"
users_col = db_instance.get_collection('users')
user = users_col.find_one({'username': username})

if not user:
    print(f"User '{username}' not found!")
    exit()

user_id = str(user['_id'])
print(f"User ID: {user_id}")

# Check clicks for time_spent_seconds
clicks_col = db_instance.get_collection('clicks')
if clicks_col is not None:
    # Get sample clicks
    sample_clicks = list(clicks_col.find({'user_id': user_id}).limit(5))
    print(f"\nTotal clicks: {clicks_col.count_documents({'user_id': user_id})}")
    
    if sample_clicks:
        print(f"\nSample click fields: {list(sample_clicks[0].keys())}")
        
        # Check if time_spent_seconds exists
        clicks_with_time = clicks_col.count_documents({
            'user_id': user_id,
            'time_spent_seconds': {'$exists': True, '$gt': 0}
        })
        print(f"Clicks with time_spent_seconds > 0: {clicks_with_time}")
        
        # Show sample with time
        click_with_time = clicks_col.find_one({
            'user_id': user_id,
            'time_spent_seconds': {'$exists': True, '$gt': 0}
        })
        if click_with_time:
            print(f"Sample time_spent_seconds: {click_with_time.get('time_spent_seconds')}")
        
        # Check for alternative field names
        for field in ['time_spent', 'duration', 'session_time', 'engagement_time']:
            count = clicks_col.count_documents({
                'user_id': user_id,
                field: {'$exists': True}
            })
            if count > 0:
                print(f"Found {count} clicks with field '{field}'")

print("\n=== DONE ===")
