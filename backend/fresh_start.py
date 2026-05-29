"""FRESH START - Wipe everything clean for a fresh test"""
import os
import sys
sys.path.insert(0, os.path.dirname(__file__))
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

from pymongo import MongoClient
from datetime import datetime

client = MongoClient(os.getenv('MONGODB_URI'))
db = client['ascend_db']

# 1. DELETE all automation-related scheduled emails (not other system emails)
r1 = db.scheduled_emails.delete_many({
    '$or': [
        {'type': {'$regex': '^automation_'}},
        {'created_by': 'automation_engine'},
        {'created_by': 'admin'}
    ]
})
print(f"✅ Deleted {r1.deleted_count} automation emails from scheduled_emails")

# 2. WIPE all automation states
r2 = db.automation_states.delete_many({})
print(f"✅ Deleted {r2.deleted_count} automation states")

# 3. Keep engine DISABLED - you enable it only when ready
db.automation_settings.update_one(
    {'type': 'global'},
    {'$set': {'enabled': False, 'dry_run': False}},
    upsert=True
)
print(f"✅ Engine Status: OFF, Dry Run: OFF")

# 4. Unpause the email service (so when you DO send, it actually delivers)
db.system_settings.update_one(
    {'key': 'email_service_paused'},
    {'$set': {'value': False, 'manually_set': True, 'updated_at': datetime.utcnow()}},
    upsert=True
)
print(f"✅ Email service: ACTIVE (ready to send when you trigger)")

print("\n🟢 FRESH START COMPLETE")
print("   - All old emails wiped")
print("   - All automation states wiped")  
print("   - Engine is OFF (won't auto-send to anyone)")
print("   - Email service is ON (will deliver when you manually trigger)")
print("\n📋 Next steps:")
print("   1. Restart your backend (python run.py)")
print("   2. Select ONLY your test user")
print("   3. Click Bulk Outreach → select 5 offers → One by One → Send")
print("   4. Check Email History - should show exactly 5 entries for that user")
print("   5. User will receive 5 emails staggered by your step interval")

client.close()
