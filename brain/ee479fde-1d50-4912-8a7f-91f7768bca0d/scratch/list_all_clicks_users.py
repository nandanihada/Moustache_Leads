import sys
sys.path.append(r"c:\Users\rupav\OneDrive\Desktop\New folder (2)\Moustache_Leads\backend")

from database import db_instance

db_instance.connect()
clicks_col = db_instance.get_collection('clicks')
dash_clicks_col = db_instance.get_collection('dashboard_clicks')
users_col = db_instance.get_collection('users')

print("Checking unique user_ids in 'clicks':")
if clicks_col is not None:
    for uid in clicks_col.distinct('user_id'):
        user_doc = users_col.find_one({'_id': uid}) if isinstance(uid, str) and len(uid) == 24 else None
        if not user_doc and isinstance(uid, str) and len(uid) == 24:
            from bson import ObjectId
            try:
                user_doc = users_col.find_one({'_id': ObjectId(uid)})
            except:
                pass
        username = user_doc.get('username') if user_doc else 'Unknown User'
        print(f"- User ID: {uid} ({username}) has {clicks_col.count_documents({'user_id': uid})} clicks")

print("\nChecking unique user_ids in 'dashboard_clicks':")
if dash_clicks_col is not None:
    for uid in dash_clicks_col.distinct('user_id'):
        user_doc = users_col.find_one({'_id': uid}) if isinstance(uid, str) and len(uid) == 24 else None
        if not user_doc and isinstance(uid, str) and len(uid) == 24:
            from bson import ObjectId
            try:
                user_doc = users_col.find_one({'_id': ObjectId(uid)})
            except:
                pass
        username = user_doc.get('username') if user_doc else 'Unknown User'
        print(f"- User ID: {uid} ({username}) has {dash_clicks_col.count_documents({'user_id': uid})} clicks")

print("\nAll users in system:")
for u in users_col.find():
    print(f"- Username: {u.get('username')}, ID: {u.get('_id')}, Role: {u.get('role')}")

