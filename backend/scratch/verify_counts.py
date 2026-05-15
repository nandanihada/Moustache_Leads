
from database import db_instance
from datetime import datetime, timedelta

def verify_counts():
    db = db_instance.get_db()
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    
    # 1. Mails Sent
    total_mails = 0
    send_col = db_instance.get_collection('offer_send_history')
    if send_col is not None:
        total_mails += send_col.count_documents({})
    push_col = db_instance.get_collection('push_mail_history')
    if push_col is not None:
        total_mails += push_col.count_documents({})
    
    # 2. Publishers Mailed
    recipients = set()
    if send_col is not None:
        for doc in send_col.find({}, {'recipient_user_ids': 1, 'recipient_emails': 1}):
            for uid in doc.get('recipient_user_ids') or []: recipients.add(str(uid))
            for email in doc.get('recipient_emails') or []: recipients.add(f"email:{email}")
    if push_col is not None:
        for doc in push_col.find({}, {'recipient_ids': 1, 'recipient_emails': 1}):
            for uid in doc.get('recipient_ids') or []: recipients.add(str(uid))
            for email in doc.get('recipient_emails') or []: recipients.add(f"email:{email}")
    total_publishers = len(recipients)

    # 3. Users Interacted (Unique IPs or resolved users from clicks)
    users_interacted = set()
    masked_col = db_instance.get_collection('masked_link_clicks')
    if masked_col is not None:
        for doc in masked_col.find({}, {'ip': 1, 'recipient_email': 1}):
            users_interacted.add(doc.get('recipient_email') or doc.get('ip'))
    see_col = db_instance.get_collection('see_more_clicks')
    if see_col is not None:
        for doc in see_col.find({}, {'ip': 1, 'recipient_email': 1}):
            users_interacted.add(doc.get('recipient_email') or doc.get('ip'))
    total_users_interacted = len(users_interacted)

    # 4. Offers Interacted (Unique offer_ids from clicks)
    offers_interacted = set()
    if masked_col is not None:
        for doc in masked_col.find({}, {'offer_id': 1}):
            if doc.get('offer_id'): offers_interacted.add(str(doc['offer_id']))
    if see_col is not None:
        for doc in see_col.find({}, {'offer_id': 1}):
            if doc.get('offer_id'): offers_interacted.add(str(doc['offer_id']))
    total_offers_interacted = len(offers_interacted)

    # 5. Total Clicks
    total_clicks = 0
    if masked_col is not None:
        total_clicks += masked_col.count_documents({})
    if see_col is not None:
        total_clicks += see_col.count_documents({})

    print(f"Mails Sent: {total_mails}")
    print(f"Publishers Mailed: {total_publishers}")
    print(f"Users Interacted: {total_users_interacted}")
    print(f"Offers Interacted: {total_offers_interacted}")
    print(f"Total Clicks: {total_clicks}")

if __name__ == "__main__":
    verify_counts()
