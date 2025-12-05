#!/usr/bin/env python3
"""
Find SurveyTitans in partners collection
"""

from database import db_instance

partners = db_instance.get_collection('partners')
surveytitans = partners.find_one({'partner_name': {'$regex': 'survey', '$options': 'i'}})

if surveytitans:
    print("\n✅ Found in partners collection:")
    print(f"   Name: {surveytitans.get('partner_name')}")
    print(f"   Partner ID: {surveytitans.get('partner_id')}")
    print(f"   Postback URL: {surveytitans.get('postback_url')}")
    
    # Now find matching placement
    print("\n🔍 Looking for matching placement...")
    placements = db_instance.get_collection('placements')
    
    # Try to find by similar name
    placement = placements.find_one({'offerwallTitle': {'$regex': 'survey', '$options': 'i'}})
    
    if placement:
        print(f"\n✅ Found placement:")
        print(f"   Title: {placement.get('offerwallTitle')}")
        print(f"   ID: {placement.get('_id')}")
        print(f"   Has postbackUrl: {bool(placement.get('postbackUrl'))}")
    else:
        print(f"\n❌ No matching placement found")
        print(f"\n📋 All placements:")
        all_p = list(placements.find())
        for p in all_p[:10]:
            print(f"   - {p.get('offerwallTitle')}")
else:
    print("\n❌ SurveyTitans not found in partners collection")
