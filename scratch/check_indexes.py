import os
import sys
sys.path.append(os.path.abspath('backend'))
from database import db_instance

db = db_instance.get_db()
offers_col = db_instance.get_collection('offers')
if offers_col is not None:
    indexes = list(offers_col.list_indexes())
    print("Indexes on offers collection:")
    for idx in indexes:
        print(idx)
else:
    print("Offers collection not found.")
