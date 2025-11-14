#!/usr/bin/env python3

from models.user import User
from models.placement import Placement
from bson import ObjectId

def debug_publisher_data():
    print("🔍 DEBUGGING PUBLISHER DATA")
    print("=" * 60)
    
    user_model = User()
    placement_model = Placement()
    
    try:
        # Test basic query
        print("1️⃣ Testing basic user query...")
        users = list(user_model.collection.find({}, {'username': 1, 'role': 1}).limit(5))
        print(f"Found {len(users)} users:")
        for user in users:
            print(f"  - {user.get('username')}: {user.get('role', 'no role')}")
        
        # Test publisher role query
        print(f"\n2️⃣ Testing publisher role query...")
        publishers = list(user_model.collection.find(
            {'role': {'$in': ['publisher', 'user']}},
            {'username': 1, 'role': 1, 'email': 1}
        ).limit(5))
        print(f"Found {len(publishers)} publishers:")
        for pub in publishers:
            print(f"  - {pub.get('username')}: {pub.get('role')} ({pub.get('email', 'no email')})")
        
        # Test placement stats for first publisher
        if publishers:
            pub_id = publishers[0]['_id']
            print(f"\n3️⃣ Testing placement stats for {publishers[0]['username']}...")
            
            placement_stats = list(placement_model.collection.aggregate([
                {'$match': {'publisherId': ObjectId(pub_id)}},
                {'$group': {
                    '_id': '$approvalStatus',
                    'count': {'$sum': 1}
                }}
            ]))
            
            print(f"Placement stats: {placement_stats}")
            
            # Count total placements
            total_placements = placement_model.collection.count_documents({'publisherId': ObjectId(pub_id)})
            print(f"Total placements: {total_placements}")
        
        print(f"\n✅ Database queries working correctly!")
        
    except Exception as e:
        print(f"❌ Database error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    debug_publisher_data()
