from pymongo import MongoClient

c = MongoClient('mongodb+srv://nan_db_user:j6trrN5m33t4Jwz8@mustache.0gly4in.mongodb.net/ascend_db?retryWrites=true&w=majority&appName=Mustache&tlsAllowInvalidCertificates=true')
db = c['ascend_db']

res = db.forwarded_postbacks.update_many(
    {'offer_id': 'ML-02122'},
    {'$set': {
        'revenue': 4.0,
        'payout': 4.0,
        'points': 4.0,
        'total_payout': 4.0
    }}
)
print(f"Patched {res.modified_count} conversions with correct $4.0 real payout data")
