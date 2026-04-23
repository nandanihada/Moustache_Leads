"""
Test the user offers endpoint directly
"""
from database import db_instance
from bson import ObjectId
import sys
sys.path.insert(0, '.')

from routes.user_offers import get_user_offers
from flask import Flask
from unittest.mock import Mock

app = Flask(__name__)

# Find leopard user
username = "leopard"
users_col = db_instance.get_collection('users')
user = users_col.find_one({'username': username})

if not user:
    print(f"User '{username}' not found!")
    exit()

user_id = str(user['_id'])
print(f"Testing endpoint for user_id: {user_id}")

# Mock the request
mock_request = Mock()
mock_request.current_user = {'_id': ObjectId('507f1f77bcf86cd799439011'), 'role': 'admin'}

# Import the function
from routes.user_offers import user_offers_bp
from flask import request
import routes.user_offers as uo

# Manually call the logic
try:
    offers_collection = db_instance.get_collection('offers')
    users_collection = db_instance.get_collection('users')
    target_user = users_collection.find_one({'_id': ObjectId(user_id)})
    
    if not target_user:
        print('User not found')
        exit()
    
    username = target_user.get('username')
    email = target_user.get('email')
    
    print(f"\nUser: {username}, Email: {email}")
    
    # Get approved offers from affiliate_requests
    affiliate_requests = db_instance.get_collection('affiliate_requests')
    approved_offers_formatted = []
    rejected_offers_data = []
    
    if affiliate_requests is not None:
        # Get approved requests
        approved_requests = list(affiliate_requests.find({
            '$or': [{'publisher_id': user_id}, {'username': username}],
            'status': 'approved'
        }).limit(50))
        
        print(f"\nApproved requests found: {len(approved_requests)}")
        
        for req in approved_requests:
            offer = offers_collection.find_one({'offer_id': req.get('offer_id')})
            if offer:
                approved_offers_formatted.append({
                    'id': offer.get('offer_id'),
                    'name': offer.get('name'),
                    'network': offer.get('network', 'N/A'),
                    'payout': offer.get('payout', 0)
                })
            else:
                approved_offers_formatted.append({
                    'id': req.get('offer_id'),
                    'name': req.get('offer_name', 'Unknown Offer'),
                    'network': 'N/A',
                    'payout': 0
                })
        
        print(f"Approved offers formatted: {len(approved_offers_formatted)}")
        if approved_offers_formatted:
            print("Sample:", approved_offers_formatted[0])
        
        # Get rejected requests
        rejected_requests = list(affiliate_requests.find({
            '$or': [{'publisher_id': user_id}, {'username': username}],
            'status': 'rejected'
        }).limit(50))
        
        print(f"\nRejected requests found: {len(rejected_requests)}")
        
        for req in rejected_requests:
            offer = offers_collection.find_one({'offer_id': req.get('offer_id')})
            if offer:
                rejected_offers_data.append({
                    'id': offer.get('offer_id'),
                    'name': offer.get('name'),
                    'network': offer.get('network', 'N/A'),
                    'payout': offer.get('payout', 0),
                    'reason': req.get('rejection_reason', 'Not specified')
                })
            else:
                rejected_offers_data.append({
                    'id': req.get('offer_id'),
                    'name': req.get('offer_name', 'Unknown Offer'),
                    'network': 'N/A',
                    'payout': 0,
                    'reason': req.get('rejection_reason', 'Not specified')
                })
        
        print(f"Rejected offers formatted: {len(rejected_offers_data)}")
        if rejected_offers_data:
            print("Sample:", rejected_offers_data[0])
    
    print("\n=== SUCCESS ===")
    print(f"Total approved: {len(approved_offers_formatted)}")
    print(f"Total rejected: {len(rejected_offers_data)}")
    
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()
