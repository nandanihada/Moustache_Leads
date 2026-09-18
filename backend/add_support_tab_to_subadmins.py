"""Add superadmin-support tab to all existing subadmins who don't have it yet."""
from database import db_instance

db_instance.connect()
perms = db_instance.get_collection('subadmin_permissions')

docs = list(perms.find({}))
print(f'Found {len(docs)} permission docs')

for doc in docs:
    tabs = doc.get('allowed_tabs', [])
    if 'superadmin-support' not in tabs:
        new_tabs = tabs + ['superadmin-support']
        perms.update_one({'_id': doc['_id']}, {'$set': {'allowed_tabs': new_tabs}})
        print(f'  Added superadmin-support to: {doc.get("user_id")}')
    else:
        print(f'  Already has it: {doc.get("user_id")}')

print('Done.')
