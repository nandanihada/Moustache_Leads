from pymongo import MongoClient
from config import Config
import json

client = MongoClient(Config.MONGODB_URI)
db = client[Config.DATABASE_NAME]
coll = db['login_logs']

print("--- Querying harry.singh64 ---")
for doc in coll.find({"username": "harry.singh64"}).sort("login_time", -1).limit(5):
    print(doc.get("login_time"), doc.get("ip_address"), doc.get("location"))

print("--- Querying admin ---")
for doc in coll.find({"username": "admin"}).sort("login_time", -1).limit(5):
    print(doc.get("login_time"), doc.get("ip_address"), doc.get("location"))
