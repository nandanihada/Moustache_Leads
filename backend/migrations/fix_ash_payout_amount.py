"""
Fix ash's payout from $3.74 to $2.99 (80% of offer payout).
The migration script incorrectly used the full offer payout instead of publisher's 80%.

$3.74 × 0.8 = $2.99 (correct publisher amount)
Difference: $3.74 - $2.99 = $0.75 to subtract
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import db_instance
from bson import ObjectId
from datetime import datetime

def fix_ash_payout():
    user_id = '69a9a5e655f321cc19f6a74d'
    wrong_amount = 3.74
    correct_amount = 2.99
    difference = round(wrong_amount - correct_amount, 2)  # 0.75
    
    users_col = db_instance.get_collection('users')
    forwarded_col = db_instance.get_collection('forwarded_postbacks')
    pts_col = db_instance.get_collection('points_transactions')
    
    # 1. Fix forwarded_postbacks record
    result = forwarded_col.update_one(
        {'publisher_id': user_id, 'points': wrong_amount},
        {'$set': {'points': correct_amount, 'fixed_payout_at': datetime.utcnow()}}
    )
    print(f"Updated forwarded_postbacks: {result.modified_count} record(s)")
    
    # 2. Fix points_transactions record
    result = pts_col.update_one(
        {'user_id': user_id, 'points': wrong_amount, 'source': 'verified_postback_migration'},
        {'$set': {'points': correct_amount, 'fixed_at': datetime.utcnow()}}
    )
    print(f"Updated points_transactions: {result.modified_count} record(s)")
    
    # 3. Subtract the difference from user's total_points
    users_col.update_one(
        {'_id': ObjectId(user_id)},
        {'$inc': {'total_points': -difference}}
    )
    print(f"Subtracted ${difference} from ash's total_points")
    
    # Verify
    user = users_col.find_one({'_id': ObjectId(user_id)})
    print(f"\nash's current total_points: ${user.get('total_points', 0)}")
    print(f"✅ Fixed: was $3.74, now $2.99 (80% of offer payout)")


if __name__ == '__main__':
    fix_ash_payout()
