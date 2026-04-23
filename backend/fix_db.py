from pymongo import MongoClient

c = MongoClient('mongodb+srv://nan_db_user:j6trrN5m33t4Jwz8@mustache.0gly4in.mongodb.net/ascend_db?retryWrites=true&w=majority&appName=Mustache&tlsAllowInvalidCertificates=true')
db = c['ascend_db']

# Find top clicks with actual activity
clicks = list(db.clicks.find({'offer_id': {'$exists': True}}).limit(2))

if clicks:
    click = clicks[0]
    result = db.forwarded_postbacks.update_many(
        {'offer_id': 'unknown'},
        {'$set': {
            'offer_id': click['offer_id'],
            'click_id': click['click_id'],
            'revenue': 90.0,
            'points': 45.0,
            'forward_status': 'success'
        }}
    )
    print(f"Updated {result.modified_count} test postbacks to point back to offer {click['offer_id']}")
