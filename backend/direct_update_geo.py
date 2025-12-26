#!/usr/bin/env python3
"""
Directly update geo-restriction settings in database
"""

import sys
sys.path.append('.')

from database import db_instance
from datetime import datetime

def update_offer_geo_settings(offer_id, allowed_countries, non_access_url):
    """Directly update geo-restriction settings"""
    
    if not db_instance.is_connected():
        print("❌ Database not connected!")
        return False
    
    offers_collection = db_instance.get_collection('offers')
    
    # Update the offer
    result = offers_collection.update_one(
        {'offer_id': offer_id},
        {'$set': {
            'allowed_countries': allowed_countries,
            'non_access_url': non_access_url,
            'updated_at': datetime.utcnow()
        }}
    )
    
    if result.modified_count > 0:
        print(f"✅ Successfully updated offer {offer_id}")
        print(f"   Allowed Countries: {allowed_countries}")
        print(f"   Non-Access URL: {non_access_url}")
        return True
    else:
        print(f"❌ Failed to update offer {offer_id}")
        return False

if __name__ == '__main__':
    print("\n" + "="*80)
    print("  DIRECT DATABASE UPDATE - Geo-Restriction Settings")
    print("="*80 + "\n")
    
    # Update ML-00135 with India restriction
    success = update_offer_geo_settings(
        offer_id='ML-00135',
        allowed_countries=['IN'],
        non_access_url='https://www.example.com/not-available'
    )
    
    if success:
        print("\n✅ Update successful! Now checking the database...")
        print("\n" + "="*80 + "\n")
        
        # Import and run the check script
        from check_offer_geo_settings import check_offer_geo_settings
        check_offer_geo_settings('ML-00135')
    else:
        print("\n❌ Update failed!")
