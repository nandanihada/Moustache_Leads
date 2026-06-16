import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

from database import db_instance
from bson import ObjectId

def main():
    db_instance.is_connected()
    col = db_instance.get_collection('users')
    user = col.find_one({'_id': ObjectId('6a30cdb1881451df37951153')})
    if user:
        print(f"Yes! Found in users collection: {user}")
    else:
        print("No, not found in users collection.")

if __name__ == "__main__":
    main()
