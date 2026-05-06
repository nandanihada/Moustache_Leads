import datetime
from database import db_instance

db = db_instance.get_db()
doc = db.scheduled_emails.find_one({'status': 'pending'})
if doc:
    print('Found pending doc, updating scheduled_at')
    db.scheduled_emails.update_one({'_id': doc['_id']}, {'$set': {'scheduled_at': datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(minutes=5)}})
else:
    print('No pending doc found')
