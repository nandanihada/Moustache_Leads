"""
Fix AdscendMedia offers that were imported with network = publisher_id instead of 'adscendmedia'
Run once: python migrations/fix_adscendmedia_network_name.py
"""
import sys
sys.path.insert(0, '.')
from database import db_instance

def fix_network_name():
    offers_collection = db_instance.get_collection('offers')
    
    # Find offers where network is the publisher ID "115620" (or any numeric-looking value)
    # and network_type is 'adscendmedia' OR import_source is 'adscendmedia'
    query = {
        '$or': [
            {'network': '115620', 'import_source': 'adscendmedia'},
            {'network': '115620', 'network_type': 'adscendmedia'},
        ]
    }
    
    count = offers_collection.count_documents(query)
    print(f"Found {count} offers with network='115620' that should be 'adscendmedia'")
    
    if count == 0:
        print("Nothing to fix!")
        return
    
    result = offers_collection.update_many(
        query,
        {'$set': {'network': 'adscendmedia', 'network_publisher_id': '115620'}}
    )
    
    print(f"✅ Updated {result.modified_count} offers: network → 'adscendmedia'")

if __name__ == '__main__':
    fix_network_name()
