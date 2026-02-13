"""
Debug script to check actual data in MongoDB collections
Run this to see what data exists and verify the overview stats
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database import db_instance
from datetime import datetime, timedelta
from bson import ObjectId

def get_24h_window():
    now = datetime.utcnow()
    return now - timedelta(hours=24), now

def debug_all_collections():
    """Debug all collections used in overview stats"""
    
    print("=" * 80)
    print("DEBUGGING OVERVIEW DATA - CHECKING ACTUAL DATABASE CONTENTS")
    print("=" * 80)
    
    start_24h, now = get_24h_window()
    print(f"\n24h window: {start_24h} to {now}")
    
    # 1. USERS
    print("\n" + "=" * 40)
    print("1. USERS COLLECTION")
    print("=" * 40)
    users = db_instance.get_collection('users')
    if users is not None:
        total_users = users.count_documents({})
        print(f"Total users in 'users' collection: {total_users}")
        
        # Check date fields
        sample = users.find_one()
        if sample:
            print(f"Sample user fields: {list(sample.keys())}")
            print(f"Sample created_at: {sample.get('created_at')}")
            print(f"Sample createdAt: {sample.get('createdAt')}")
        
        # Count by different date fields
        for field in ['created_at', 'createdAt', 'signup_date']:
            count = users.count_documents({field: {'$gte': start_24h}})
            print(f"Users with {field} >= 24h ago: {count}")
    else:
        print("'users' collection not found!")
    
    # 2. ACTIVE USERS - Check login_logs
    print("\n" + "=" * 40)
    print("2. LOGIN LOGS (for Active Users)")
    print("=" * 40)
    login_logs = db_instance.get_collection('login_logs')
    if login_logs is not None:
        total_logs = login_logs.count_documents({})
        print(f"Total login logs: {total_logs}")
        
        successful_logins = login_logs.count_documents({'status': 'success'})
        print(f"Successful logins: {successful_logins}")
        
        # Unique users who logged in successfully
        unique_users = login_logs.distinct('user_id', {'status': 'success'})
        print(f"Unique users with successful login: {len(unique_users)}")
        
        # In last 24h
        recent_logins = login_logs.distinct('user_id', {
            'status': 'success',
            'login_time': {'$gte': start_24h}
        })
        print(f"Unique users logged in last 24h: {len(recent_logins)}")
    else:
        print("'login_logs' collection not found!")
    
    # 3. CLICKS
    print("\n" + "=" * 40)
    print("3. CLICKS COLLECTIONS")
    print("=" * 40)
    
    # Check offerwall_clicks_detailed
    clicks_detailed = db_instance.get_collection('offerwall_clicks_detailed')
    if clicks_detailed is not None:
        total = clicks_detailed.count_documents({})
        print(f"offerwall_clicks_detailed total: {total}")
        recent = clicks_detailed.count_documents({'timestamp': {'$gte': start_24h}})
        print(f"offerwall_clicks_detailed last 24h: {recent}")
    
    # Check dashboard_clicks
    dashboard_clicks = db_instance.get_collection('dashboard_clicks')
    if dashboard_clicks is not None:
        total = dashboard_clicks.count_documents({})
        print(f"dashboard_clicks total: {total}")
    
    # Check other click collections
    for col_name in ['clicks', 'offer_clicks', 'tracking_clicks']:
        col = db_instance.get_collection(col_name)
        if col is not None:
            total = col.count_documents({})
            print(f"{col_name} total: {total}")
    
    # 4. CONVERSIONS
    print("\n" + "=" * 40)
    print("4. CONVERSIONS COLLECTIONS")
    print("=" * 40)
    
    conversions = db_instance.get_collection('offerwall_conversions')
    if conversions is not None:
        total = conversions.count_documents({})
        print(f"offerwall_conversions total: {total}")
        
        sample = conversions.find_one()
        if sample:
            print(f"Sample conversion fields: {list(sample.keys())}")
    
    forwarded = db_instance.get_collection('forwarded_postbacks')
    if forwarded is not None:
        total = forwarded.count_documents({})
        print(f"forwarded_postbacks total: {total}")
        
        successful = forwarded.count_documents({'forward_status': 'success'})
        print(f"forwarded_postbacks successful: {successful}")
        
        failed = forwarded.count_documents({'forward_status': {'$in': ['failed', 'error']}})
        print(f"forwarded_postbacks failed: {failed}")
        
        sample = forwarded.find_one()
        if sample:
            print(f"Sample forwarded_postback fields: {list(sample.keys())}")
            print(f"Sample points: {sample.get('points')}")
    
    # 5. AFFILIATE REQUESTS (Requested Offers)
    print("\n" + "=" * 40)
    print("5. AFFILIATE REQUESTS (Requested Offers)")
    print("=" * 40)
    
    affiliate_requests = db_instance.get_collection('affiliate_requests')
    if affiliate_requests is not None:
        total = affiliate_requests.count_documents({})
        print(f"affiliate_requests total: {total}")
        
        # By status
        for status in ['pending', 'approved', 'rejected']:
            count = affiliate_requests.count_documents({'status': status})
            print(f"  {status}: {count}")
    
    missing_offers = db_instance.get_collection('missing_offers')
    if missing_offers is not None:
        total = missing_offers.count_documents({})
        print(f"missing_offers total: {total}")
    
    # 6. PLACEMENTS
    print("\n" + "=" * 40)
    print("6. PLACEMENTS")
    print("=" * 40)
    
    placements = db_instance.get_collection('placements')
    if placements is not None:
        total = placements.count_documents({})
        print(f"Total placements: {total}")
        
        # Check approval status field names
        sample = placements.find_one()
        if sample:
            print(f"Sample placement fields: {list(sample.keys())}")
            print(f"Sample approvalStatus: {sample.get('approvalStatus')}")
            print(f"Sample status: {sample.get('status')}")
        
        # Count by status
        for status in ['APPROVED', 'approved', 'LIVE', 'live', 'PENDING', 'pending']:
            count = placements.count_documents({'approvalStatus': status})
            count2 = placements.count_documents({'status': status})
            print(f"  approvalStatus={status}: {count}, status={status}: {count2}")
    
    # 7. OFFERS
    print("\n" + "=" * 40)
    print("7. OFFERS")
    print("=" * 40)
    
    offers = db_instance.get_collection('offers')
    if offers is not None:
        total = offers.count_documents({})
        print(f"Total offers: {total}")
        
        # Check for deleted offers
        deleted = offers.count_documents({'is_deleted': True})
        active = offers.count_documents({'is_deleted': {'$ne': True}})
        print(f"Deleted offers: {deleted}")
        print(f"Non-deleted offers: {active}")
        
        # Check date fields
        sample = offers.find_one()
        if sample:
            print(f"Sample offer fields: {list(sample.keys())[:15]}")
            print(f"Sample created_at: {sample.get('created_at')}")
            print(f"Sample createdAt: {sample.get('createdAt')}")
            print(f"Sample date_added: {sample.get('date_added')}")
    
    # 8. POSTBACK LOGS
    print("\n" + "=" * 40)
    print("8. POSTBACK LOGS")
    print("=" * 40)
    
    postback_logs = db_instance.get_collection('postback_logs')
    if postback_logs is not None:
        total = postback_logs.count_documents({})
        print(f"postback_logs total: {total}")
        
        failed = postback_logs.count_documents({'status': {'$in': ['failed', 'error']}})
        print(f"postback_logs failed: {failed}")
    else:
        print("postback_logs collection not found!")
    
    # 9. REVENUE CALCULATION
    print("\n" + "=" * 40)
    print("9. REVENUE CALCULATION")
    print("=" * 40)
    
    if forwarded is not None:
        # Sum points from successful forwarded postbacks
        pipeline = [
            {'$match': {'forward_status': 'success'}},
            {'$group': {'_id': None, 'total': {'$sum': '$points'}}}
        ]
        result = list(forwarded.aggregate(pipeline))
        total_revenue = result[0]['total'] if result else 0
        print(f"Total revenue from forwarded_postbacks (points): {total_revenue}")
    
    if conversions is not None:
        # Sum payout_amount from conversions
        pipeline = [
            {'$group': {'_id': None, 'total': {'$sum': '$payout_amount'}}}
        ]
        result = list(conversions.aggregate(pipeline))
        total_payout = result[0]['total'] if result else 0
        print(f"Total payout from offerwall_conversions: {total_payout}")
    
    # 10. LIST ALL COLLECTIONS
    print("\n" + "=" * 40)
    print("10. ALL COLLECTIONS IN DATABASE")
    print("=" * 40)
    
    db = db_instance.get_db()
    if db is not None:
        collections = db.list_collection_names()
        print(f"Total collections: {len(collections)}")
        for col in sorted(collections):
            count = db[col].count_documents({})
            print(f"  {col}: {count} documents")

if __name__ == '__main__':
    debug_all_collections()
