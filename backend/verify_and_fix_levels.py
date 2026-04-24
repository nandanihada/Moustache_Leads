"""
Verify and Fix All Publisher Levels
This script checks all publishers and corrects their levels based on actual activity data.
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database import db_instance
from datetime import datetime, timedelta
from bson import ObjectId

def determine_correct_level(user_stats):
    """
    Determine the correct level based on actual user activity.
    
    Level Logic - Priority Order:
    L6: Suspicious activity (highest priority)
    L7: Approved offers + NO conversions + NOT suspicious
    L5: Approved offers + HAS conversions
    L4: Requested offers (none approved yet)
    L3: Login activity in last 7 days
    L2: Viewed offers
    L1: No engagement
    """
    offers_viewed = user_stats.get('offers_viewed', 0)
    offers_requested = user_stats.get('offers_requested', 0)
    approved_offers_count = user_stats.get('approved_offers_count', 0)
    suspicious = user_stats.get('suspicious', False)
    conversions = user_stats.get('conversions', 0)
    logins_7d = user_stats.get('logins_7d', 0)
    
    # L6: Suspicious activity takes highest priority
    if suspicious:
        return 'L6'
    
    # L7: Genuine publisher with approved offers but no conversions
    if approved_offers_count > 0 and conversions == 0 and not suspicious:
        return 'L7'
    
    # L5: Has approved offers AND has conversions (successful publisher)
    if approved_offers_count > 0 and conversions > 0:
        return 'L5'
    
    # L4: Has requested offers but none approved yet
    if offers_requested > 0:
        return 'L4'
    
    # L3: Has login activity in last 7 days
    if logins_7d > 0:
        return 'L3'
    
    # L2: Has viewed offers
    if offers_viewed > 0:
        return 'L2'
    
    # L1: No engagement
    return 'L1'


def get_user_stats(user_id, username):
    """Fetch all stats for a user"""
    clicks_col = db_instance.get_collection('clicks')
    offerwall_clicks_col = db_instance.get_collection('offerwall_clicks')
    dashboard_clicks_col = db_instance.get_collection('dashboard_clicks')
    offerwall_detailed_col = db_instance.get_collection('offerwall_clicks_detailed')
    affiliate_requests_col = db_instance.get_collection('affiliate_requests')
    login_logs_col = db_instance.get_collection('login_logs')
    conversions_col = db_instance.get_collection('forwarded_postbacks')
    
    # Count offers viewed (from ALL click collections)
    offers_viewed = 0
    if clicks_col is not None:
        offers_viewed += clicks_col.count_documents({'$or': [
            {'user_id': user_id},
            {'affiliate_id': user_id},
            {'publisher_id': user_id},
            {'username': username}
        ]})
    
    if offerwall_clicks_col is not None:
        offers_viewed += offerwall_clicks_col.count_documents({'$or': [
            {'user_id': user_id},
            {'publisher_id': user_id},
            {'username': username}
        ]})
    
    if dashboard_clicks_col is not None:
        offers_viewed += dashboard_clicks_col.count_documents({'$or': [
            {'user_id': user_id},
            {'username': username}
        ]})
    
    if offerwall_detailed_col is not None:
        offers_viewed += offerwall_detailed_col.count_documents({'$or': [
            {'user_id': user_id},
            {'publisher_name': username}
        ]})
    
    # Count offers requested and approved
    offers_requested = 0
    approved_offers_count = 0
    if affiliate_requests_col is not None:
        offers_requested = affiliate_requests_col.count_documents({'$or': [
            {'user_id': user_id},
            {'user_id': ObjectId(user_id)},
            {'username': username}
        ]})
        approved_offers_count = affiliate_requests_col.count_documents({
            '$or': [
                {'user_id': user_id},
                {'user_id': ObjectId(user_id)},
                {'username': username}
            ],
            'status': 'approved'
        })
    
    # Count logins in last 7 days
    logins_7d = 0
    if login_logs_col is not None:
        seven_days_ago = datetime.utcnow() - timedelta(days=7)
        logins_7d = login_logs_col.count_documents({
            '$or': [
                {'user_id': user_id},
                {'username': username}
            ],
            'status': 'success',
            'login_time': {'$gte': seven_days_ago}
        })
    
    # Count conversions
    conversions = 0
    if conversions_col is not None:
        conversions = conversions_col.count_documents({'publisher_id': user_id})
    
    return {
        'offers_viewed': offers_viewed,
        'offers_requested': offers_requested,
        'approved_offers_count': approved_offers_count,
        'suspicious': False,  # Get from user record
        'conversions': conversions,
        'logins_7d': logins_7d
    }


def verify_and_fix_all_levels():
    """Check all publishers and fix incorrect levels"""
    users_col = db_instance.get_collection('users')
    
    if users_col is None:
        print("❌ Database not available")
        return
    
    # Get all approved publishers
    publishers = list(users_col.find(
        {'account_status': 'approved'},
        {'_id': 1, 'username': 1, 'level': 1, 'suspicious': 1}
    ))
    
    print(f"\n🔍 Checking {len(publishers)} publishers...\n")
    
    corrections_needed = []
    correct_count = 0
    
    for publisher in publishers:
        user_id = str(publisher['_id'])
        username = publisher.get('username', '')
        current_level = publisher.get('level', 'L1')
        suspicious = publisher.get('suspicious', False)
        
        # Get stats
        stats = get_user_stats(user_id, username)
        stats['suspicious'] = suspicious
        
        # Determine correct level
        correct_level = determine_correct_level(stats)
        
        if current_level != correct_level:
            corrections_needed.append({
                'user_id': user_id,
                'username': username,
                'current_level': current_level,
                'correct_level': correct_level,
                'stats': stats
            })
            print(f"❌ {username}: {current_level} → {correct_level}")
            print(f"   Approved: {stats['approved_offers_count']}, Conversions: {stats['conversions']}, Suspicious: {stats['suspicious']}")
        else:
            correct_count += 1
    
    print(f"\n📊 Summary:")
    print(f"   ✅ Correct: {correct_count}")
    print(f"   ❌ Need correction: {len(corrections_needed)}")
    
    if corrections_needed:
        print(f"\n🔧 Applying corrections...")
        
        for correction in corrections_needed:
            result = users_col.update_one(
                {'_id': ObjectId(correction['user_id'])},
                {
                    '$set': {
                        'level': correction['correct_level'],
                        'previous_level': correction['current_level'],
                        'level_updated_at': datetime.utcnow()
                    }
                }
            )
            
            if result.modified_count > 0:
                print(f"   ✅ Fixed {correction['username']}: {correction['current_level']} → {correction['correct_level']}")
            else:
                print(f"   ❌ Failed to fix {correction['username']}")
        
        print(f"\n✅ All corrections applied!")
    else:
        print(f"\n✅ All levels are correct!")


if __name__ == '__main__':
    print("=" * 60)
    print("PUBLISHER LEVEL VERIFICATION AND FIX")
    print("=" * 60)
    verify_and_fix_all_levels()
    print("=" * 60)
