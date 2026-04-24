"""
Diagnostic Script: Check Publisher Data in Database
This script checks what data actually exists for each publisher
"""

from database import db_instance
from bson import ObjectId
from datetime import datetime, timedelta

def check_publisher_data():
    """Check what data exists for each publisher"""
    
    print("="*80)
    print("🔍 PUBLISHER DATA DIAGNOSTIC REPORT")
    print("="*80)
    
    # Get collections
    users_col = db_instance.get_collection('users')
    clicks_col = db_instance.get_collection('clicks')
    dashboard_clicks_col = db_instance.get_collection('dashboard_clicks')
    offerwall_clicks_col = db_instance.get_collection('offerwall_clicks')
    offerwall_clicks_detailed_col = db_instance.get_collection('offerwall_clicks_detailed')
    affiliate_requests_col = db_instance.get_collection('affiliate_requests')
    conversions_col = db_instance.get_collection('conversions')
    login_logs_col = db_instance.get_collection('login_logs')
    
    # Get all approved publishers
    publishers = list(users_col.find({
        'account_status': 'approved',
        'role': {'$in': ['publisher', 'user']}
    }))
    
    print(f"\n📊 Found {len(publishers)} approved publishers\n")
    
    publishers_with_data = 0
    publishers_without_data = 0
    
    for idx, pub in enumerate(publishers, 1):
        pub_id = str(pub['_id'])
        username = pub.get('username', 'N/A')
        email = pub.get('email', 'N/A')
        level = pub.get('level', 'L1')
        
        print(f"\n{'='*80}")
        print(f"Publisher #{idx}: {username} (ID: {pub_id})")
        print(f"Email: {email} | Level: {level}")
        print(f"{'='*80}")
        
        has_data = False
        
        # Check clicks in all collections
        print("\n📍 CLICKS DATA:")
        
        # Regular clicks
        clicks_query = {'$or': [
            {'user_id': pub_id},
            {'affiliate_id': pub_id},
            {'publisher_id': pub_id},
            {'username': username}
        ]}
        clicks_count = clicks_col.count_documents(clicks_query) if clicks_col else 0
        print(f"  • clicks collection: {clicks_count}")
        if clicks_count > 0:
            has_data = True
            # Show sample
            sample = clicks_col.find_one(clicks_query)
            if sample:
                print(f"    Sample: offer_id={sample.get('offer_id')}, country={sample.get('country')}, time_spent={sample.get('time_spent_seconds')}s")
        
        # Dashboard clicks
        dashboard_query = {'$or': [
            {'user_id': pub_id},
            {'username': username},
            {'user_email': email}
        ]}
        dashboard_count = dashboard_clicks_col.count_documents(dashboard_query) if dashboard_clicks_col else 0
        print(f"  • dashboard_clicks collection: {dashboard_count}")
        if dashboard_count > 0:
            has_data = True
        
        # Offerwall clicks
        offerwall_query = {'$or': [
            {'publisher_id': pub_id},
            {'user_id': pub_id},
            {'username': username}
        ]}
        offerwall_count = offerwall_clicks_col.count_documents(offerwall_query) if offerwall_clicks_col else 0
        print(f"  • offerwall_clicks collection: {offerwall_count}")
        if offerwall_count > 0:
            has_data = True
        
        # Offerwall clicks detailed
        offerwall_detailed_count = offerwall_clicks_detailed_col.count_documents(offerwall_query) if offerwall_clicks_detailed_col else 0
        print(f"  • offerwall_clicks_detailed collection: {offerwall_detailed_count}")
        if offerwall_detailed_count > 0:
            has_data = True
        
        total_clicks = clicks_count + dashboard_count + offerwall_count + offerwall_detailed_count
        print(f"  ✓ TOTAL CLICKS: {total_clicks}")
        
        # Check affiliate requests
        print("\n📋 OFFER REQUESTS DATA:")
        requests_query = {'$or': [
            {'user_id': pub_id},
            {'user_id': ObjectId(pub_id)},
            {'publisher_id': pub_id},
            {'publisher_id': ObjectId(pub_id)},
            {'username': username},
            {'email': email}
        ]}
        
        total_requests = affiliate_requests_col.count_documents(requests_query) if affiliate_requests_col else 0
        approved_requests = affiliate_requests_col.count_documents({**requests_query, 'status': 'approved'}) if affiliate_requests_col else 0
        rejected_requests = affiliate_requests_col.count_documents({**requests_query, 'status': 'rejected'}) if affiliate_requests_col else 0
        pending_requests = affiliate_requests_col.count_documents({**requests_query, 'status': 'pending'}) if affiliate_requests_col else 0
        
        print(f"  • Total Requests: {total_requests}")
        print(f"  • Approved: {approved_requests}")
        print(f"  • Rejected: {rejected_requests}")
        print(f"  • Pending: {pending_requests}")
        
        if total_requests > 0:
            has_data = True
            # Show sample
            sample = affiliate_requests_col.find_one(requests_query)
            if sample:
                print(f"    Sample: offer_id={sample.get('offer_id')}, status={sample.get('status')}")
        
        # Check conversions
        print("\n💰 CONVERSIONS DATA:")
        conversions_query = {'$or': [
            {'publisher_id': pub_id},
            {'user_id': pub_id},
            {'username': username}
        ]}
        conversions_count = conversions_col.count_documents(conversions_query) if conversions_col else 0
        print(f"  • Total Conversions: {conversions_count}")
        if conversions_count > 0:
            has_data = True
            # Show sample
            sample = conversions_col.find_one(conversions_query)
            if sample:
                print(f"    Sample: offer_id={sample.get('offer_id')}, points={sample.get('points')}, status={sample.get('status')}")
        
        # Check login logs (last 7 days)
        print("\n🔐 LOGIN LOGS (Last 7 days):")
        seven_days_ago = datetime.utcnow() - timedelta(days=7)
        login_query = {'$or': [
            {'user_id': pub_id},
            {'username': username},
            {'email': email}
        ], 'login_time': {'$gte': seven_days_ago}}
        logins_count = login_logs_col.count_documents(login_query) if login_logs_col else 0
        print(f"  • Logins (7d): {logins_count}")
        if logins_count > 0:
            has_data = True
        
        # Summary
        print("\n" + "="*80)
        if has_data:
            print("✅ STATUS: HAS DATA - Should show in analytics")
            publishers_with_data += 1
        else:
            print("❌ STATUS: NO DATA - Will show zeros in analytics")
            publishers_without_data += 1
        print("="*80)
    
    # Final Summary
    print("\n" + "="*80)
    print("📊 FINAL SUMMARY")
    print("="*80)
    print(f"Total Publishers: {len(publishers)}")
    print(f"✅ Publishers WITH data: {publishers_with_data}")
    print(f"❌ Publishers WITHOUT data: {publishers_without_data}")
    print("\n" + "="*80)
    
    # Check collection totals
    print("\n📦 COLLECTION TOTALS:")
    print(f"  • clicks: {clicks_col.count_documents({}) if clicks_col else 0}")
    print(f"  • dashboard_clicks: {dashboard_clicks_col.count_documents({}) if dashboard_clicks_col else 0}")
    print(f"  • offerwall_clicks: {offerwall_clicks_col.count_documents({}) if offerwall_clicks_col else 0}")
    print(f"  • offerwall_clicks_detailed: {offerwall_clicks_detailed_col.count_documents({}) if offerwall_clicks_detailed_col else 0}")
    print(f"  • affiliate_requests: {affiliate_requests_col.count_documents({}) if affiliate_requests_col else 0}")
    print(f"  • conversions: {conversions_col.count_documents({}) if conversions_col else 0}")
    print(f"  • login_logs: {login_logs_col.count_documents({}) if login_logs_col else 0}")
    print("\n" + "="*80)
    
    # Recommendations
    print("\n💡 RECOMMENDATIONS:")
    if publishers_without_data == len(publishers):
        print("  ⚠️  ALL publishers have NO data!")
        print("  → Run: python generate_test_analytics_data.py")
    elif publishers_without_data > 0:
        print(f"  ⚠️  {publishers_without_data} publishers have NO data")
        print("  → These will show zeros in analytics (this is correct)")
    else:
        print("  ✅ All publishers have data!")
        print("  → If analytics still shows zeros, check the API endpoints")
    
    print("\n" + "="*80)

if __name__ == '__main__':
    try:
        check_publisher_data()
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
