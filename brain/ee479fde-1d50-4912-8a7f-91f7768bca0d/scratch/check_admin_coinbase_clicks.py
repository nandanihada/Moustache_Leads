import sys
sys.path.append(r"c:\Users\rupav\OneDrive\Desktop\New folder (2)\Moustache_Leads\backend")

from database import db_instance
from bson import ObjectId

db_instance.connect()
clicks_col = db_instance.get_collection('clicks')
dash_clicks_col = db_instance.get_collection('dashboard_clicks')
users_col = db_instance.get_collection('users')

offer_id = 'ML-02147'
admin_id = '68e4e41a4ad662563fdb568a'

print("Checking clicks for Coinbase $32 (ML-02147) and admin user (68e4e41a4ad662563fdb568a)...")

q1 = {'offer_id': offer_id, '$or': [{'user_id': admin_id}, {'user_id': ObjectId(admin_id)}, {'user_id': str(admin_id)}]}
print(f"Clicks in 'clicks' collection: {clicks_col.count_documents(q1) if clicks_col is not None else 0}")

q2 = {'offer_id': offer_id, '$or': [{'user_id': admin_id}, {'user_id': ObjectId(admin_id)}, {'user_id': str(admin_id)}]}
print(f"Clicks in 'dashboard_clicks' collection: {dash_clicks_col.count_documents(q2) if dash_clicks_col is not None else 0}")

print("\nDetail of all clicks in 'clicks' collection for ML-02147:")
if clicks_col is not None:
    for doc in clicks_col.find({'offer_id': offer_id}):
        print(f"- Click ID: {doc.get('click_id')}, User ID: {doc.get('user_id')}, Affiliate ID: {doc.get('affiliate_id')}, Time: {doc.get('click_time') or doc.get('timestamp')}")

