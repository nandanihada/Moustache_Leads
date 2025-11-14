#!/usr/bin/env python3

from models.user import User
from models.placement import Placement
from bson import ObjectId

def test_route_logic():
    print("🔍 TESTING ROUTE LOGIC DIRECTLY")
    print("=" * 60)
    
    try:
        # Simulate the exact logic from the route
        page = 1
        size = 20
        search = ''
        status_filter = 'all'
        
        user_model = User()
        placement_model = Placement()
        
        print("1️⃣ Building query filter...")
        # Build query filter
        query_filter = {'role': {'$in': ['publisher', 'user']}}
        
        if search:
            query_filter['$or'] = [
                {'username': {'$regex': search, '$options': 'i'}},
                {'email': {'$regex': search, '$options': 'i'}},
                {'firstName': {'$regex': search, '$options': 'i'}},
                {'lastName': {'$regex': search, '$options': 'i'}},
                {'companyName': {'$regex': search, '$options': 'i'}}
            ]
        
        if status_filter == 'active':
            query_filter['status'] = {'$ne': 'blocked'}
        elif status_filter == 'blocked':
            query_filter['status'] = 'blocked'
        
        print(f"Query filter: {query_filter}")
        
        print("2️⃣ Getting total count...")
        # Get total count
        total = user_model.collection.count_documents(query_filter)
        print(f"Total publishers: {total}")
        
        print("3️⃣ Getting publishers with pagination...")
        # Get publishers with pagination
        skip = (page - 1) * size
        publishers = list(user_model.collection.find(
            query_filter,
            {
                'password': 1,
                'username': 1,
                'email': 1,
                'firstName': 1,
                'lastName': 1,
                'companyName': 1,
                'website': 1,
                'postbackUrl': 1,
                'role': 1,
                'status': 1,
                'created_at': 1,
                'updated_at': 1,
                'lastLogin': 1
            }
        ).sort('created_at', -1).skip(skip).limit(size))
        
        print(f"Found {len(publishers)} publishers")
        
        print("4️⃣ Getting placement statistics...")
        # Get placement statistics for each publisher
        publisher_list = []
        for i, publisher in enumerate(publishers):
            print(f"Processing publisher {i+1}: {publisher.get('username')}")
            publisher_id = str(publisher['_id'])
            
            # Get placement stats
            try:
                placement_stats = placement_model.collection.aggregate([
                    {'$match': {'publisherId': ObjectId(publisher_id)}},
                    {'$group': {
                        '_id': '$approvalStatus',
                        'count': {'$sum': 1}
                    }}
                ])
                
                stats = {'total': 0, 'approved': 0, 'pending': 0, 'rejected': 0}
                for stat in placement_stats:
                    status = stat['_id']
                    count = stat['count']
                    stats['total'] += count
                    if status == 'APPROVED':
                        stats['approved'] = count
                    elif status == 'PENDING_APPROVAL':
                        stats['pending'] = count
                    elif status == 'REJECTED':
                        stats['rejected'] = count
                
                print(f"  Stats: {stats}")
                
                publisher_data = {
                    'id': publisher_id,
                    'username': publisher['username'],
                    'email': publisher['email'],
                    'firstName': publisher.get('firstName', ''),
                    'lastName': publisher.get('lastName', ''),
                    'companyName': publisher.get('companyName', ''),
                    'website': publisher.get('website', ''),
                    'postbackUrl': publisher.get('postbackUrl', ''),
                    'role': publisher.get('role', 'user'),
                    'status': publisher.get('status', 'active'),
                    'password': publisher.get('password', ''),
                    'createdAt': publisher['created_at'].isoformat() if publisher.get('created_at') else None,
                    'updatedAt': publisher.get('updated_at').isoformat() if publisher.get('updated_at') else None,
                    'lastLogin': publisher.get('lastLogin').isoformat() if publisher.get('lastLogin') else None,
                    'placementStats': stats
                }
                publisher_list.append(publisher_data)
                
            except Exception as stat_error:
                print(f"  ❌ Error getting stats for {publisher.get('username')}: {stat_error}")
                # Continue with empty stats
                publisher_data = {
                    'id': publisher_id,
                    'username': publisher['username'],
                    'email': publisher['email'],
                    'firstName': publisher.get('firstName', ''),
                    'lastName': publisher.get('lastName', ''),
                    'companyName': publisher.get('companyName', ''),
                    'website': publisher.get('website', ''),
                    'postbackUrl': publisher.get('postbackUrl', ''),
                    'role': publisher.get('role', 'user'),
                    'status': publisher.get('status', 'active'),
                    'password': publisher.get('password', ''),
                    'createdAt': publisher['created_at'].isoformat() if publisher.get('created_at') else None,
                    'updatedAt': publisher.get('updated_at').isoformat() if publisher.get('updated_at') else None,
                    'lastLogin': publisher.get('lastLogin').isoformat() if publisher.get('lastLogin') else None,
                    'placementStats': {'total': 0, 'approved': 0, 'pending': 0, 'rejected': 0}
                }
                publisher_list.append(publisher_data)
        
        print(f"\n✅ Route logic completed successfully!")
        print(f"📊 Final result: {len(publisher_list)} publishers processed")
        
        # Show first publisher as example
        if publisher_list:
            print(f"\n📋 Example publisher:")
            first_pub = publisher_list[0]
            for key, value in first_pub.items():
                if key != 'password':  # Don't print full password
                    print(f"  {key}: {value}")
                else:
                    print(f"  {key}: {'*' * len(str(value)) if value else 'None'}")
        
    except Exception as e:
        print(f"❌ Error in route logic: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_route_logic()
