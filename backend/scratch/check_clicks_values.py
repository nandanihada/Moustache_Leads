
from database import db_instance
import json

def check_clicks_values():
    db = db_instance.get_db()
    col = db_instance.get_collection('masked_link_clicks')
    if col is not None:
        for doc in col.find().limit(5):
            print(f"ID: {doc['_id']} | Email field: {repr(doc.get('recipient_email'))}")

if __name__ == "__main__":
    check_clicks_values()
