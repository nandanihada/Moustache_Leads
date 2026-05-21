from pymongo import MongoClient
from config import Config
import json

client = MongoClient(Config.MONGODB_URI)

db = client[Config.DATABASE_NAME]
coll = db['login_logs']
users = [
    {'username': 'tomaswin529', 'email': 'tomaswin5@gmail.com'},
    {'username': 'owner58', 'email': 'owner@cashylo.com'},
    {'username': 'jahnson439', 'email': 'jahnson4@gmail.com'},
]

for u in users:
    print('\n===', u)
    q = {'$or': [{'username': u['username']}, {'email': u['email']}]}
    count = coll.count_documents(q)
    print('count', count)
    for doc in coll.find(q, {'_id': 0, 'username': 1, 'email': 1, 'ip_address': 1, 'location': 1, 'login_time': 1, 'status': 1}).sort('login_time', -1).limit(20):
        print(json.dumps(doc, default=str))
