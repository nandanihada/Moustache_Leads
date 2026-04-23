from pymongo import MongoClient

c = MongoClient('mongodb+srv://nan_db_user:j6trrN5m33t4Jwz8@mustache.0gly4in.mongodb.net/ascend_db?retryWrites=true&w=majority&appName=Mustache&tlsAllowInvalidCertificates=true')
db = c['ascend_db']

res = db.forwarded_postbacks.update_many(
    {'offer_id': 'ML-02122', 'publisher_name': 'leopard'},
    {'$set': {
        'country': 'US',
        'device_type': 'mobile',
        'browser': 'Safari'
    }}
)
print(f"Patched {res.modified_count} conversions with US/mobile/Safari geo data")
