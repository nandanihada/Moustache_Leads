"""
Debug script to check Leopard Mak's actual data
"""
from database import db_instance
from bson import ObjectId

# Find Leopard Mak user
users_col = db_instance.get_collection('users')
user = users_col.find_one({'username': 'leopard'})

if not user:
    print("❌ User 'leopard' not found")
    print("\nSearching for similar usernames...")
    similar = list(users_col.find({'username': {'$regex': 'leopard', '$options': 'i'}}))
    for u in similar:
        print(f"  Found: {u.get('username')} (ID: {u['_id']})")
    exit()

user_id = str(user['_id'])
username = user.get('username')
email = user.get('email')

print(f"✅ Found user: {username}")
print(f"   ID: {user_id}")
print(f"   Email: {email}")
print(f"   Level: {user.get('level', 'L1')}")
print("\n" + "="*80)

# Check affiliate_requests
print("\n📋 CHECKING AFFILIATE_REQUESTS:")
affiliate_requests = db_instance.get_collection('affiliate_requests')

# Try all possible field combinations
queries = [
    {'user_id': user_id},
    {'user_id': ObjectId(user_id)},
    {'publisher_id': user_id},
    {'publisher_id': ObjectId(user_id)},
    {'username': username},
    {'email': email}
]

total_found = 0
for query in queries:
    count = affiliate_requests.count_documents(query)
    if count > 0:
        print(f"  ✅ Query {query}: Found {count} requests")
        total_found += count
        
        # Show samples
        samples = list(affiliate_requests.find(query).limit(3))
        for req in samples:
            print(f"     - Offer: {req.get('offer_id')}, Status: {req.get('status')}")

if total_found == 0:
    print("  ❌ NO affiliate requests found with any query")
    print("\n  Checking what fields exist in affiliate_requests...")
    sample = affiliate_requests.find_one()
    if sample:
        print(f"  Sample document fields: {list(sample.keys())}")

# Check clicks
print("\n📍 CHECKING CLICKS:")
clicks_col = db_instance.get_collection('clicks')

click_queries = [
    {'user_id': user_id},
    {'affiliate_id': user_id},
    {'publisher_id': user_id},
    {'username': username}
]

total_clicks = 0
for query in click_queries:
    count = clicks_col.count_documents(query)
    if count > 0:
        print(f"  ✅ Query {query}: Found {count} clicks")
        total_clicks += count

if total_clicks == 0:
    print("  ❌ NO clicks found")

print("\n" + "="*80)
print(f"\n📊 SUMMARY FOR {username}:")
print(f"   Total affiliate requests: {total_found}")
print(f"   Total clicks: {total_clicks}")

if total_found == 0 and total_clicks == 0:
    print("\n❌ NO DATA FOUND - This user has no activity in the database")
else:
    print("\n✅ DATA EXISTS - Frontend should show this data")
    print("\n🔍 If frontend shows 0, check:")
    print("   1. Browser console for API response")
    print("   2. Backend logs for query results")
    print("   3. Field name matching in queries")
