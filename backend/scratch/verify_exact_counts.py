
from database import db_instance
from datetime import datetime, timedelta

def verify_exact_counts():
    db = db_instance.get_db()
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    
    # 1. Total Mails Sent
    total_mails = 0
    send_col = db_instance.get_collection('offer_send_history')
    if send_col is not None: total_mails += send_col.count_documents({})
    push_col = db_instance.get_collection('push_mail_history')
    if push_col is not None: total_mails += push_col.count_documents({})
    
    # 2. Total Publishers Mailed
    all_user_ids = set()
    if send_col is not None:
        for doc in send_col.find({}, {'recipient_user_ids': 1, 'recipient_emails': 1}):
            uids = doc.get('recipient_user_ids') or []
            emails = doc.get('recipient_emails') or []
            items = uids if uids else emails
            all_user_ids.update(items)
    if push_col is not None:
        for doc in push_col.find({}, {'recipient_ids': 1, 'recipient_emails': 1}):
            uids = doc.get('recipient_ids') or []
            emails = doc.get('recipient_emails') or []
            items = uids if uids else emails
            all_user_ids.update(items)
    
    # 3. Total Interactions
    masked_ips = set()
    masked_clicks_col = db_instance.get_collection('masked_link_clicks')
    if masked_clicks_col is not None:
        masked_ips = set(d['_id'] for d in masked_clicks_col.aggregate([{'$group': {'_id': '$ip'}}]))
    
    see_more_ips = set()
    see_more_col = db_instance.get_collection('see_more_clicks')
    if see_more_col is not None:
        see_more_ips = set(d['_id'] for d in see_more_col.aggregate([{'$group': {'_id': '$ip'}}]))
    
    total_interactions = len(see_more_ips | masked_ips)

    # 4. Offers Interacted
    all_offer_ids = set()
    if masked_clicks_col is not None:
        for d in masked_clicks_col.aggregate([{'$group': {'_id': '$offer_id'}}]):
            if d['_id']: all_offer_ids.add(d['_id'])
    if see_more_col is not None:
        for d in see_more_col.aggregate([{'$group': {'_id': '$offer_id'}}]):
            if d['_id']: all_offer_ids.add(d['_id'])

    # 5. Total Clicks
    total_clicks = 0
    if masked_clicks_col is not None: total_clicks += masked_clicks_col.count_documents({})
    if see_more_col is not None: total_clicks += see_more_col.count_documents({})

    print(f"Mails Sent: {total_mails}")
    print(f"Publishers Mailed: {len(all_user_ids)}")
    print(f"Users Interacted: {total_interactions}")
    print(f"Offers Interacted: {len(all_offer_ids)}")
    print(f"Total Clicks: {total_clicks}")

if __name__ == "__main__":
    verify_exact_counts()
