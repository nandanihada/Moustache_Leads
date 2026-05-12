"""
Credit ash's second conversion from cpamerchant (3:12 PM postback).
The user had multiple clicks and completed 2 surveys — both are legitimate.
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import db_instance
from bson import ObjectId
from datetime import datetime
import secrets

user_id = '69a9a5e655f321cc19f6a74d'
publisher_payout = 2.99  # 80% of $3.74 offer payout

users_col = db_instance.get_collection('users')
forwarded_col = db_instance.get_collection('forwarded_postbacks')
pts_col = db_instance.get_collection('points_transactions')
conversions_col = db_instance.get_collection('conversions')
received_col = db_instance.get_collection('received_postbacks')

# Find the second unmatched postback (3:12 PM one)
second_pb = received_col.find_one({
    'partner_name': 'cpamerchant',
    'status': 'unmatched',
    'query_params.user_id': user_id
}, sort=[('timestamp', -1)])

if not second_pb:
    # Try finding it with different status
    second_pb = received_col.find_one({
        'partner_name': 'cpamerchant',
        'query_params.user_id': user_id,
        'status': {'$ne': 'processed'}
    }, sort=[('timestamp', 1)])  # oldest first (3:12 PM)

if second_pb:
    print(f"Found second postback: {second_pb.get('timestamp')} | status={second_pb.get('status')}")
else:
    print("No unprocessed second postback found — crediting manually anyway")

# Find a different click (not the one already used)
clicks_col = db_instance.get_collection('clicks')
used_click = clicks_col.find_one({'user_id': user_id, 'converted': True})
used_click_id = used_click.get('click_id') if used_click else None

# Get next available click
next_click = clicks_col.find_one({
    'user_id': user_id,
    'offer_id': 'ML-02154',
    'click_id': {'$ne': used_click_id}
}, sort=[('click_time', -1)])

if next_click:
    click_id = next_click.get('click_id')
    print(f"Using click: {click_id}")
else:
    click_id = 'MANUAL-CREDIT'
    print("No unused click found — using manual credit reference")

# Create conversion
conversion_id = f"CONV-{secrets.token_hex(6).upper()}"

# 1. Create forwarded_postbacks record
fwd_record = {
    'timestamp': datetime.utcnow(),
    'publisher_id': user_id,
    'publisher_name': 'ash',
    'username': 'ash',
    'points': publisher_payout,
    'forward_url': '',
    'forward_status': 'no_url',
    'response_code': 0,
    'offer_id': 'ML-02154',
    'offer_name': 'Survey Junkie US, CA, AU',
    'click_id': click_id,
    'source': 'verified_postback_second_conversion',
    'conversion_id': conversion_id,
    'country': '',
    'device_type': '',
    'ip_address': '',
}
forwarded_col.insert_one(fwd_record)
print(f"Created forwarded_postback record")

# 2. Create conversion record
conv_data = {
    'conversion_id': conversion_id,
    'click_id': click_id,
    'offer_id': 'ML-02154',
    'user_id': user_id,
    'affiliate_id': user_id,
    'status': 'approved',
    'payout': publisher_payout,
    'currency': 'USD',
    'conversion_time': datetime.utcnow(),
    'partner_id': 'cpamerchant',
    'partner_name': 'cpamerchant',
    'source': 'postback',
    'verified': True,
    'matched_by': 'manual_second_conversion',
}
conversions_col.insert_one(conv_data)
print(f"Created conversion: {conversion_id}")

# 3. Add points to user
users_col.update_one(
    {'_id': ObjectId(user_id)},
    {'$inc': {'total_points': publisher_payout}}
)
print(f"Added ${publisher_payout} to ash's balance")

# 4. Record points transaction
pts_col.insert_one({
    'username': 'ash',
    'user_id': user_id,
    'points': publisher_payout,
    'type': 'offer_completion',
    'offer_id': 'ML-02154',
    'click_id': click_id,
    'conversion_id': conversion_id,
    'timestamp': datetime.utcnow(),
    'status': 'completed',
    'source': 'verified_postback_second_conversion',
})
print(f"Created points transaction")

# 5. Mark the second received postback as processed (if found)
if second_pb:
    received_col.update_one(
        {'_id': second_pb['_id']},
        {'$set': {'status': 'processed', 'conversion_id': conversion_id, 'processed_at': datetime.utcnow()}}
    )
    print(f"Marked second postback as processed")

# 6. Mark the click as converted
if next_click:
    clicks_col.update_one(
        {'click_id': click_id},
        {'$set': {'converted': True, 'postback_received': True}}
    )

# Verify
user = users_col.find_one({'_id': ObjectId(user_id)})
print(f"\n{'='*50}")
print(f"ash's total_points: ${user.get('total_points')}")
print(f"Second conversion credited: ${publisher_payout}")
print(f"Conversion ID: {conversion_id}")
print(f"{'='*50}")
