"""
Debug script to check approved/rejected offers structure
"""
from database import db_instance
from bson import ObjectId

username = "leopard"
users_col = db_instance.get_collection('users')
user = users_col.find_one({'username': username})

if not user:
    print(f"User '{username}' not found!")
    exit()

user_id = str(user['_id'])
print(f"\n=== USER INFO ===")
print(f"Username: {username}")
print(f"User ID: {user_id}")

# Check offers collection for approved_users field
print(f"\n=== CHECKING OFFERS WITH approved_users ===")
offers_col = db_instance.get_collection('offers')
if offers_col is not None:
    # Check if any offers have this user in approved_users
    approved_by_username = list(offers_col.find({'approved_users': username}, {'name': 1, 'offer_id': 1, 'approved_users': 1}).limit(5))
    print(f"Offers with username in approved_users: {len(approved_by_username)}")
    if approved_by_username:
        print("Sample:", approved_by_username[0])
    
    # Check sample offer structure
    sample_offer = offers_col.find_one({}, {'name': 1, 'offer_id': 1, 'approved_users': 1, 'approved_publishers': 1, 'publisher_access': 1})
    if sample_offer:
        print(f"\nSample offer structure:")
        print(f"  Fields: {list(sample_offer.keys())}")
        if 'approved_users' in sample_offer:
            print(f"  approved_users type: {type(sample_offer.get('approved_users'))}")
            print(f"  approved_users sample: {sample_offer.get('approved_users')}")

# Check affiliate_requests for approved requests
print(f"\n=== CHECKING AFFILIATE REQUESTS ===")
affiliate_requests = db_instance.get_collection('affiliate_requests')
if affiliate_requests is not None:
    # Check approved requests
    approved_reqs = list(affiliate_requests.find({
        'username': username,
        'status': 'approved'
    }, {'offer_id': 1, 'status': 1, 'offer_name': 1}).limit(10))
    print(f"Approved requests: {len(approved_reqs)}")
    if approved_reqs:
        print("Sample approved:", approved_reqs[0])
    
    # Check rejected requests
    rejected_reqs = list(affiliate_requests.find({
        'username': username,
        'status': 'rejected'
    }, {'offer_id': 1, 'status': 1, 'offer_name': 1, 'rejection_reason': 1}).limit(10))
    print(f"Rejected requests: {len(rejected_reqs)}")
    if rejected_reqs:
        print("Sample rejected:", rejected_reqs[0])
    
    # Check all statuses
    all_reqs = list(affiliate_requests.find({'username': username}, {'status': 1}))
    status_counts = {}
    for req in all_reqs:
        status = req.get('status', 'unknown')
        status_counts[status] = status_counts.get(status, 0) + 1
    print(f"\nAll request statuses: {status_counts}")

print("\n=== DONE ===")
