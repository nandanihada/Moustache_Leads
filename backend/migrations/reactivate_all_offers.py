"""Reactivate ALL offers that aren't already active/running/rotating"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from database import db_instance

offers = db_instance.get_collection('offers')

# Set ALL non-deleted offers to active (regardless of current status)
result = offers.update_many(
    {'deleted': {'$ne': True}},
    {'$set': {'status': 'active'}}
)

print(f"Reactivated {result.modified_count} offers to 'active' status")

# Verify
count = offers.count_documents({'status': {'$in': ['active', 'running', 'rotating']}})
print(f"Total visible offers now: {count}")
