"""
Find the correct offer_id from recent clicks and update mapping
"""
import sys
sys.path.append('.')

from database import db_instance

if not db_instance.is_connected():
    db_instance.connect()

print("="*80)
print("FIXING OFFER MAPPING")
print("="*80)

# 1. Find the most recent click for Don1
clicks = db_instance.get_collection('clicks')
if clicks is not None:
    click = clicks.find_one(
        {'user_id': 'Don1'},
        sort=[('timestamp', -1)]
    )
else:
    click = None

if not click:
    # Try offerwall_clicks_detailed
    offerwall_clicks = db_instance.get_collection('offerwall_clicks_detailed')
    if offerwall_clicks is not None:
        click = offerwall_clicks.find_one(
            {'user_id': 'Don1'},
            sort=[('timestamp', -1)]
        )

if click:
    print(f"\n✅ Found recent click:")
    print(f"   User: {click.get('user_id')}")
    print(f"   Offer ID: {click.get('offer_id')}")
    print(f"   Click ID: {click.get('click_id')}")
    
    correct_offer_id = click.get('offer_id')
    
    # 2. Update the mapping
    offers = db_instance.get_collection('offers')
    if offers is not None and correct_offer_id:
        # Update the offer with external_offer_id
        result = offers.update_one(
            {'offer_id': correct_offer_id},
            {'$set': {'external_offer_id': 'VBFS6'}}
        )
        
        if result.modified_count > 0 or result.matched_count > 0:
            print(f"\n✅ Updated mapping: VBFS6 → {correct_offer_id}")
        else:
            print(f"\n⚠️ Offer {correct_offer_id} not found in database")
            
        # Also remove old mapping from ML-00057 if it exists
        offers.update_one(
            {'offer_id': 'ML-00057'},
            {'$unset': {'external_offer_id': ''}}
        )
        print(f"✅ Removed old mapping from ML-00057")
else:
    print("\n❌ No clicks found for Don1")

print("="*80)
