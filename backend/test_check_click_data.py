#!/usr/bin/env python3
"""Check what's actually stored in database for a specific click"""

from database import db_instance
import json

# Connect to database
print("🔗 Connecting to database...")
db = db_instance.get_db()
print("✅ Connected")

# The click ID from the user's screenshot
click_id = "46aa5386-703b-4de3-8d98-fb6124a00067"

# Check offerwall_clicks_detailed collection
print(f"\n📊 Searching for click_id: {click_id}")
clicks_col = db_instance.get_collection('offerwall_clicks_detailed')
click = clicks_col.find_one({'click_id': click_id})

if click:
    print(f"✅ Click found in database!")
    print(f"\n📋 Full click document:")
    print(json.dumps(click, indent=2, default=str))
else:
    print(f"❌ Click NOT found in offerwall_clicks_detailed")
    
    # Check if it's in offerwall_clicks (old collection)
    old_clicks_col = db_instance.get_collection('offerwall_clicks')
    old_click = old_clicks_col.find_one({'click_id': click_id})
    
    if old_click:
        print(f"\n⚠️ Click found in OLD offerwall_clicks collection!")
        print(json.dumps(old_click, indent=2, default=str)[:500])
    else:
        print(f"❌ Click not found in any collection")
        
        # List all clicks to see what's there
        print(f"\n📊 All clicks in offerwall_clicks_detailed:")
        all_clicks = list(clicks_col.find().limit(3))
        for c in all_clicks:
            print(f"  - {c.get('click_id')}: user={c.get('user_id')}, device={c.get('device', {})}")
