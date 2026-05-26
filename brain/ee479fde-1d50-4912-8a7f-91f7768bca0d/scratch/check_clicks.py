import sys
sys.path.append(r"c:\Users\rupav\OneDrive\Desktop\New folder (2)\Moustache_Leads\backend")

from database import db_instance
from bson import ObjectId

# Initialize DB connection
db_instance.connect()

print("Checking click records in MongoDB...")
clicks_col = db_instance.get_collection('clicks')
dashboard_clicks_col = db_instance.get_collection('dashboard_clicks')
offerwall_clicks_detailed_col = db_instance.get_collection('offerwall_clicks_detailed')

offer_id = 'ML-02147'
user_id = '6616e9141ad662583f8b5a8e'

print(f"\n1. In 'clicks' collection (simple tracking clicks) for offer {offer_id}:")
query_simple_all = {'offer_id': offer_id}
print(f"Total clicks for offer {offer_id} regardless of user: {clicks_col.count_documents(query_simple_all) if clicks_col is not None else 0}")

query_simple_user = {'offer_id': offer_id, '$or': [{'user_id': user_id}, {'user_id': ObjectId(user_id)}, {'user_id': str(user_id)}]}
print(f"Clicks for user {user_id} and offer {offer_id}: {clicks_col.count_documents(query_simple_user) if clicks_col is not None else 0}")

print("\nSample records in 'clicks':")
if clicks_col is not None:
    for doc in clicks_col.find(query_simple_all).limit(3):
        print({k: str(v) for k, v in doc.items()})

print(f"\n2. In 'dashboard_clicks' collection for offer {offer_id}:")
query_dash_all = {'offer_id': offer_id}
print(f"Total clicks for offer {offer_id} regardless of user: {dashboard_clicks_col.count_documents(query_dash_all) if dashboard_clicks_col is not None else 0}")

query_dash_user = {'offer_id': offer_id, '$or': [{'user_id': user_id}, {'user_id': ObjectId(user_id)}, {'user_id': str(user_id)}]}
print(f"Clicks for user {user_id} and offer {offer_id}: {dashboard_clicks_col.count_documents(query_dash_user) if dashboard_clicks_col is not None else 0}")

print("\nSample records in 'dashboard_clicks':")
if dashboard_clicks_col is not None:
    for doc in dashboard_clicks_col.find(query_dash_all).limit(3):
        print({k: str(v) for k, v in doc.items()})

print(f"\n3. In 'offerwall_clicks_detailed' collection for offer {offer_id}:")
query_off_all = {'offer_id': offer_id}
print(f"Total clicks regardless of user: {offerwall_clicks_detailed_col.count_documents(query_off_all) if offerwall_clicks_detailed_col is not None else 0}")

