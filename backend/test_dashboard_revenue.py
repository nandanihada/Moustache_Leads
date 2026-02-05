"""
Test Script: Dashboard Revenue Update
=====================================
This script tests if the dashboard revenue updates correctly when a conversion happens.

Usage:
    python test_dashboard_revenue.py

What it does:
1. Gets the current dashboard stats for user "elegantobviously"
2. Inserts a test conversion (forwarded_postback) for that user
3. Gets the dashboard stats again to verify the revenue updated
"""

import os
import sys
from datetime import datetime
from bson import ObjectId

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database import db_instance

def get_user_by_username(username):
    """Get user document by username"""
    users = db_instance.get_collection('users')
    if users is None:
        print("❌ Could not connect to users collection")
        return None
    return users.find_one({'username': username})

def get_dashboard_stats(user_id):
    """Get dashboard stats for a user (simulating the API call)"""
    forwarded_postbacks = db_instance.get_collection('forwarded_postbacks')
    
    if forwarded_postbacks is None:
        print("❌ Could not connect to forwarded_postbacks collection")
        return None
    
    # Calculate total revenue and conversions
    pipeline = [
        {
            '$match': {
                'publisher_id': str(user_id),
                'forward_status': 'success'
            }
        },
        {
            '$group': {
                '_id': None,
                'total_revenue': {'$sum': '$points'},
                'total_conversions': {'$sum': 1}
            }
        }
    ]
    
    result = list(forwarded_postbacks.aggregate(pipeline))
    
    if result:
        return {
            'total_revenue': result[0]['total_revenue'],
            'total_conversions': result[0]['total_conversions']
        }
    else:
        return {
            'total_revenue': 0,
            'total_conversions': 0
        }

def insert_test_conversion(user_id, username, points=5.00):
    """Insert a test conversion for the user"""
    forwarded_postbacks = db_instance.get_collection('forwarded_postbacks')
    
    if forwarded_postbacks is None:
        print("❌ Could not connect to forwarded_postbacks collection")
        return None
    
    test_conversion = {
        'timestamp': datetime.utcnow(),
        'original_postback_id': ObjectId(),
        'publisher_id': str(user_id),
        'publisher_name': username,
        'username': 'test_user_123',
        'points': points,
        'forward_url': 'https://test.example.com/postback?test=true',
        'forward_status': 'success',
        'response_code': 200,
        'response_body': 'OK',
        'original_params': {'test': 'true'},
        'enriched_params': {},
        'placement_id': 'test_placement',
        'placement_title': 'Test Placement',
        'offer_id': 'TEST-OFFER-001',
        'offer_name': 'Test Offer for Dashboard',
        'click_id': f'TEST-CLICK-{datetime.utcnow().strftime("%Y%m%d%H%M%S")}',
        'is_test': True  # Mark as test conversion
    }
    
    result = forwarded_postbacks.insert_one(test_conversion)
    return result.inserted_id

def delete_test_conversions(user_id):
    """Delete test conversions for cleanup"""
    forwarded_postbacks = db_instance.get_collection('forwarded_postbacks')
    
    if forwarded_postbacks is None:
        return 0
    
    result = forwarded_postbacks.delete_many({
        'publisher_id': str(user_id),
        'is_test': True
    })
    return result.deleted_count

def main():
    print("=" * 60)
    print("🧪 Dashboard Revenue Update Test")
    print("=" * 60)
    
    # Target user
    target_username = "elegant"
    test_points = 5.00
    
    print(f"\n📌 Target User: {target_username}")
    print(f"💰 Test Conversion Amount: ${test_points}")
    
    # Step 1: Get user
    print(f"\n🔍 Step 1: Finding user '{target_username}'...")
    user = get_user_by_username(target_username)
    
    if not user:
        print(f"❌ User '{target_username}' not found!")
        return
    
    user_id = user['_id']
    print(f"✅ Found user: {user.get('email', 'N/A')} (ID: {user_id})")
    
    # Step 2: Get current stats
    print(f"\n📊 Step 2: Getting current dashboard stats...")
    stats_before = get_dashboard_stats(user_id)
    
    if stats_before is None:
        print("❌ Could not get dashboard stats")
        return
    
    print(f"   💵 Current Revenue: ${stats_before['total_revenue']:.2f}")
    print(f"   📈 Current Conversions: {stats_before['total_conversions']}")
    
    # Step 3: Insert test conversion
    print(f"\n🔧 Step 3: Inserting test conversion (${test_points})...")
    conversion_id = insert_test_conversion(user_id, target_username, test_points)
    
    if not conversion_id:
        print("❌ Failed to insert test conversion")
        return
    
    print(f"✅ Test conversion inserted: {conversion_id}")
    
    # Step 4: Get updated stats
    print(f"\n📊 Step 4: Getting updated dashboard stats...")
    stats_after = get_dashboard_stats(user_id)
    
    if stats_after is None:
        print("❌ Could not get updated dashboard stats")
        return
    
    print(f"   💵 New Revenue: ${stats_after['total_revenue']:.2f}")
    print(f"   📈 New Conversions: {stats_after['total_conversions']}")
    
    # Step 5: Verify the update
    print(f"\n✅ Step 5: Verification...")
    revenue_diff = stats_after['total_revenue'] - stats_before['total_revenue']
    conversion_diff = stats_after['total_conversions'] - stats_before['total_conversions']
    
    print(f"   💰 Revenue Change: +${revenue_diff:.2f} (expected: +${test_points:.2f})")
    print(f"   📈 Conversion Change: +{conversion_diff} (expected: +1)")
    
    if abs(revenue_diff - test_points) < 0.01 and conversion_diff == 1:
        print(f"\n🎉 SUCCESS! Dashboard revenue updates correctly!")
    else:
        print(f"\n⚠️ WARNING: Values don't match expected changes")
    
    # Step 6: Cleanup option
    print(f"\n🧹 Step 6: Cleanup...")
    cleanup = input("Delete test conversion? (y/n): ").strip().lower()
    
    if cleanup == 'y':
        deleted = delete_test_conversions(user_id)
        print(f"✅ Deleted {deleted} test conversion(s)")
        
        # Verify cleanup
        stats_final = get_dashboard_stats(user_id)
        print(f"   💵 Final Revenue: ${stats_final['total_revenue']:.2f}")
        print(f"   📈 Final Conversions: {stats_final['total_conversions']}")
    else:
        print("⏭️ Skipping cleanup - test conversion remains in database")
    
    print("\n" + "=" * 60)
    print("🏁 Test Complete!")
    print("=" * 60)

if __name__ == "__main__":
    main()
