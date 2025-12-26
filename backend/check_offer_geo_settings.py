#!/usr/bin/env python3
"""
Check geo-restriction settings for an offer
"""

import sys
sys.path.append('.')

from database import db_instance
from bson import ObjectId

def check_offer_geo_settings(offer_id):
    """Check geo-restriction settings for an offer"""
    
    if not db_instance.is_connected():
        print("❌ Database not connected!")
        return
    
    offers_collection = db_instance.get_collection('offers')
    
    # Find the offer
    offer = offers_collection.find_one({'offer_id': offer_id})
    
    if not offer:
        print(f"❌ Offer {offer_id} not found!")
        return
    
    print(f"\n{'='*80}")
    print(f"  Geo-Restriction Settings for Offer: {offer_id}")
    print(f"{'='*80}\n")
    
    print(f"📝 Offer Name: {offer.get('name', 'N/A')}")
    print(f"📝 Campaign ID: {offer.get('campaign_id', 'N/A')}")
    print(f"📝 Status: {offer.get('status', 'N/A')}")
    print(f"\n{'='*80}")
    print(f"  GEO-RESTRICTION SETTINGS")
    print(f"{'='*80}\n")
    
    allowed_countries = offer.get('allowed_countries', [])
    non_access_url = offer.get('non_access_url', '')
    
    print(f"🌍 Allowed Countries: {allowed_countries}")
    print(f"   Type: {type(allowed_countries)}")
    print(f"   Count: {len(allowed_countries) if allowed_countries else 0}")
    
    if allowed_countries:
        print(f"   Countries:")
        for country in allowed_countries:
            print(f"     - {country}")
    else:
        print(f"   ⚠️  No restrictions (all countries allowed)")
    
    print(f"\n🔗 Non-Access URL: {non_access_url if non_access_url else '(not set)'}")
    
    print(f"\n{'='*80}")
    print(f"  OTHER TARGETING SETTINGS")
    print(f"{'='*80}\n")
    
    print(f"🌍 Countries (old field): {offer.get('countries', [])}")
    print(f"🌐 Languages: {offer.get('languages', [])}")
    print(f"📱 Device Targeting: {offer.get('device_targeting', 'all')}")
    
    print(f"\n{'='*80}")
    print(f"  RAW DATA")
    print(f"{'='*80}\n")
    
    # Show all fields related to geo
    geo_fields = {
        'allowed_countries': offer.get('allowed_countries'),
        'non_access_url': offer.get('non_access_url'),
        'countries': offer.get('countries'),
        'languages': offer.get('languages'),
        'device_targeting': offer.get('device_targeting'),
        'os_targeting': offer.get('os_targeting'),
        'browser_targeting': offer.get('browser_targeting'),
    }
    
    for field, value in geo_fields.items():
        print(f"{field}: {value}")
    
    print(f"\n{'='*80}\n")

if __name__ == '__main__':
    # Check ML-00135
    check_offer_geo_settings('ML-00135')
