#!/usr/bin/env python3
"""
Update SurveyTitans postback URL to use correct parameter names
"""

from database import db_instance
from bson import ObjectId

# Get SurveyTitans placement
placements = db_instance.get_collection('placements')
surveytitans_id = ObjectId('690c8d103f9cfc24ca67966f')

st = placements.find_one({'_id': surveytitans_id})

if not st:
    print("❌ SurveyTitans placement not found!")
    exit(1)

print(f"\n✅ Found: {st.get('offerwallTitle')}")
print(f"\n📋 Current postbackUrl:")
print(f"   {st.get('postbackUrl')}")

# New URL with correct parameter names
new_url = "https://surveytitans.com/postback/d8e1bff1f46a956173cc91e51de5db63?user_id={username}&status={status}&points={payout}&transaction_id={transaction_id}"

print(f"\n📝 New postbackUrl:")
print(f"   {new_url}")

# Update
result = placements.update_one(
    {'_id': surveytitans_id},
    {'$set': {'postbackUrl': new_url}}
)

if result.modified_count > 0:
    print(f"\n✅ Updated successfully!")
    print(f"\n📋 Verification:")
    updated = placements.find_one({'_id': surveytitans_id})
    print(f"   {updated.get('postbackUrl')}")
else:
    print(f"\n⚠️ No changes made (URL might be the same)")
