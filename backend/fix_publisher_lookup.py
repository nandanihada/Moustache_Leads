#!/usr/bin/env python3

from models.user import User
from models.placement import Placement
from bson import ObjectId

def fix_publisher_lookup():
    print("=== FIXING PUBLISHER LOOKUP ISSUE ===")
    
    user_model = User()
    placement_model = Placement()
    
    # Get all users
    users = list(user_model.collection.find({}, {'username': 1, 'email': 1, 'role': 1}))
    print(f"Available users ({len(users)}):")
    for user in users:
        print(f"  - {user['username']} (ID: {user['_id']}) - Role: {user.get('role', 'user')}")
    
    # Get all placements
    placements = list(placement_model.collection.find({}, {'publisherId': 1, 'offerwallTitle': 1}))
    print(f"\nPlacements ({len(placements)}):")
    
    orphaned_placements = []
    valid_placements = []
    
    for placement in placements:
        publisher_id = placement['publisherId']
        user = user_model.collection.find_one({'_id': publisher_id})
        
        if user:
            valid_placements.append((placement, user))
            print(f"  ✅ {placement['offerwallTitle']} -> {user['username']}")
        else:
            orphaned_placements.append(placement)
            print(f"  ❌ {placement['offerwallTitle']} -> ORPHANED (Publisher ID: {publisher_id})")
    
    print(f"\n📊 Summary:")
    print(f"  - Valid placements: {len(valid_placements)}")
    print(f"  - Orphaned placements: {len(orphaned_placements)}")
    
    if orphaned_placements:
        print(f"\n🔧 Fixing orphaned placements...")
        
        # Find a publisher user to assign orphaned placements to
        publisher_user = user_model.collection.find_one({'role': {'$in': ['user', 'publisher']}})
        
        if publisher_user:
            print(f"📝 Assigning orphaned placements to: {publisher_user['username']}")
            
            for placement in orphaned_placements:
                result = placement_model.collection.update_one(
                    {'_id': placement['_id']},
                    {'$set': {'publisherId': publisher_user['_id']}}
                )
                if result.modified_count > 0:
                    print(f"  ✅ Fixed: {placement['offerwallTitle']}")
                else:
                    print(f"  ❌ Failed to fix: {placement['offerwallTitle']}")
        else:
            print("❌ No publisher user found to assign orphaned placements")
    
    # Test the aggregation pipeline
    print(f"\n🧪 Testing aggregation pipeline...")
    placements, total, error = placement_model.get_all_placements_for_admin()
    
    if error:
        print(f"❌ Pipeline error: {error}")
    else:
        print(f"✅ Pipeline working! Found {total} placements")
        for placement in placements[:3]:
            print(f"  - {placement.get('offerwallTitle')} by {placement.get('publisherName', 'Unknown')}")

if __name__ == "__main__":
    fix_publisher_lookup()
