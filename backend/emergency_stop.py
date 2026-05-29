"""Emergency stop - cancel all pending emails and disable automation"""
import os
import sys
sys.path.insert(0, os.path.dirname(__file__))
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

from pymongo import MongoClient
from datetime import datetime

client = MongoClient(os.getenv('MONGODB_URI'))
db = client['ascend_db']

# 1. Cancel ALL pending scheduled emails
r1 = db.scheduled_emails.update_many(
    {'status': 'pending'},
    {'$set': {'status': 'cancelled', 'cancelled_at': datetime.utcnow()}}
)
print(f"✅ Cancelled {r1.modified_count} pending emails")

# 2. Disable automation engine
r2 = db.automation_settings.update_one(
    {'type': 'global'},
    {'$set': {'enabled': False}},
    upsert=True
)
print(f"✅ Automation engine DISABLED")

# 3. Pause ALL active automation users
r3 = db.automation_states.update_many(
    {'queue_status': 'active'},
    {'$set': {'queue_status': 'paused', 'next_mail_time': None, 'is_authorized': False}}
)
print(f"✅ Paused {r3.modified_count} active users")

# 4. Also pause the scheduled email service
r4 = db.system_settings.update_one(
    {'key': 'email_service_paused'},
    {'$set': {'value': True, 'manually_set': True, 'updated_at': datetime.utcnow()}},
    upsert=True
)
print(f"✅ Scheduled email service PAUSED")

print("\n🛑 EMERGENCY STOP COMPLETE - No more emails will be sent.")
client.close()
