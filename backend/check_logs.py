from database import db_instance
import json
col = db_instance.get_collection('login_logs')
for doc in col.find({'username': {'$in': ['sant', 'leopard']}}):
    doc.pop('_id')
    doc.pop('login_time', None)
    doc.pop('logout_time', None)
    print(json.dumps(doc, default=str))
