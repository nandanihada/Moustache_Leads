#!/usr/bin/env python
"""
Test: Check detailed click document in database
"""
from database import db_instance
import json

print("=" * 100)
print("🔍 CHECKING DETAILED CLICK DOCUMENT")
print("=" * 100)

try:
    clicks_col = db_instance.get_collection('offerwall_clicks_detailed')
    
    # Get the most recent click
    click = clicks_col.find_one(
        {'user_id': 'test_user_comprehensive_full'},
        sort=[('timestamp', -1)]
    )
    
    if click:
        print("\n✅ Found click document!")
        print("\n📄 FULL DOCUMENT STRUCTURE:")
        
        # Remove ObjectId for JSON serialization
        if '_id' in click:
            del click['_id']
        
        print(json.dumps(click, indent=2, default=str))
        
        print("\n✅ DOCUMENT RETRIEVED SUCCESSFULLY!")
    else:
        print("\n❌ No click found!")
        
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()

print("\n" + "=" * 100)
