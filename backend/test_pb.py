import sys
import time
sys.path.append('.')
from database import db_instance
import json

def test():
    col = db_instance.get_collection('forwarded_postbacks')
    docs = list(col.find({'forward_status': 'success'}).limit(5))
    print("Postbacks:")
    for d in docs:
        print(f"publisher_id: {d.get('publisher_id')}")

if __name__ == '__main__':
    test()
