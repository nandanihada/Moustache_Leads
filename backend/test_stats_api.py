"""
Test script to verify stats API is returning correct data from database
"""
from database import db_instance
from bson import ObjectId
from datetime import datetime, timedelta

def test_user_stats():
    print("=" * 80)
    print("TESTING USER STATS API - CHECKING DATABASE DATA")
    print("=" * 80)
    
    # Get first 5 approved users
    users_col = db_instance.get_collection('users')
    users = list(users_col.find({'account_status': 'approved'}).limit(5))
    
    print(f"\nFound {len(users)} approved users to test\n")
    
    for user in users:
        user_id = str(user['_id'])
        username = user.get('username', 'N/A')
        email = user.get('email', 'N/A')
        level = user.get('level', 'L1')
        
        print(f"\n{'='*80}")
        print(f"USER: {username} (ID: {user_id})")
        print(f"Email: {email}, Level: {level}")
        print(f"{'='*80}")
        
        # Check clicks in all collections
        clicks_col = db_instance.get_collection('clicks')
        dashboard_col = db_instance.get_collection('dashboard_clicks')
        offerwall_col = db_instance.get_collection('offerwall_clicks')
        offerwall_detailed_col = db_instance.get_collection('offerwall_clicks_detailed')
        
        total_clicks = 0
        
        # Query clicks
        if clicks_col is not None:
            query = {'$or': [{'user_id': user_id}, {'affiliate_id': user_id}, {'username': username}]}
            count = clicks_col.count_documents(query)
            total_clicks += count
            print(f"  clicks collection: {count} clicks")
            if count > 0:
                sample = clicks_col.find_one(query)
                print(f"    Sample: offer_id={sample.get('offer_id')}, country={sample.get('country')}")
        
        # Query dashboard_clicks
        if dashboard_col is not None:
            query = {'$or': [{'user_id': user_id}, {'user_email': email}, {'username': username}]}
            count = dashboard_col.count_documents(query)
            total_clicks += count
            print(f"  dashboard_clicks collection: {count} clicks")
            if count > 0:
                sample = dashboard_col.find_one(query)
                print(f"    Sample: offer_id={sample.get('offer_id')}, geo={sample.get('geo', {}).get('country')}")
        
        # Query offerwall_clicks
        if offerwall_col is not None:
            query = {'$or': [{'publisher_id': user_id}, {'username': username}]}
            count = offerwall_col.count_documents(query)
            total_clicks += count
            print(f"  offerwall_clicks collection: {count} clicks")
            if count > 0:
                sample = offerwall_col.find_one(query)
                print(f"    Sample: offer_id={sample.get('offer_id')}, country={sample.get('country')}")
        
        # Query offerwall_clicks_detailed
        if offerwall_detailed_col is not None:
            query = {'$or': [{'user_id': user_id}, {'publisher_name': username}]}
            count = offerwall_detailed_col.count_documents(query)
            total_clicks += count
            print(f"  offerwall_clicks_detailed collection: {count} clicks")
            if count > 0:
                sample = offerwall_detailed_col.find_one(query)
                print(f"    Sample: offer_id={sample.get('offer_id')}, geo={sample.get('geo', {}).get('country')}")
        
        print(f"\n  TOTAL CLICKS: {total_clicks}")
        
        # Check affiliate_requests
        requests_col = db_instance.get_collection('affiliate_requests')
        if requests_col is not None:
            query = {'$or': [
                {'user_id': user_id},
                {'user_id': ObjectId(user_id)},
                {'publisher_id': user_id},
                {'username': username}
            ]}
            total_requests = requests_col.count_documents(query)
            approved = requests_col.count_documents({**query, 'status': 'approved'})
            rejected = requests_col.count_documents({**query, 'status': 'rejected'})
            print(f"\n  AFFILIATE REQUESTS:")
            print(f"    Total: {total_requests}")
            print(f"    Approved: {approved}")
            print(f"    Rejected: {rejected}")
            
            if total_requests > 0:
                sample = requests_col.find_one(query)
                print(f"    Sample: offer_id={sample.get('offer_id')}, status={sample.get('status')}")
        
        # Check login_logs
        login_logs = db_instance.get_collection('login_logs')
        if login_logs is not None:
            seven_days_ago = datetime.utcnow() - timedelta(days=7)
            query = {'$or': [
                {'user_id': user_id},
                {'email': email},
                {'username': username}
            ], 'status': 'success', 'login_time': {'$gte': seven_days_ago}}
            logins_7d = login_logs.count_documents(query)
            print(f"\n  LOGINS (last 7 days): {logins_7d}")
        
        # Check conversions
        conversions_col = db_instance.get_collection('forwarded_postbacks')
        if conversions_col is not None:
            query = {'$or': [
                {'publisher_id': user_id},
                {'username': username}
            ]}
            conversions = conversions_col.count_documents(query)
            print(f"  CONVERSIONS: {conversions}")
        
        print(f"\n  SUMMARY:")
        print(f"    Clicks: {total_clicks}")
        print(f"    Should show in table: Clicks={total_clicks}, Requested={total_requests if 'total_requests' in locals() else 0}, Approved={approved if 'approved' in locals() else 0}")
        
        if total_clicks == 0 and total_requests == 0:
            print(f"    WARNING: This user has NO activity in database!")
        else:
            print(f"    OK: This user HAS activity - data should display")

if __name__ == '__main__':
    test_user_stats()
