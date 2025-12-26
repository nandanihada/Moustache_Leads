"""
Create the missing placement for SurveyTitans
"""
import sys
sys.path.append('.')

from database import db_instance
from datetime import datetime

if not db_instance.is_connected():
    db_instance.connect()

print("="*80)
print("CREATING PLACEMENT FOR SURVEYTITANS")
print("="*80)

# First, find the SurveyTitans user
users = db_instance.get_collection('users')
if users is not None:
    surveytitans_user = users.find_one({'username': 'surveytitans'})
    
    if not surveytitans_user:
        print("⚠️ SurveyTitans user not found. Creating...")
        # Create the user
        surveytitans_user = {
            'username': 'surveytitans',
            'email': 'admin@surveytitans.com',
            'role': 'publisher',
            'postback_url': 'https://surveytitans.com/postback/0591bfd36b464d6cce7b41f4de71e2a8?username={username}&status={status}&payout={points}&transaction_id={transaction_id}',
            'created_at': datetime.utcnow(),
            'status': 'active'
        }
        result = users.insert_one(surveytitans_user)
        surveytitans_user['_id'] = result.inserted_id
        print(f"✅ Created SurveyTitans user: {result.inserted_id}")
    else:
        print(f"✅ Found SurveyTitans user: {surveytitans_user.get('_id')}")
        
        # Update postback URL if not set
        if not surveytitans_user.get('postback_url'):
            users.update_one(
                {'_id': surveytitans_user['_id']},
                {'$set': {
                    'postback_url': 'https://surveytitans.com/postback/0591bfd36b464d6cce7b41f4de71e2a8?username={username}&status={status}&payout={points}&transaction_id={transaction_id}'
                }}
            )
            print(f"✅ Updated postback URL")
    
    # Now create the placement
    placements = db_instance.get_collection('placements')
    if placements is not None:
        placement = {
            '_id': 'zalUDOuAS0gaBh33',
            'placementId': 'zalUDOuAS0gaBh33',
            'placement_id': 'zalUDOuAS0gaBh33',
            'offerwallTitle': 'SurveyTitans Offerwall',
            'created_by': str(surveytitans_user['_id']),
            'user_id': str(surveytitans_user['_id']),
            'publisherId': str(surveytitans_user['_id']),
            'status': 'active',
            'created_at': datetime.utcnow()
        }
        
        try:
            placements.insert_one(placement)
            print(f"\n✅ Created placement: zalUDOuAS0gaBh33")
            print(f"   Owner: {surveytitans_user.get('username')}")
            print(f"   Postback URL: {surveytitans_user.get('postback_url')}")
        except Exception as e:
            if 'duplicate key' in str(e):
                print(f"\n✅ Placement already exists")
            else:
                print(f"\n❌ Error creating placement: {e}")

print("="*80)
print("✅ Setup complete! Now test the postback again.")
print("="*80)
