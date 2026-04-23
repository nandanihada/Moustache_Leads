import re
from pymongo import MongoClient

c = MongoClient('mongodb+srv://nan_db_user:j6trrN5m33t4Jwz8@mustache.0gly4in.mongodb.net/ascend_db?retryWrites=true&w=majority&appName=Mustache&tlsAllowInvalidCertificates=true')
db = c['ascend_db']

leopard_user_id = '69c0af4ff221f1dd8be0cd22'

# Find the click for leopard on scrambly
click = db.clicks.find_one({'user_id': leopard_user_id, 'offer_name': {'$regex': re.compile('scrambly', re.IGNORECASE)}})

if click:
    res = db.forwarded_postbacks.update_many(
        {'offer_id': 'ML-02122'},
        {'$set': {
            'offer_id': click['offer_id'],
            'click_id': click['click_id'],
            'publisher_id': click.get('user_id'),
            'publisher_name': 'leopard',
            'username': 'leopard'
        }}
    )
    print(f"Patched {res.modified_count} conversions to {click['offer_id']} and publisher leopard")
else:
    print('Leopard scrambly click not found')
