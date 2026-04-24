"""
API Endpoint Tester
Tests the actual API endpoints to see what data they return
"""

import requests
import json
from database import db_instance

def test_api_endpoints():
    """Test the API endpoints that the frontend calls"""
    
    print("="*80)
    print("🧪 API ENDPOINT TESTING")
    print("="*80)
    
    # Get admin token (you need to replace this with actual admin token)
    print("\n⚠️  You need to provide an admin token to test the API")
    print("   1. Login as admin in the frontend")
    print("   2. Open browser DevTools > Application > Local Storage")
    print("   3. Copy the 'token' value")
    print("   4. Paste it below:\n")
    
    token = input("Enter admin token (or press Enter to skip API test): ").strip()
    
    if not token:
        print("\n⏭️  Skipping API test. Running database check instead...\n")
        check_database_directly()
        return
    
    base_url = "http://localhost:5000"  # Change if your backend runs on different port
    
    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    }
    
    # Get all users first
    print("\n📋 Fetching all users...")
    try:
        response = requests.get(f"{base_url}/api/auth/admin/users", headers=headers)
        if response.status_code == 200:
            data = response.json()
            users = data.get('users', [])
            approved_users = [u for u in users if u.get('account_status') == 'approved']
            print(f"✅ Found {len(approved_users)} approved users")
            
            # Test each user's stats
            for idx, user in enumerate(approved_users[:5], 1):  # Test first 5 users
                user_id = user.get('_id')
                username = user.get('username')
                
                print(f"\n{'='*80}")
                print(f"Testing User #{idx}: {username} (ID: {user_id})")
                print(f"{'='*80}")
                
                # Test profile-stats endpoint
                print("\n1️⃣ Testing /api/admin/users/{id}/profile-stats")
                try:
                    stats_response = requests.get(
                        f"{base_url}/api/admin/users/{user_id}/profile-stats",
                        headers=headers
                    )
                    if stats_response.status_code == 200:
                        stats_data = stats_response.json()
                        stats = stats_data.get('stats', {})
                        print(f"   ✅ Status: {stats_response.status_code}")
                        print(f"   📊 Data returned:")
                        print(f"      • total_clicks: {stats.get('total_clicks', 0)}")
                        print(f"      • offers_viewed: {stats.get('offers_viewed', 0)}")
                        print(f"      • offers_requested: {stats.get('offers_requested', 0)}")
                        print(f"      • logins_7d: {stats.get('logins_7d', 0)}")
                        print(f"      • top_geos: {len(stats.get('top_geos', []))} countries")
                        print(f"      • top_vertical: {stats.get('top_vertical', 'N/A')}")
                        print(f"      • avg_time_spent: {stats.get('avg_time_spent', '0s')}")
                        
                        if stats.get('total_clicks', 0) > 0:
                            print(f"   ✅ USER HAS DATA!")
                        else:
                            print(f"   ⚠️  User has NO clicks data")
                    else:
                        print(f"   ❌ Error: {stats_response.status_code}")
                        print(f"   Response: {stats_response.text}")
                except Exception as e:
                    print(f"   ❌ Exception: {e}")
                
                # Test offers endpoint
                print("\n2️⃣ Testing /api/admin/users/{id}/offers")
                try:
                    offers_response = requests.get(
                        f"{base_url}/api/admin/users/{user_id}/offers",
                        headers=headers
                    )
                    if offers_response.status_code == 200:
                        offers_data = offers_response.json()
                        print(f"   ✅ Status: {offers_response.status_code}")
                        print(f"   📊 Data returned:")
                        print(f"      • approved_offers: {len(offers_data.get('approved_offers', []))}")
                        print(f"      • rejected_offers: {len(offers_data.get('rejected_offers', []))}")
                        print(f"      • top_viewed_offers: {len(offers_data.get('top_viewed_offers', []))}")
                        print(f"      • search_keywords: {len(offers_data.get('search_keywords', []))}")
                        
                        if len(offers_data.get('approved_offers', [])) > 0:
                            print(f"   ✅ USER HAS APPROVED OFFERS!")
                            # Show first approved offer
                            first_offer = offers_data['approved_offers'][0]
                            print(f"      Sample: {first_offer.get('name', 'N/A')}")
                        else:
                            print(f"   ⚠️  User has NO approved offers")
                    else:
                        print(f"   ❌ Error: {offers_response.status_code}")
                        print(f"   Response: {offers_response.text}")
                except Exception as e:
                    print(f"   ❌ Exception: {e}")
                
                print(f"\n{'='*80}\n")
        else:
            print(f"❌ Failed to fetch users: {response.status_code}")
            print(f"Response: {response.text}")
    except Exception as e:
        print(f"❌ Exception: {e}")

def check_database_directly():
    """Check database directly without API"""
    
    print("="*80)
    print("🔍 DIRECT DATABASE CHECK")
    print("="*80)
    
    users_col = db_instance.get_collection('users')
    clicks_col = db_instance.get_collection('clicks')
    affiliate_requests_col = db_instance.get_collection('affiliate_requests')
    
    # Get approved users
    users = list(users_col.find({
        'account_status': 'approved',
        'role': {'$in': ['publisher', 'user']}
    }).limit(10))
    
    print(f"\n📊 Checking first {len(users)} approved publishers...\n")
    
    users_with_clicks = 0
    users_with_requests = 0
    
    for user in users:
        user_id = str(user['_id'])
        username = user.get('username', 'N/A')
        
        # Check clicks
        clicks_count = clicks_col.count_documents({
            '$or': [
                {'user_id': user_id},
                {'affiliate_id': user_id},
                {'username': username}
            ]
        }) if clicks_col else 0
        
        # Check requests
        requests_count = affiliate_requests_col.count_documents({
            '$or': [
                {'user_id': user_id},
                {'publisher_id': user_id},
                {'username': username}
            ]
        }) if affiliate_requests_col else 0
        
        status = "✅ HAS DATA" if (clicks_count > 0 or requests_count > 0) else "❌ NO DATA"
        
        print(f"{status} | {username:20} | Clicks: {clicks_count:4} | Requests: {requests_count:2}")
        
        if clicks_count > 0:
            users_with_clicks += 1
        if requests_count > 0:
            users_with_requests += 1
    
    print(f"\n{'='*80}")
    print(f"Summary:")
    print(f"  • Users with clicks: {users_with_clicks}/{len(users)}")
    print(f"  • Users with requests: {users_with_requests}/{len(users)}")
    print(f"{'='*80}\n")
    
    if users_with_clicks == 0 and users_with_requests == 0:
        print("⚠️  NO DATA FOUND IN DATABASE!")
        print("   → Run: python generate_test_analytics_data.py")
    elif users_with_clicks > 0 or users_with_requests > 0:
        print("✅ SOME USERS HAVE DATA!")
        print("   → If frontend shows zeros, there might be an API issue")
        print("   → Check backend logs for errors")
        print("   → Verify the user_id matching logic")

if __name__ == '__main__':
    try:
        test_api_endpoints()
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
