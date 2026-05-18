"""
EMERGENCY: Reactivate all offers that were wrongly deactivated by the inactivity service.
The service deactivated offers because the new Oregon cluster had no click history.

Run: python migrations/reactivate_all_offers.py
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from database import db_instance

offers_col = db_instance.get_collection('offers')

# Find all offers that were deactivated today (status changed to 'inactive' or 'hidden')
# and reactivate them back to 'active'
result = offers_col.update_many(
    {'status': {'$in': ['inactive', 'hidden']}, 'deleted': {'$ne': True}},
    {'$set': {'status': 'active'}}
)

print(f"✅ Reactivated {result.modified_count} offers back to 'active' status")
