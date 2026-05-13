import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from database import db_instance

offers = db_instance.get_collection('offers')

# Check cpamerchant
sample = offers.find_one({'network': {'$regex': 'cpamerchant', '$options': 'i'}})
if sample:
    print(f"cpamerchant offer: {sample.get('offer_id')}")
    print(f"  URL: {sample.get('target_url')}")
    print(f"  Has aff_sub: {'aff_sub=' in (sample.get('target_url') or '')}")
    print(f"  Has aff_click_id: {'aff_click_id=' in (sample.get('target_url') or '')}")

# Check leadads
sample2 = offers.find_one({'network': {'$regex': 'leadads', '$options': 'i'}})
if sample2:
    print(f"\nleadads offer: {sample2.get('offer_id')}")
    print(f"  URL: {sample2.get('target_url')}")
    print(f"  Has aff_sub: {'aff_sub=' in (sample2.get('target_url') or '')}")
    print(f"  Has aff_click_id: {'aff_click_id=' in (sample2.get('target_url') or '')}")

# Check chameleonads
sample3 = offers.find_one({'network': {'$regex': 'chameleonads', '$options': 'i'}})
if sample3:
    print(f"\nchameleonads offer: {sample3.get('offer_id')}")
    print(f"  URL: {sample3.get('target_url')}")
    print(f"  Has aff_sub: {'aff_sub=' in (sample3.get('target_url') or '')}")
    print(f"  Has aff_click_id: {'aff_click_id=' in (sample3.get('target_url') or '')}")

# Count totals
total_with_params = offers.count_documents({'target_url': {'$regex': 'aff_sub=.*aff_click_id='}})
print(f"\nTotal offers with both tracking params: {total_with_params}")
