import sys
sys.path.append(r"c:\Users\rupav\OneDrive\Desktop\New folder (2)\Moustache_Leads\backend")

from database import db_instance

db_instance.connect()
clicks_col = db_instance.get_collection('clicks')
users_col = db_instance.get_collection('users')

print("Users in database:")
users = list(users_col.find())
for u in users:
    print(f"- Username: {u.get('username')}, ID: {u.get('_id')}, Role: {u.get('role')}")

print("\nClicks in database:")
if clicks_col is not None:
    pipeline = [
        {"$group": {"_id": "$user_id", "count": {"$sum": 1}}}
    ]
    results = list(clicks_col.aggregate(pipeline))
    for r in results:
        print(f"- User ID: {r['_id']} has {r['count']} clicks")

