"""
Test the postback receiver with the new logic
"""
import sys
sys.path.append('.')

from database import db_instance

# Connect
if not db_instance.is_connected():
    db_instance.connect()

print("Testing postback receiver logic...")
print("="*80)

# 1. Add external offer mapping
offers = db_instance.get_collection('offers')
if offers is not None:
    result = offers.update_one(
        {'offer_id': 'ML-00057'},
        {'$set': {'external_offer_id': 'VBFS6'}},
        upsert=False
    )
    print(f"✅ Added external_offer_id mapping: VBFS6 → ML-00057")
    print(f"   Modified: {result.modified_count} document(s)")
else:
    print("❌ Could not get offers collection")

# 2. Check if click exists
clicks = db_instance.get_collection('clicks')
if clicks is not None:
    click = clicks.find_one({'offer_id': 'ML-00057'}, sort=[('timestamp', -1)])
    if click:
        print(f"✅ Found click in 'clicks': user={click.get('user_id')}, placement={click.get('placement_id')}")
    else:
        print("⚠️ No click found for ML-00057 in 'clicks' collection")
else:
    print("❌ Could not get clicks collection")

# 3. Check offerwall_clicks_detailed
offerwall_clicks = db_instance.get_collection('offerwall_clicks_detailed')
if offerwall_clicks is not None:
    ow_click = offerwall_clicks.find_one({'offer_id': 'ML-00057'}, sort=[('timestamp', -1)])
    if ow_click:
        print(f"✅ Found click in 'offerwall_clicks_detailed': user={ow_click.get('user_id')}, placement={ow_click.get('placement_id')}")
    else:
        print("⚠️ No click found for ML-00057 in 'offerwall_clicks_detailed'")
else:
    print("⚠️ offerwall_clicks_detailed collection not found")

print("="*80)
print("✅ Setup complete! Now test by completing an offer.")
