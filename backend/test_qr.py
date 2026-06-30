"""Find another active offer and set it to mobile for QR test"""
import sys
sys.path.insert(0, '.')
from database import db_instance

offers = db_instance.get_collection('offers')

# Find any active offer that isn't the one we already tried
result = offers.find_one(
    {
        'status': 'active',
        'target_url': {'$exists': True, '$ne': ''},
        'offer_id': {'$ne': 'ML-1827595'}
    },
    {'offer_id': 1, 'name': 1, 'status': 1, 'target_url': 1}
)

if result:
    offer_id = result['offer_id']
    print(f"Found: {offer_id} - {result['name']}")
    print(f"URL: {result['target_url'][:80]}")
    
    # Set to mobile
    offers.update_one({'offer_id': offer_id}, {'$set': {'device_targeting': 'mobile'}})
    print(f"\nUpdated to device_targeting='mobile'")
    print(f"\n>>> TEST URL: http://localhost:5000/track/{offer_id}?user_id=TEST")
else:
    print("No other active offer found")
