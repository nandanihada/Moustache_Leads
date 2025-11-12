"""
Test the performance report method directly
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from models.user_reports import UserReports
from datetime import datetime

print("🔍 Testing Performance Report Method Directly...")
print("=" * 60)

try:
    user_reports = UserReports()
    
    # Test with the exact same parameters as the API
    date_range = {
        'start': datetime(2025, 11, 1),
        'end': datetime(2025, 11, 15)
    }
    
    print(f"📅 Date range: {date_range['start']} to {date_range['end']}")
    print(f"👤 User ID: test-user")
    
    # Call the method directly
    report = user_reports.get_performance_report(
        user_id='test-user',
        date_range=date_range,
        group_by=['date', 'offer_id']
    )
    
    print(f"\n📊 REPORT RESULTS:")
    print(f"  Success: {report.get('success', False)}")
    print(f"  Data rows: {len(report.get('data', []))}")
    print(f"  Total clicks: {report.get('summary', {}).get('total_clicks', 0)}")
    print(f"  Total conversions: {report.get('summary', {}).get('total_conversions', 0)}")
    
    if report.get('data'):
        sample = report['data'][0]
        print(f"\n📋 SAMPLE ROW:")
        print(f"  Date: {sample.get('date')}")
        print(f"  Offer: {sample.get('offer_name')}")
        print(f"  Clicks: {sample.get('clicks', 0)}")
        print(f"  Unique clicks: {sample.get('unique_clicks', 0)}")
        print(f"  Conversions: {sample.get('conversions', 0)}")
        print(f"  Time spent: {sample.get('avg_time_spent_seconds', 0)}")
    else:
        print(f"\n❌ NO DATA RETURNED")
        
        # Let's check if there's any data at all
        print(f"\n🔍 CHECKING RAW DATA:")
        
        # Check clicks
        clicks_count = user_reports.clicks_collection.count_documents({
            'click_time': {
                '$gte': date_range['start'],
                '$lte': date_range['end']
            }
        })
        print(f"  Clicks in date range: {clicks_count}")
        
        # Check conversions
        conversions_count = user_reports.conversions_collection.count_documents({
            'conversion_time': {
                '$gte': date_range['start'],
                '$lte': date_range['end']
            }
        })
        print(f"  Conversions in date range: {conversions_count}")
        
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()

print("\n" + "=" * 60)
print("🎯 DIRECT API TEST COMPLETE")
