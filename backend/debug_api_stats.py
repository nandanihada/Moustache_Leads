import sys
import os
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.append(current_dir)

from database import db_instance

def run():
    col = db_instance.get_collection('api_stats')
    docs = list(col.find({}))
    print(f"Total documents in api_stats: {len(docs)}")
    for d in docs:
        print(d)

if __name__ == '__main__':
    run()
