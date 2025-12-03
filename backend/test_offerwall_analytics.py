#!/usr/bin/env python
"""
Test script to verify offerwall analytics data collection
"""
import json
from database import db_instance
from models.offerwall_tracking import OfferwallTracking
import datetime

print("=" * 80)
print("🔍 OFFERWALL ANALYTICS DATA CHECK")
print("=" * 80)

# Initialize tracker
tracker = OfferwallTracking(db_instance)

# Check collections
collections = {
    'offerwall_sessions': 'User sessions',
    'offerwall_clicks': 'Offer clicks',
    'offerwall_conversions': 'Conversions/Completions',
    'offerwall_impressions': 'Impressions',
    'user_points': 'User points',
    'offer_completions': 'Offer completions',
    'fraud_signals': 'Fraud signals'
}

print("\n📊 DATABASE COLLECTIONS STATUS:")
print("-" * 80)

total_data = 0
for col_name, description in collections.items():
    col = db_instance.get_collection(col_name)
    count = col.count_documents({})
    total_data += count
    status = "✅" if count > 0 else "⚠️"
    print(f"{status} {col_name:30} ({description:25}): {count:5} documents")

print(f"\n📈 TOTAL DATA POINTS: {total_data}")

# Get dashboard stats
print("\n" + "=" * 80)
print("📊 DASHBOARD STATISTICS")
print("=" * 80)

stats = tracker.get_dashboard_stats()
print(f"""
Total Sessions:      {stats.get('total_sessions', 0):,}
Total Clicks:        {stats.get('total_clicks', 0):,}
Total Conversions:   {stats.get('total_conversions', 0):,}
Total Points Awarded: {stats.get('total_points_awarded', 0):,}
CTR (Click-Through Rate): {stats.get('ctr', 0):.2f}%
CVR (Conversion Rate):    {stats.get('cvr', 0):.2f}%
""")

# Get fraud signals
print("=" * 80)
print("🚨 FRAUD SIGNALS")
print("=" * 80)

fraud_signals = tracker.get_fraud_signals(limit=5)
if fraud_signals:
    print(f"Found {len(fraud_signals)} fraud signals (showing latest 5):\n")
    for i, signal in enumerate(fraud_signals, 1):
        print(f"{i}. User: {signal.get('user_id')}")
        print(f"   Type: {signal.get('signal_type')}")
        print(f"   Severity: {signal.get('severity')}")
        print(f"   Time: {signal.get('timestamp')}")
        print()
else:
    print("No fraud signals detected")

# Check sample data from each collection
print("=" * 80)
print("📋 SAMPLE DATA FROM COLLECTIONS")
print("=" * 80)

# Sessions
sessions_col = db_instance.get_collection('offerwall_sessions')
if sessions_col.count_documents({}) > 0:
    session = sessions_col.find_one({})
    print("\n✅ SAMPLE SESSION:")
    print(f"   Session ID: {session.get('session_id')}")
    print(f"   User ID: {session.get('user_id')}")
    print(f"   Placement ID: {session.get('placement_id')}")
    print(f"   Created: {session.get('created_at')}")

# Clicks
clicks_col = db_instance.get_collection('offerwall_clicks')
if clicks_col.count_documents({}) > 0:
    click = clicks_col.find_one({})
    print("\n✅ SAMPLE CLICK:")
    print(f"   Click ID: {click.get('click_id')}")
    print(f"   User ID: {click.get('user_id')}")
    print(f"   Offer ID: {click.get('offer_id')}")
    print(f"   Timestamp: {click.get('timestamp')}")

# Conversions
conversions_col = db_instance.get_collection('offerwall_conversions')
if conversions_col.count_documents({}) > 0:
    conversion = conversions_col.find_one({})
    print("\n✅ SAMPLE CONVERSION:")
    print(f"   Conversion ID: {conversion.get('conversion_id')}")
    print(f"   User ID: {conversion.get('user_id')}")
    print(f"   Offer ID: {conversion.get('offer_id')}")
    print(f"   Payout: ${conversion.get('payout_amount', 0):.2f}")
    print(f"   Points: {conversion.get('points_awarded', 0)}")
    print(f"   Timestamp: {conversion.get('timestamp')}")

# User Points
points_col = db_instance.get_collection('user_points')
if points_col.count_documents({}) > 0:
    user_points = points_col.find_one({})
    print("\n✅ SAMPLE USER POINTS:")
    print(f"   User ID: {user_points.get('user_id')}")
    print(f"   Total Points: {user_points.get('total_points', 0)}")
    print(f"   Available: {user_points.get('available_points', 0)}")
    print(f"   Redeemed: {user_points.get('redeemed_points', 0)}")
    print(f"   Pending: {user_points.get('pending_points', 0)}")

print("\n" + "=" * 80)
print("✅ ANALYTICS CHECK COMPLETE")
print("=" * 80)

# Recommendations
print("\n💡 RECOMMENDATIONS:")
if total_data == 0:
    print("   ⚠️  No data collected yet. You need to:")
    print("      1. Open the offerwall page")
    print("      2. Click on offers to generate clicks")
    print("      3. Complete offers to generate conversions")
    print("      4. Then check analytics again")
else:
    print("   ✅ Data is being collected!")
    if stats.get('total_clicks', 0) == 0:
        print("   ⚠️  No clicks yet - users need to interact with offers")
    if stats.get('total_conversions', 0) == 0:
        print("   ⚠️  No conversions yet - users need to complete offers")
    if stats.get('total_points_awarded', 0) == 0:
        print("   ⚠️  No points awarded yet - conversions need to be tracked")

print("\n")
