"""
Backfill offer grants from email_activity_logs.
This creates grants for all offers that were previously sent to users
via offer access requests and search logs, so those users can now see
the offers even if they're inactive.

Run: python migrations/backfill_offer_grants.py
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import db_instance
from datetime import datetime, timedelta
from bson import ObjectId

GRANT_DURATION_DAYS = 30


def backfill():
    grants_col = db_instance.get_collection('offer_grants')
    email_logs_col = db_instance.get_collection('email_activity_logs')
    
    if grants_col is None or email_logs_col is None:
        print("❌ Database connection failed")
        return

    # Find all email logs from offer_access_requests and search_logs_inventory
    logs = list(email_logs_col.find({
        'source': {'$in': ['offer_access_requests', 'search_logs_inventory', 'search_logs']},
        'offer_ids': {'$exists': True, '$ne': []},
    }))

    print(f"📧 Found {len(logs)} email activity logs to process")

    created = 0
    skipped = 0
    now = datetime.utcnow()
    expires = now + timedelta(days=GRANT_DURATION_DAYS)

    for log in logs:
        offer_ids = log.get('offer_ids', [])
        user_id = log.get('user_id', '')
        recipient_user_ids = log.get('recipient_user_ids', [])
        source = log.get('source', 'admin')
        admin = log.get('admin_username', 'admin')

        # Collect all user IDs this email was sent to
        user_ids = []
        if user_id:
            user_ids.append(user_id)
        if recipient_user_ids:
            user_ids.extend(recipient_user_ids)

        if not user_ids or not offer_ids:
            skipped += 1
            continue

        for uid in user_ids:
            for oid in offer_ids:
                if not oid:
                    continue
                # Upsert — don't create duplicates
                result = grants_col.update_one(
                    {'user_id': str(uid), 'offer_id': str(oid)},
                    {'$setOnInsert': {
                        'user_id': str(uid),
                        'offer_id': str(oid),
                        'source': source,
                        'granted_by': admin,
                        'granted_at': log.get('created_at', now),
                        'expires_at': expires,
                        'clicked': False,
                        'click_date': None,
                        'is_active': True,
                        'created_at': now,
                    }},
                    upsert=True
                )
                if result.upserted_id:
                    created += 1
                else:
                    skipped += 1

    print(f"✅ Backfill complete: {created} grants created, {skipped} skipped (already existed or no data)")
    print(f"📊 Total grants in collection: {grants_col.count_documents({})}")


if __name__ == '__main__':
    backfill()
