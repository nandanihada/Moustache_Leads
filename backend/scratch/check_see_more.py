
from database import db_instance
import json

def check_see_more():
    db = db_instance.get_db()
    col = db_instance.get_collection('see_more_clicks')
    if col is not None:
        doc = col.find_one({'recipient_email': {'$ne': None, '$ne': ''}})
        if doc:
            print(f"Sample see_more with email: {doc}")
        else:
            print("No see_more with email")

if __name__ == "__main__":
    check_see_more()
