import sys
sys.path.append('.')
from database import db_instance
def test():
    u = db_instance.get_collection('users').find_one({'username': 'surveytitans'})
    print("User _id:", u['_id'] if u else "Not found")
    print("User username:", u['username'] if u else "")
    
    col = db_instance.get_collection('forwarded_postbacks')
    docs = list(col.find({'publisher_id': str(u['_id'])}).limit(5))
    print(f"Postbacks matched by user_id str: {len(docs)}")
    if not docs:
        docs = list(col.find({'publisher_id': u['username']}).limit(5))
        print(f"Postbacks matched by username: {len(docs)}")
    
if __name__ == '__main__':
    test()
