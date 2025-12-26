#!/usr/bin/env python3
"""
Comprehensive check of all URL fields in offers
"""

from database import db_instance
import logging

logging.basicConfig(level=logging.INFO, format='%(message)s')
logger = logging.getLogger(__name__)

def check_all_urls():
    """Check all URL fields in offers"""
    
    try:
        offers_collection = db_instance.get_collection('offers')
        
        if offers_collection is None:
            print("❌ Could not access offers collection")
            return
        
        # Get a sample offer to see all fields
        sample_offer = offers_collection.find_one()
        
        if not sample_offer:
            print("❌ No offers found in database")
            return
        
        print("\n📋 Sample Offer Fields:")
        print("="*80)
        print(f"Offer ID: {sample_offer.get('offer_id', 'Unknown')}")
        print(f"Name: {sample_offer.get('name', 'Unknown')}")
        print("\nURL Fields:")
        print("-"*80)
        
        url_fields = ['target_url', 'masked_url', 'tracking_url', 'click_url', 'url', 'destination_url']
        
        for field in url_fields:
            value = sample_offer.get(field, 'N/A')
            if value != 'N/A' and ':5000' in str(value):
                print(f"⚠️  {field}: {value}")
            elif value != 'N/A':
                print(f"✅ {field}: {value}")
            else:
                print(f"   {field}: {value}")
        
        print("\n" + "="*80)
        print("\n🔍 Checking ALL offers for :5000 in ANY field...")
        print("-"*80)
        
        # Check all offers for :5000 in any field
        all_offers = list(offers_collection.find())
        print(f"\nTotal offers in database: {len(all_offers)}")
        
        issues_found = []
        
        for offer in all_offers:
            offer_id = offer.get('offer_id', 'Unknown')
            for field in url_fields:
                value = offer.get(field, '')
                if value and ':5000' in str(value):
                    issues_found.append({
                        'offer_id': offer_id,
                        'field': field,
                        'value': value
                    })
        
        if issues_found:
            print(f"\n⚠️  Found {len(issues_found)} URL fields with :5000:\n")
            for issue in issues_found:
                print(f"Offer: {issue['offer_id']}")
                print(f"  Field: {issue['field']}")
                print(f"  Value: {issue['value']}")
                print()
        else:
            print("\n✅ No :5000 found in any URL fields!")
            print("✅ All URLs are correct!")
        
        # Also check if there are any offers at all
        print(f"\n📊 Database Statistics:")
        print(f"  Total offers: {len(all_offers)}")
        print(f"  Active offers: {offers_collection.count_documents({'status': 'active'})}")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    print("="*80)
    print("🔍 Comprehensive URL Checker")
    print("="*80)
    check_all_urls()
