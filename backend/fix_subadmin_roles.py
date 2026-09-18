"""Fix subadmin roles — run once to promote users with subadmin_permissions to role=subadmin."""
from database import db_instance
from bson import ObjectId

db_instance.connect()
users = db_instance.get_collection('users')
perms = db_instance.get_collection('subadmin_permissions')

perm_docs = list(perms.find({}, {'user_id': 1}))
print(f'Found {len(perm_docs)} subadmin permission docs')

for p in perm_docs:
    uid = p['user_id']
    try:
        u = users.find_one({'_id': ObjectId(uid)}, {'username': 1, 'role': 1})
        if not u:
            print(f'  User not found: {uid}')
            continue
        if u.get('role') in ('admin', 'subadmin'):
            print(f'  Already ok: {u.get("username")} role={u.get("role")}')
        else:
            users.update_one({'_id': ObjectId(uid)}, {'$set': {'role': 'subadmin'}})
            print(f'  FIXED: {u.get("username")} {u.get("role")} -> subadmin')
    except Exception as e:
        print(f'  Error for {uid}: {e}')

print('Done.')
