#!/usr/bin/env python3
"""
Check masked links and domains
"""

import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from database import db_instance

def check_masked_links():
    """Check masking domains and links"""
    
    print("\n🔗 MASKED LINK STATUS")
    print("="*70)
    
    # Check masking domains
    domains_collection = db_instance.get_collection('masking_domains')
    links_collection = db_instance.get_collection('masked_links')
    offers_collection = db_instance.get_collection('offers')
    
    if domains_collection is None:
        print("❌ Database connection failed")
        return
    
    # Get domains
    domains = list(domains_collection.find({}))
    print(f"\n📍 MASKING DOMAINS: {len(domains)}")
    
    if domains:
        for domain in domains:
            print(f"\n  Domain: {domain.get('domain')}")
            print(f"  Active: {domain.get('is_active')}")
            print(f"  Created: {domain.get('created_at')}")
    else:
        print("  ⚠️  No masking domains found!")
    
    # Get masked links
    links = list(links_collection.find({}))
    print(f"\n🔗 MASKED LINKS: {len(links)}")
    
    if links:
        for link in links[:5]:  # Show first 5
            print(f"\n  Masked URL: {link.get('masked_url')}")
            print(f"  Target URL: {link.get('target_url')[:50]}...")
            print(f"  Offer ID: {link.get('offer_id')}")
            print(f"  Active: {link.get('is_active')}")
    
    # Check offers with masked URLs
    offers = list(offers_collection.find({}))
    print(f"\n📦 OFFERS WITH MASKED LINKS:")
    
    for offer in offers:
        masked_url = offer.get('masked_url', 'N/A')
        print(f"\n  Offer: {offer.get('name')}")
        print(f"  Offer ID: {offer.get('offer_id')}")
        print(f"  Masked URL: {masked_url}")
        print(f"  Target URL: {offer.get('target_url', 'N/A')[:50]}...")
    
    print("\n" + "="*70)
    
    # Recommendations
    if not domains:
        print("\n⚠️  NO MASKING DOMAINS!")
        print("\n💡 SOLUTION:")
        print("   Need to create a custom masking domain")
        print("   I'll create one for you...")
    elif not links:
        print("\n⚠️  NO MASKED LINKS!")
        print("\n💡 SOLUTION:")
        print("   Links should be auto-created when offers are made")

if __name__ == '__main__':
    check_masked_links()
