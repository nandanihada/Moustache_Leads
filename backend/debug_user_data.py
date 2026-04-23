"""
Debug script to check what data exists for a specific user
"""
from database import db_instance
from bson import ObjectId

# Find user by username
username = "leopard"
users_col = db_instance.get_collection('users')
user = users_col.find_one({'username': username})

if not user:
    print(f"User '{username}' not found!")
    exit()

user_id = str(user['_id'])
email = user.get('email', '')

print(f"\n=== USER INFO ===")
print(f"Username: {username}")
print(f"User ID: {user_id}")
print(f"Email: {email}")
print(f"Level: {user.get('level', 'N/A')}")

# Check clicks collections
print(f"\n=== CLICKS DATA ===")

clicks_col = db_instance.get_collection('clicks')
if clicks_col is not None:
    # Try different query combinations
    queries = [
        {'user_id': user_id},
        {'user_id': username},
        {'affiliate_id': user_id},
        {'affiliate_id': username},
        {'username': username},
        {'publisher_id': user_id},
        {'publisher_name': username},
    ]
    
    for query in queries:
        count = clicks_col.count_documents(query)
        if count > 0:
            print(f"clicks collection - {query}: {count} records")
            # Show sample
            sample = clicks_col.find_one(query)
            print(f"  Sample fields: {list(sample.keys())}")

dashboard_col = db_instance.get_collection('dashboard_clicks')
if dashboard_col is not None:
    queries = [
        {'user_id': user_id},
        {'user_id': username},
        {'username': username},
        {'user_email': email},
        {'publisher_name': username},
    ]
    
    for query in queries:
        count = dashboard_col.count_documents(query)
        if count > 0:
            print(f"dashboard_clicks collection - {query}: {count} records")
            sample = dashboard_col.find_one(query)
            print(f"  Sample fields: {list(sample.keys())}")

offerwall_col = db_instance.get_collection('offerwall_clicks')
if offerwall_col is not None:
    queries = [
        {'user_id': user_id},
        {'publisher_id': user_id},
        {'username': username},
    ]
    
    for query in queries:
        count = offerwall_col.count_documents(query)
        if count > 0:
            print(f"offerwall_clicks collection - {query}: {count} records")
            sample = offerwall_col.find_one(query)
            print(f"  Sample fields: {list(sample.keys())}")

offerwall_detailed_col = db_instance.get_collection('offerwall_clicks_detailed')
if offerwall_detailed_col is not None:
    queries = [
        {'user_id': user_id},
        {'publisher_id': user_id},
        {'publisher_name': username},
    ]
    
    for query in queries:
        count = offerwall_detailed_col.count_documents(query)
        if count > 0:
            print(f"offerwall_clicks_detailed collection - {query}: {count} records")
            sample = offerwall_detailed_col.find_one(query)
            print(f"  Sample fields: {list(sample.keys())}")

# Check affiliate requests
print(f"\n=== AFFILIATE REQUESTS ===")
affiliate_requests = db_instance.get_collection('affiliate_requests')
if affiliate_requests is not None:
    queries = [
        {'publisher_id': user_id},
        {'username': username},
    ]
    
    for query in queries:
        count = affiliate_requests.count_documents(query)
        if count > 0:
            print(f"affiliate_requests - {query}: {count} records")

# Check login logs
print(f"\n=== LOGIN LOGS ===")
login_logs = db_instance.get_collection('login_logs')
if login_logs is not None:
    queries = [
        {'user_id': user_id},
        {'username': username},
        {'email': email},
    ]
    
    for query in queries:
        count = login_logs.count_documents(query)
        if count > 0:
            print(f"login_logs - {query}: {count} records")

print("\n=== DONE ===")
