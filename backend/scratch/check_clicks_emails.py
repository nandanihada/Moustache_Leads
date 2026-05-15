
from database import db_instance
import json

def check_clicks_with_emails():
    db = db_instance.get_db()
    
    col = db_instance.get_collection('masked_link_clicks')
    if col is not None:
        count_with_email = col.count_documents({'recipient_email': {'$ne': ''}})
        total = col.count_documents({})
        print(f"masked_link_clicks: {count_with_email} with email out of {total}")
        if count_with_email > 0:
            doc = col.find_one({'recipient_email': {'$ne': ''}})
            print(f"Sample with email: {doc.get('recipient_email')}")

    col = db_instance.get_collection('see_more_clicks')
    if col is not None:
        count_with_email = col.count_documents({'recipient_email': {'$ne': ''}})
        total = col.count_documents({})
        print(f"see_more_clicks: {count_with_email} with email out of {total}")

if __name__ == "__main__":
    check_clicks_with_emails()
