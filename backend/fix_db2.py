from pymongo import MongoClient

c = MongoClient('mongodb+srv://nan_db_user:j6trrN5m33t4Jwz8@mustache.0gly4in.mongodb.net/ascend_db?retryWrites=true&w=majority&appName=Mustache&tlsAllowInvalidCertificates=true')
db = c['ascend_db']

click = db.clicks.find_one({'offer_name': {'$regex': 'scrambly', '$options': 'i'}, 'click_id': {'$exists': True}})
if click:
    res = db.forwarded_postbacks.update_many(
        {'offer_id': 'ML-00057'},
        {'$set': {
            'offer_id': click['offer_id'],
            'click_id': click['click_id'],
            'timestamp': click['click_time']
        }}
    )
    print(f"Patched {res.modified_count} conversions to {click['offer_id']}")
else:
    print('Scrambly click not found')
