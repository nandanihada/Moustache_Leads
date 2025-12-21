"""
Check placement configuration
"""
import sys
sys.path.append('.')

from database import db_instance

if not db_instance.is_connected():
    db_instance.connect()

print("="*80)
print("CHECKING PLACEMENT CONFIGURATION")
print("="*80)

placements = db_instance.get_collection('placements')
if placements is not None:
    # Try to find the placement
    placement = placements.find_one({
        '$or': [
            {'_id': 'zalUDOuAS0gaBh33'},
            {'placementId': 'zalUDOuAS0gaBh33'},
            {'placement_id': 'zalUDOuAS0gaBh33'}
        ]
    })
    
    if placement:
        print(f"\n✅ Found Placement:")
        print(f"   _id: {placement.get('_id')}")
        print(f"   placementId: {placement.get('placementId')}")
        print(f"   created_by: {placement.get('created_by')}")
        print(f"   user_id: {placement.get('user_id')}")
        print(f"   publisherId: {placement.get('publisherId')}")
        
        owner_id = placement.get('created_by') or placement.get('user_id') or placement.get('publisherId')
        print(f"\n   Owner ID: {owner_id}")
        
        # Check if owner exists in users collection
        if owner_id:
            users = db_instance.get_collection('users')
            if users is not None:
                try:
                    from bson import ObjectId
                    owner = users.find_one({'_id': ObjectId(owner_id)})
                except:
                    owner = users.find_one({'username': owner_id})
                
                if owner:
                    print(f"\n✅ Found Owner User:")
                    print(f"   Username: {owner.get('username')}")
                    print(f"   Postback URL: {owner.get('postback_url')}")
                    
                    if not owner.get('postback_url'):
                        print(f"\n❌ PROBLEM: Owner has NO postback_url configured!")
                        print(f"   This is why forwarding is failing.")
                else:
                    print(f"\n❌ PROBLEM: Owner user not found in users collection!")
        else:
            print(f"\n❌ PROBLEM: Placement has no owner!")
    else:
        print(f"\n❌ PROBLEM: Placement 'zalUDOuAS0gaBh33' not found!")
        print(f"   The placement doesn't exist in the database.")

print("="*80)
