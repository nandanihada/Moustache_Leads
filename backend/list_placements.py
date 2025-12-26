#!/usr/bin/env python3
"""
Check placements and their postback URLs
"""

from database import db_instance

placements = db_instance.get_collection('placements')
all_placements = list(placements.find())

print(f"\n📋 Total placements: {len(all_placements)}\n")

for i, p in enumerate(all_placements, 1):
    title = p.get('offerwallTitle', 'Unknown')
    has_url = bool(p.get('postbackUrl'))
    url = p.get('postbackUrl', 'NOT SET')
    
    print(f"{i}. {title}")
    print(f"   postbackUrl: {'✅ ' + url if has_url else '❌ NOT SET'}")
    print()
