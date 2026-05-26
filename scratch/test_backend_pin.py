import sys
import os
from datetime import datetime, timedelta

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'backend')))

try:
    from database import db_instance
    offers_col = db_instance.get_collection('offers')
    if offers_col is None:
        print("Failed to get offers collection")
        sys.exit(1)
        
    print("Directly pinning Dynata Daily Surveys (ML-0824749) to slot 16...")
    now = datetime.utcnow()
    end_time = now + timedelta(hours=6)
    
    result = offers_col.update_one(
        {'offer_id': 'ML-0824749'},
        {
            '$set': {
                'is_pinned': True,
                'pinnedPosition': 16,
                'pinStartTime': now,
                'pinEndTime': end_time,
                'pinDuration': '6 Hours',
                'pinnedBy': 'system_test',
                'pinStatus': 'active'
            }
        }
    )
    print(f"Update Result: modified_count={result.modified_count}")
    
    # Now check if it is active
    o = offers_col.find_one({'offer_id': 'ML-0824749'})
    print(f"Updated Offer: is_pinned={o.get('is_pinned')} | pinnedPosition={o.get('pinnedPosition')} | pinEndTime={o.get('pinEndTime')}")

except Exception as e:
    print(f"Error: {e}")
