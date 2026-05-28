"""
Migration: Fix offers that have API URL stored as network name.
These were imported via Everflow API where the URL was incorrectly used as the network name.
"""
from database import db_instance
from datetime import datetime

def run():
    """Fix network names that contain URLs"""
    offers_col = db_instance.get_collection('offers')
    if offers_col is None:
        print("❌ Cannot connect to offers collection")
        return
    
    # Find all offers where network field contains a URL
    url_pattern = {'network': {'$regex': '^https?://', '$options': 'i'}}
    affected = offers_col.count_documents(url_pattern)
    print(f"🔍 Found {affected} offers with URL as network name")
    
    if affected == 0:
        print("✅ No offers to fix")
        return
    
    # Show sample
    samples = list(offers_col.find(url_pattern, {'offer_id': 1, 'name': 1, 'network': 1}).limit(5))
    print("\n📋 Sample offers:")
    for s in samples:
        print(f"  - {s.get('offer_id')}: {s.get('name')[:40]} | network: {s.get('network')[:60]}")
    
    # Extract clean network name from URL
    from urllib.parse import urlparse
    
    # Group by URL to see what domains are involved
    distinct_networks = offers_col.distinct('network', url_pattern)
    print(f"\n🌐 Distinct URL-based networks ({len(distinct_networks)}):")
    
    for url in distinct_networks:
        try:
            parsed = urlparse(url)
            domain = parsed.hostname or ''
            parts = domain.replace('api.', '').replace('www.', '').split('.')
            clean_name = parts[0].capitalize() if parts else 'Everflow'
            count = offers_col.count_documents({'network': url})
            print(f"  {url[:60]} -> '{clean_name}' ({count} offers)")
            
            # Update all offers with this URL to the clean name
            result = offers_col.update_many(
                {'network': url},
                {'$set': {'network': clean_name, 'network_api_url': url, 'updated_at': datetime.utcnow()}}
            )
            print(f"    ✅ Updated {result.modified_count} offers")
        except Exception as e:
            print(f"    ❌ Error: {e}")
    
    # Final count
    remaining = offers_col.count_documents(url_pattern)
    print(f"\n{'='*50}")
    print(f"✅ Migration complete. Remaining URL networks: {remaining}")

if __name__ == '__main__':
    run()
