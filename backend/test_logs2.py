from pymongo import MongoClient

client = MongoClient('mongodb+srv://shivam_db_user:N2GXWCIahXjPfHps@mlapril.ivsdtl2.mongodb.net/')
db = client['moustache_leads']
logs = db['login_logs'].find().sort("login_time", -1).limit(20)
for log in logs:
    loc = log.get('location', {})
    print(f"User: {log.get('username')}, IP: {log.get('ip_address')}, Location: {loc}")
