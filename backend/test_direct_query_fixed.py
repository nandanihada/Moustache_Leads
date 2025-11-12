"""
Test the performance report directly from the database - FIXED
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from models.user_reports import UserReports
from datetime import datetime

print("🔍 Testing Direct Database Query...")
print("=" * 60)

try:
    user_reports = UserReports()
    
    # Test with a date range that includes our test data
    date_range = {
        'start': datetime(2024, 11, 5),  # Recent date to catch our test data
        'end': datetime(2024, 11, 15)
    }
    
    print(f"📅 Date range: {date_range['start']} to {date_range['end']}")
    
    report = user_reports.get_performance_report(
        user_id='test-user',
        date_range=date_range,
        group_by=['date', 'offer_id']
    )
    
    print(f"✅ Query successful!")
    print(f"📊 Report type: {type(report)}")
    print(f"📊 Report length: {len(report) if hasattr(report, '__len__') else 'N/A'}")
    
    if isinstance(report, list) and report:
        sample = report[0]
        print(f"\n🔍 Sample row (first result):")
    elif isinstance(report, dict):
        print(f"\n🔍 Report is a dict with keys: {list(report.keys())}")
        if report:
            sample = list(report.values())[0] if report else {}
            print(f"\n🔍 Sample row (first value):")
        else:
            sample = {}
    else:
        print(f"\n❌ Unexpected report format: {report}")
        sample = {}
    
    if sample:
        print(f"\n📋 ALL FIELDS:")
        for key, value in sorted(sample.items()):
            print(f"  {key}: {value}")
            
        print(f"\n🎯 SCREENSHOT COLUMNS STATUS:")
        screenshot_columns = {
            'ad_group': 'Ad Group',
            'goal': 'Goal', 
            'promo_code': 'Promo Code',
            'creative': 'Creative',
            'country': 'Country',
            'browser': 'Browser',
            'device_type': 'Device',
            'source': 'Source',
            'advertiser_sub_id1': 'Adv Sub 1'
        }
        
        for field, display_name in screenshot_columns.items():
            value = sample.get(field, 'MISSING')
            if value and value != 'MISSING' and value != '' and value != '-':
                print(f"  ✅ {display_name}: '{value}'")
            else:
                print(f"  ❌ {display_name}: EMPTY (value: {repr(value)})")
                
        print(f"\n🔢 STATISTICS:")
        stats_fields = ['clicks', 'conversions', 'total_payout', 'cr', 'epc']
        for field in stats_fields:
            value = sample.get(field, 0)
            print(f"  📈 {field}: {value}")
    
    else:
        print("❌ No sample data available!")
        
except Exception as e:
    print(f"❌ Query failed: {e}")
    import traceback
    traceback.print_exc()

print("\n" + "=" * 60)
print("🎯 DIAGNOSIS COMPLETE")
