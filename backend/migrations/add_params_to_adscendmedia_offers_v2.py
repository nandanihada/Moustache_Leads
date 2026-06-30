"""
Add SB1, TYP, OID parameters to all existing AdscendMedia offer URLs (bulk version).
Run once: python migrations/add_params_to_adscendmedia_offers_v2.py
"""
import sys
sys.path.insert(0, '.')
from database import db_instance
from pymongo import UpdateOne

def add_params():
    offers_col = db_instance.get_collection('offers')
    
    # Find adscendmedia offers that DON'T already have SB1 in their URL
    query = {
        'network': 'adscendmedia',
        'target_url': {'$exists': True, '$ne': '', '$not': {'$regex': 'SB1='}},
    }
    offers = list(offers_col.find(query, {'_id': 1, 'target_url': 1}))
    
    print(f"Found {len(offers)} adscendmedia offers needing params")
    
    if not offers:
        print("Nothing to update!")
        return
    
    # Build bulk operations
    ops = []
    for offer in offers:
        url = offer['target_url']
        separator = '&' if '?' in url else '?'
        new_url = url + separator + 'SB1={sub1}&TYP={sub_id1}&OID={offer_id}'
        ops.append(UpdateOne({'_id': offer['_id']}, {'$set': {'target_url': new_url}}))
    
    # Execute in batches of 500
    batch_size = 500
    total_updated = 0
    for i in range(0, len(ops), batch_size):
        batch = ops[i:i+batch_size]
        result = offers_col.bulk_write(batch)
        total_updated += result.modified_count
        print(f"  Batch {i//batch_size + 1}: updated {result.modified_count}")
    
    print(f"✅ Done! Updated {total_updated} offers total")

if __name__ == '__main__':
    add_params()
